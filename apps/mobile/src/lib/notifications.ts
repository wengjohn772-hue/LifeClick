import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { StorageKeys, getItem, removeItem, setItem } from './storage';
import { registerPushToken, unregisterPushToken } from './api';

export const SAFETY_CHANNEL_ID = 'safety-alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Android drops notifications into a low-importance default channel unless one
 * is declared. Safety reminders must be able to interrupt, so the channel is
 * created explicitly at max importance.
 */
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SAFETY_CHANNEL_ID, {
    name: 'Safety alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6d28d9',
    sound: 'default',
    bypassDnd: false,
  });
}

export async function requestNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function resolveProjectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return (fromExtra as string | undefined) || fromEas;
}

/**
 * Registers this device for Expo push and stores the token server-side.
 *
 * Returns a reason instead of throwing when push is unavailable, so the
 * Settings screen can tell the user why rather than failing silently.
 */
export async function registerForPushNotifications(): Promise<{ token?: string; reason?: string }> {
  if (!Device.isDevice) {
    return { reason: 'Push notifications require a physical device.' };
  }

  const granted = await requestNotificationPermission();
  if (!granted) return { reason: 'Notification permission was denied.' };

  await ensureAndroidChannel();

  const projectId = resolveProjectId();
  if (!projectId) {
    // Expected until `eas init` has assigned a project ID.
    return { reason: 'No EAS project ID configured. Run `eas init` and set EAS_PROJECT_ID.' };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const previous = await getItem(StorageKeys.pushToken);
    if (previous !== token) {
      await registerPushToken({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceName: Device.deviceName ?? undefined,
      });
      await setItem(StorageKeys.pushToken, token);
    }
    return { token };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : 'Could not obtain a push token.' };
  }
}

/** Detaches this device from the account on sign-out. */
export async function releasePushToken() {
  const token = await getItem(StorageKeys.pushToken);
  if (!token) return;
  await unregisterPushToken(token).catch(() => undefined);
  await removeItem(StorageKeys.pushToken);
}

const REMINDER_CATEGORY = 'lifeclick.checkin.reminder';

// Tracked so only LifeClick's own reminder is cancelled. The previous
// implementation called cancelAllScheduledNotificationsAsync(), which wiped
// every scheduled notification the app had.
let scheduledReminderId: string | null = null;

export async function cancelCheckInReminder() {
  if (!scheduledReminderId) return;
  await Notifications.cancelScheduledNotificationAsync(scheduledReminderId).catch(() => undefined);
  scheduledReminderId = null;
}

/**
 * Schedules the "check-in due soon" reminder.
 *
 * Returns false when the deadline is already inside the reminder lead time —
 * the old code clamped that case to one second, so the reminder fired
 * immediately and told the user a check-in due in seconds was due in 5 minutes.
 */
export async function scheduleCheckInReminder(deadline: number, leadMinutes: number): Promise<boolean> {
  await cancelCheckInReminder();

  const secondsUntilReminder = Math.floor((deadline - Date.now()) / 1000) - leadMinutes * 60;
  if (secondsUntilReminder <= 0) return false;

  scheduledReminderId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'LifeClick reminder',
      body:
        leadMinutes === 1
          ? 'Your safety check-in is due in one minute.'
          : `Your safety check-in is due in ${leadMinutes} minutes.`,
      sound: 'default',
      categoryIdentifier: REMINDER_CATEGORY,
      ...(Platform.OS === 'android' ? { channelId: SAFETY_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilReminder,
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: SAFETY_CHANNEL_ID } : {}),
    },
  });

  return true;
}

/** Fired the moment a deadline passes without a check-in. */
export async function notifyMissedCheckIn() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'LifeClick check-in missed',
      body: 'Please confirm you are safe.',
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: SAFETY_CHANNEL_ID } : {}),
    },
    trigger: null, // Deliver immediately.
  });
}
