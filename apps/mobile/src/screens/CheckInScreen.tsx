import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatCountdown, formatMinutes, useSafety } from '../state/safety';
import { colors, shared } from '../theme';

export function CheckInScreen() {
  const { remainingSeconds, lastCheckInAt, checkIn, settings, missedCount, ready } = useSafety();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    setBusy(true);
    try {
      await checkIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={shared.screenContent}>
      <Text style={shared.screenEyebrow}>LifeClick safety</Text>
      <Text style={shared.screenTitle}>Check in</Text>
      <Text style={shared.screenSubtitle}>One tap tells your circle you are okay.</Text>

      <View style={styles.timerCard}>
        <Text style={shared.cardLabel}>NEXT CHECK-IN</Text>
        <Text style={styles.timer}>{ready ? formatCountdown(remainingSeconds) : '--:--'}</Text>
        <Text style={shared.cardHint}>
          {`Every ${formatMinutes(settings.checkInIntervalMinutes)}. Your timer keeps running while the app is closed.`}
        </Text>
      </View>

      <Pressable
        onPress={onPress}
        disabled={busy || !ready}
        accessibilityRole="button"
        accessibilityLabel="Confirm that you are safe"
        style={({ pressed }) => [styles.checkButton, pressed && shared.pressed, (busy || !ready) && shared.disabled]}
      >
        <Text style={styles.checkButtonText}>{busy ? '…' : "I'm safe"}</Text>
        <Text style={styles.checkButtonHint}>Tap to reset timer</Text>
      </Pressable>

      <Text style={styles.lastSignal}>
        {lastCheckInAt
          ? `Confirmed at ${lastCheckInAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'No check-in recorded yet.'}
      </Text>

      {missedCount > 0 ? (
        <Text style={styles.missedNote}>
          {missedCount === 1 ? '1 missed check-in is on record.' : `${missedCount} missed check-ins are on record.`}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  timerCard: {
    marginTop: 28,
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.brand,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  timer: { color: colors.inkStrong, fontSize: 52, fontWeight: '800', marginTop: 8 },
  checkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 210,
    height: 210,
    borderRadius: 105,
    alignSelf: 'center',
    marginTop: 42,
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  checkButtonText: { color: colors.surface, fontSize: 28, fontWeight: '800' },
  checkButtonHint: { color: '#e9d5ff', fontSize: 13, marginTop: 6 },
  lastSignal: { color: colors.brand, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 28 },
  missedNote: { color: colors.danger, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});
