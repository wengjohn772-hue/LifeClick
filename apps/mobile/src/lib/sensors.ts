import { Accelerometer, Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
import { CrashDetector, type DetectedEvent } from './crashDetection';

/**
 * Accelerometer and pedometer wiring.
 *
 * Known limits, both platform-imposed rather than choices:
 *
 * - Sensor delivery stops when the app is backgrounded. On Android the location
 *   foreground service keeps the process alive, so monitoring continues; on iOS
 *   it continues only while the app is kept running for background location,
 *   and is not guaranteed. Apple's own Crash Detection is built into iOS and is
 *   not available to third-party apps, so this cannot match an iPhone 14.
 * - Pedometer.getStepCountAsync is iOS-only. Android has no history API at all,
 *   so Android step figures only cover time the app was open.
 */

/** 20 Hz. Fast enough to catch a collision spike, slow enough not to drain the battery. */
const SAMPLE_INTERVAL_MS = 50;

export async function isAccelerometerAvailable() {
  try {
    return await Accelerometer.isAvailableAsync();
  } catch {
    return false;
  }
}

export interface MonitorHandle {
  stop: () => void;
}

/**
 * Starts impact monitoring. `onEvent` fires at most once per incident; the
 * detector's refractory window handles the rest.
 */
export async function startImpactMonitor(onEvent: (event: DetectedEvent) => void): Promise<MonitorHandle | null> {
  if (!(await isAccelerometerAvailable())) return null;

  const detector = new CrashDetector();
  Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);

  const subscription = Accelerometer.addListener(({ x, y, z }) => {
    // Expo's timestamp field is inconsistent across platforms, so the wall
    // clock is used for the detector's timing windows.
    const event = detector.push({ x, y, z, t: Date.now() });
    if (event) onEvent(event);
  });

  return {
    stop: () => {
      subscription.remove();
      detector.reset();
    },
  };
}

export interface StepSummary {
  days: Array<{ day: string; steps: number }>;
  /** False on Android, where no history API exists. */
  historyAvailable: boolean;
  available: boolean;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Reads whatever step history the platform will give us.
 *
 * iOS returns up to seven days (Apple's limit). Android returns nothing
 * historical, so the caller falls back to live counting while open.
 */
export async function readStepHistory(days = 7): Promise<StepSummary> {
  let available = false;
  try {
    available = await Pedometer.isAvailableAsync();
  } catch {
    available = false;
  }
  if (!available) return { days: [], historyAvailable: false, available: false };

  if (Platform.OS !== 'ios') {
    return { days: [], historyAvailable: false, available: true };
  }

  try {
    const permission = await Pedometer.requestPermissionsAsync();
    if (!permission.granted) return { days: [], historyAvailable: false, available: true };
  } catch {
    return { days: [], historyAvailable: false, available: true };
  }

  const out: Array<{ day: string; steps: number }> = [];
  for (let back = 0; back < Math.min(days, 7); back += 1) {
    const end = new Date();
    end.setDate(end.getDate() - back);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);

    try {
      const result = await Pedometer.getStepCountAsync(start, end);
      out.push({ day: isoDay(start), steps: result?.steps ?? 0 });
    } catch {
      // A day with no data is normal; keep going rather than abandoning the sync.
    }
  }

  return { days: out, historyAvailable: true, available: true };
}

/**
 * Live step counting, the only option on Android. Reports the running total
 * since the subscription started, not an absolute daily figure.
 */
export async function watchSteps(onSteps: (stepsSinceStart: number) => void): Promise<MonitorHandle | null> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return null;
    const permission = await Pedometer.requestPermissionsAsync();
    if (!permission.granted) return null;

    const subscription = Pedometer.watchStepCount((result) => onSteps(result.steps));
    return { stop: () => subscription.remove() };
  } catch {
    return null;
  }
}
