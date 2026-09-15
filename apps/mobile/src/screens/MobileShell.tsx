import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
// react-native's own SafeAreaView is iOS-only and deprecated; on Android it is
// a no-op, which leaves the tab bar under the system navigation bar now that
// edge-to-edge is the default.
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { TabBar } from '../components/TabBar';
import { CheckInScreen } from './CheckInScreen';
import { MapScreen } from './MapScreen';
import { FafScreen } from './FafScreen';
import { FeedsScreen } from './FeedsScreen';
import { SafetyScreen } from './SafetyScreen';
import { SettingsScreen } from './SettingsScreen';
import { isBackgroundTrackingActive, isExpoGo, startBackgroundTracking } from '../lib/locationTask';
import { saveLocation } from '../lib/api';
import { useSafety } from '../state/safety';
import { useTheme } from '../state/theme';
import type { Tab } from '../types';

// The position watcher fires far more often than the location history needs.
// Persisting every fix would add roughly 240 rows an hour per user.
const FOREGROUND_PERSIST_INTERVAL_MS = 60_000;

export function MobileShell() {
  const { colors, isDark } = useTheme();
  const { settings, ready, checkIn } = useSafety();
  const [tab, setTab] = useState<Tab>('checkin');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationMessage, setLocationMessage] = useState('Requesting location permission…');
  const [backgroundActive, setBackgroundActive] = useState(false);
  const lastPersistedAt = useRef(0);

  const enableBackground = useCallback(async () => {
    const result = await startBackgroundTracking();
    setBackgroundActive(result.started);
    if (!result.started && result.reason) setLocationMessage(result.reason);
    else if (result.started) setLocationMessage('Live location monitoring is active.');
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    // Nothing awaits this, so anything it throws — location services disabled,
    // a permission dialog dismissed by the OS — would become an unhandled
    // rejection and an error overlay rather than a message on the screen.
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (!permission.granted) {
          setLocationMessage('Allow location in device settings to show your position.');
          return;
        }

        setLocationMessage('Live location monitoring is active.');

        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 10 },
          (next) => {
            // The map updates on every fix; only the write is throttled.
            setLocation(next);

            if (Date.now() - lastPersistedAt.current < FOREGROUND_PERSIST_INTERVAL_MS) return;
            lastPersistedAt.current = Date.now();

            void saveLocation({
              latitude: next.coords.latitude,
              longitude: next.coords.longitude,
              accuracy: next.coords.accuracy ?? 0,
              status: 'live',
            }).catch(() => undefined);
          }
        );

        if (cancelled) return;
        setBackgroundActive(await isBackgroundTrackingActive());
      } catch (error) {
        if (cancelled) return;
        setLocationMessage(
          error instanceof Error ? error.message : 'Location is unavailable on this device right now.'
        );
      }
    })();

    return () => {
      cancelled = true;
      // Only the foreground watcher is torn down here. Background monitoring
      // deliberately survives unmount — stopping it on cleanup is what made the
      // app blind the moment it left the foreground.
      subscription?.remove();
    };
  }, []);

  // Auto-start background monitoring only once the user's real settings have
  // loaded, so a user who disabled tracking is not opted back in by the
  // defaults that apply during the first render.
  //
  // Skipped in Expo Go, where it can only ever fail: attempting it on launch
  // replaced the live-location status with an error before the user had done
  // anything. The Settings button still explains why when they ask for it.
  useEffect(() => {
    if (!ready || !settings.trackingEnabled || backgroundActive || isExpoGo) return;
    void enableBackground();
  }, [ready, settings.trackingEnabled, backgroundActive, enableBackground]);

  // Responding to the server's "are you safe?" alert. Checking in from the
  // notification resolves the incident before trusted contacts are alerted.
  useEffect(() => {
    const confirmSafe = () => {
      Alert.alert(
        'Confirm you are safe',
        'Your check-in is overdue. Your trusted contacts will be alerted if you do not respond.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: "I'm safe", onPress: () => void checkIn() },
        ]
      );
    };

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === 'check_in_overdue') confirmSafe();
      if (type === 'contact_escalation') setTab('faf');
    });

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.type === 'check_in_overdue') confirmSafe();
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, [checkIn]);

  const content =
    tab === 'checkin' ? (
      <CheckInScreen />
    ) : tab === 'map' ? (
      <MapScreen location={location} message={locationMessage} backgroundActive={backgroundActive} />
    ) : tab === 'faf' ? (
      <FafScreen />
    ) : tab === 'feeds' ? (
      <FeedsScreen />
    ) : tab === 'safety' ? (
      <SafetyScreen backgroundActive={backgroundActive} />
    ) : (
      <SettingsScreen
        backgroundActive={backgroundActive}
        locationMessage={locationMessage}
        onEnableBackground={() => void enableBackground()}
      />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>{content}</View>
      <TabBar active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}
