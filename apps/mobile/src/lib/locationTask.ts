import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { loadTokens, saveLocation } from './api';

export const BACKGROUND_LOCATION_TASK = 'lifeclick-background-location';

/**
 * Expo Go's binary ships without the iOS background-location entitlement and
 * without Android's foreground-service permission, so the native call *rejects*
 * (iOS: `ERR_LOCATION_INFO_PLIST`) instead of returning a denial.
 *
 * `executionEnvironment` alone cannot detect this: Expo Go and a development
 * build both report `storeClient`, and a development build must still start
 * monitoring. `appOwnership` is deprecated but is the only value that means
 * "Expo Go" specifically — a development build reports `null`. It is treated as
 * a hint rather than a guarantee; the calls below are guarded regardless.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
  Constants.appOwnership === AppOwnership.Expo;

const EXPO_GO_REASON =
  'Background monitoring needs a development build — Expo Go cannot run it. Live location still works while the app is open.';

/** Turns a native rejection into something a user can act on. */
function describeFailure(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'ERR_LOCATION_INFO_PLIST' || code === 'E_FOREGROUND_SERVICE_NOT_AVAILABLE') {
    return EXPO_GO_REASON;
  }
  return error instanceof Error ? error.message : 'Could not start background monitoring.';
}

/**
 * Registered at module scope — TaskManager requires the task to be defined
 * before the JS bundle finishes evaluating, because the OS can relaunch the app
 * directly into this task with no UI mounted.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;

  const { locations } = data as { locations?: Location.LocationObject[] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  // The task may run in a cold-started process, so tokens come from secure
  // storage rather than component state. The server derives the user from the
  // token; there is no user ID to pass.
  const tokens = await loadTokens();
  if (!tokens?.accessToken) return;

  await saveLocation({
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
    accuracy: latest.coords.accuracy ?? 0,
    status: 'background',
  }).catch(() => undefined);
});

export async function isBackgroundTrackingActive() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Starts background monitoring. Requires the background permission, which on
 * Android 11+ opens system settings rather than showing a dialog.
 *
 * Never rejects: every caller treats this as a status check, and an unhandled
 * rejection here surfaced as a red error overlay on launch in Expo Go.
 */
export async function startBackgroundTracking(): Promise<{ started: boolean; reason?: string }> {
  if (isExpoGo) return { started: false, reason: EXPO_GO_REASON };

  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted) return { started: false, reason: 'Foreground location permission is required first.' };

    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) {
      return {
        started: false,
        reason: 'Allow location "Always" so LifeClick can watch over you when the app is closed.',
      };
    }

    if (await isBackgroundTrackingActive()) return { started: true };

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000,
      distanceInterval: 50,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'LifeClick safety monitoring',
        notificationBody: 'Your location is being monitored so your contacts can be alerted.',
        notificationColor: '#6d28d9',
      },
    });
    return { started: true };
  } catch (error) {
    return { started: false, reason: describeFailure(error) };
  }
}

/**
 * Stopped only on sign-out or when the user disables tracking — never on screen
 * unmount. The previous implementation stopped it in an effect cleanup, which
 * ended monitoring exactly when the app left the foreground.
 */
export async function stopBackgroundTracking() {
  if (!(await isBackgroundTrackingActive())) return;
  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => undefined);
}
