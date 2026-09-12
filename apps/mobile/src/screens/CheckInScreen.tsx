import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientScreen } from '../components/GradientScreen';
import { formatCountdown, formatMinutes, useSafety } from '../state/safety';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';

export function CheckInScreen() {
  const { colors, shared, gradient, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    remainingSeconds,
    lastCheckInAt,
    checkIn,
    settings,
    missedCount,
    safeStreak,
    nextRecovery,
    monitoringEnabled,
    setMonitoringEnabled,
    ready,
  } = useSafety();

  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState(false);

  const onCheckIn = async () => {
    setBusy(true);
    try {
      await checkIn();
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (next: boolean) => {
    setToggling(true);
    try {
      await setMonitoringEnabled(next);
    } finally {
      setToggling(false);
    }
  };

  // Under five minutes the countdown turns urgent.
  const urgent = monitoringEnabled && remainingSeconds > 0 && remainingSeconds <= 300;

  return (
    <GradientScreen>
      <Text style={shared.screenEyebrow}>LifeClick safety</Text>
      <Text style={shared.screenTitle}>Check in</Text>
      <Text style={shared.screenSubtitle}>One tap tells your circle you are okay.</Text>

      {/* Timer on/off */}
      <View style={styles.toggleCard}>
        <View style={styles.toggleMain}>
          <View style={styles.toggleTitleRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: monitoringEnabled ? colors.safe : colors.warn },
              ]}
            />
            <Text style={styles.toggleTitle}>{monitoringEnabled ? 'Timer running' : 'Timer paused'}</Text>
          </View>
          <Text style={styles.toggleHint}>
            {monitoringEnabled
              ? 'Miss a check-in and your trusted contacts are alerted.'
              : 'Nobody will be alerted while this is off.'}
          </Text>
        </View>
        <Switch
          value={monitoringEnabled}
          onValueChange={onToggle}
          disabled={toggling || !ready}
          trackColor={{ true: colors.brand, false: colors.switchTrackOff }}
          thumbColor={colors.surface}
          accessibilityLabel="Turn the check-in timer on or off"
        />
      </View>

      {/* Countdown */}
      <LinearGradient
        colors={isDark ? ['#241640', '#1a1030'] : ['#ffffff', '#f6f0ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.timerCard}
      >
        <Text style={shared.cardLabel}>{monitoringEnabled ? 'NEXT CHECK-IN' : 'TIMER PAUSED'}</Text>
        <Text style={[styles.timer, urgent && { color: colors.danger }]}>
          {!ready ? '--:--' : monitoringEnabled ? formatCountdown(remainingSeconds) : '—'}
        </Text>
        <Text style={shared.cardHint}>
          {monitoringEnabled
            ? `Every ${formatMinutes(settings.checkInIntervalMinutes)}. Runs even while the app is closed.`
            : 'Turn the timer back on to resume safety monitoring.'}
        </Text>
      </LinearGradient>

      {/* The button */}
      <Pressable
        onPress={onCheckIn}
        disabled={busy || !ready}
        accessibilityRole="button"
        accessibilityLabel="Confirm that you are safe"
        style={({ pressed }) => [styles.checkWrap, pressed && styles.checkPressed, (busy || !ready) && shared.disabled]}
      >
        <LinearGradient colors={gradient.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.checkButton}>
          <Text style={styles.checkButtonText}>{busy ? '…' : "I'm safe"}</Text>
          <Text style={styles.checkButtonHint}>
            {monitoringEnabled ? 'Tap to reset timer' : 'Tap to resume timer'}
          </Text>
        </LinearGradient>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.lastSignal}>
          {lastCheckInAt
            ? `Confirmed at ${lastCheckInAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'No check-in recorded yet.'}
        </Text>

        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: colors.safeSoft }]}>
            <Text style={[styles.pillText, { color: colors.safe }]}>{`+${nextRecovery} to behaviour`}</Text>
          </View>
          {safeStreak > 0 ? (
            <View style={[styles.pill, { backgroundColor: colors.brandTint }]}>
              <Text style={[styles.pillText, { color: colors.brand }]}>{`${safeStreak} in a row`}</Text>
            </View>
          ) : null}
          {missedCount > 0 ? (
            <View style={[styles.pill, { backgroundColor: colors.dangerSoft }]}>
              <Text style={[styles.pillText, { color: colors.onDangerSoft }]}>
                {missedCount === 1 ? '1 missed' : `${missedCount} missed`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </GradientScreen>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    toggleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 24,
      padding: 16,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    toggleMain: { flex: 1 },
    toggleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { width: 9, height: 9, borderRadius: 5 },
    toggleTitle: { color: colors.inkStrong, fontSize: 15, fontWeight: '800' },
    toggleHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },

    timerCard: {
      marginTop: 14,
      padding: 22,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.line,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    timer: { color: colors.inkStrong, fontSize: 52, fontWeight: '800', marginTop: 8 },

    checkWrap: { alignSelf: 'center', marginTop: 34, borderRadius: 105 },
    checkPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
    checkButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 206,
      height: 206,
      borderRadius: 103,
      shadowColor: colors.brand,
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 9,
    },
    checkButtonText: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
    checkButtonHint: { color: '#ede9fe', fontSize: 13, marginTop: 6 },

    footer: { marginTop: 26, alignItems: 'center' },
    lastSignal: { color: colors.brand, fontSize: 14, fontWeight: '700', textAlign: 'center' },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
    pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    pillText: { fontSize: 12, fontWeight: '800' },
  });
