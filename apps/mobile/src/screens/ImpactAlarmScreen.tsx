import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSensors } from '../state/sensors';
import { useTheme } from '../state/theme';
import type { ImpactKind } from '../types';

const LABEL: Record<ImpactKind, string> = {
  crash: 'Possible collision detected',
  fall: 'Possible fall detected',
  impact: 'Heavy impact detected',
};

/**
 * Full-screen confirmation shown while an impact countdown runs.
 *
 * It takes over the whole screen deliberately: someone who has just been in a
 * collision should not have to find a button. The countdown is driven by the
 * server's deadline, so closing or killing the app does not stop it.
 */
export function ImpactAlarmScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const { pending, secondsRemaining, confirmSafe } = useSensors();
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Haptics as well as sound: a phone in a pocket after a fall may not be heard.
  useEffect(() => {
    const pattern = [0, 600, 400, 600, 400];
    Vibration.vibrate(pattern, true);
    return () => Vibration.cancel();
  }, []);

  if (!pending) return null;

  const urgent = secondsRemaining <= 30;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const onConfirm = async () => {
    setBusy(true);
    Vibration.cancel();
    try {
      await confirmSafe();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={urgent ? ['#7f1d1d', '#450a0a', '#1c0404'] : ['#7c2d12', '#431407', '#1c0a02']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        <View style={styles.body}>
          <Animated.View style={[styles.ring, { transform: [{ scale }] }]}>
            <Text style={styles.ringIcon}>!</Text>
          </Animated.View>

          <Text style={styles.title}>{LABEL[pending.kind]}</Text>
          <Text style={styles.subtitle}>
            {pending.peakG ? `Impact force ${Number(pending.peakG).toFixed(1)}g. ` : ''}
            Confirm you are safe, or your emergency contacts will be alerted with your location.
          </Text>

          <Text style={[styles.countdown, urgent && styles.countdownUrgent]}>{secondsRemaining}</Text>
          <Text style={styles.countdownLabel}>
            {secondsRemaining === 1 ? 'second until contacts are alerted' : 'seconds until contacts are alerted'}
          </Text>

          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.max(2, (secondsRemaining / 120) * 100)}%` }]} />
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onConfirm}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Confirm that you are safe and stop the alert"
            style={({ pressed }) => [styles.safeButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.safeButtonText}>{busy ? 'Cancelling…' : "I'm OK — cancel alert"}</Text>
          </Pressable>

          <Text style={styles.note}>
            If you do nothing, Inertia alerts your contacts automatically and raises your risk score. The countdown
            keeps running even if you close the app.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#1c0404' },
    safe: { flex: 1 },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    ring: {
      width: 92,
      height: 92,
      borderRadius: 46,
      borderWidth: 4,
      borderColor: 'rgba(255,255,255,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    ringIcon: { color: '#ffffff', fontSize: 44, fontWeight: '900', lineHeight: 50 },
    title: { color: '#ffffff', fontSize: 27, fontWeight: '800', textAlign: 'center', marginTop: 26 },
    subtitle: {
      color: 'rgba(255,255,255,0.86)',
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: 12,
    },
    countdown: { color: '#ffffff', fontSize: 84, fontWeight: '900', marginTop: 26, letterSpacing: -2 },
    countdownUrgent: { color: '#fecaca' },
    countdownLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
    track: {
      width: '100%',
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.22)',
      overflow: 'hidden',
      marginTop: 22,
    },
    trackFill: { height: '100%', borderRadius: 999, backgroundColor: '#ffffff' },
    actions: { paddingHorizontal: 24, paddingBottom: 18 },
    safeButton: {
      minHeight: 62,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: '#ffffff',
    },
    safeButtonText: { color: '#7f1d1d', fontSize: 18, fontWeight: '900' },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.6 },
    note: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 14,
    },
  });
