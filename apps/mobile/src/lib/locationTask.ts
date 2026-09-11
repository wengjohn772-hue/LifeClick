import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { loadTokens, saveLocation } from './api';

export const BACKGROUND_LOCATION_TASK = 'lifeclick-background-location';

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
 */
export async function startBackgroundTracking(): Promise<{ started: boolean; reason?: string }> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) return { started: false, reason: 'Foreground location permission is required first.' };

  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    return { started: false, reason: 'Allow location "Always" so LifeClick can watch over you when the app is closed.' };
  }

  if (await isBackgroundTrackingActive()) return { started: true };

  try {
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
    return { started: false, reason: error instanceof Error ? error.message : 'Could not start background monitoring.' };
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
