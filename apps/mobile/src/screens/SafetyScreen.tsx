import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Metric } from '../components/Metric';
import { formatCountdown, useSafety } from '../state/safety';
import { colors, riskColor, shared } from '../theme';

export function SafetyScreen({ backgroundActive }: { backgroundActive: boolean }) {
  const {
    remainingSeconds,
    lastCheckInAt,
    missedCount,
    fakeAlerts,
    behaviorScore,
    riskScore,
    riskLevel,
    reportFalseAlert,
  } = useSafety();

  const tone = riskColor(riskScore);

  return (
    <ScrollView contentContainerStyle={shared.screenContent}>
      <Text style={shared.screenEyebrow}>AI safety monitor</Text>
      <Text style={shared.screenTitle}>Safety dashboard</Text>
      <Text style={shared.screenSubtitle}>A quiet watch over your check-in behaviour.</Text>

      <View style={shared.card}>
        <View style={styles.riskHeader}>
          <Text style={shared.cardLabel}>CURRENT RISK</Text>
          <View style={[styles.badge, { backgroundColor: `${tone}1a` }]}>
            <Text style={[styles.badgeText, { color: tone }]}>{riskLevel}</Text>
          </View>
        </View>

        <Text style={[styles.riskScore, { color: tone }]}>
          {riskScore}
          <Text style={styles.riskOutOf}>/100</Text>
        </Text>

        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.max(5, riskScore)}%`, backgroundColor: tone }]} />
        </View>

        <Text style={shared.cardHint}>
          Assessment uses check-in history, timing signals, and reported false alerts.
        </Text>
      </View>

      <Metric label="Behaviour score" value={`${behaviorScore}/100`} />
      <Metric
        label="Missed check-ins"
        value={String(missedCount)}
        tone={missedCount > 0 ? colors.danger : undefined}
      />
      <Metric label="False alerts" value={String(fakeAlerts)} />
      <Metric label="Next check-in" value={formatCountdown(remainingSeconds)} />
      <Metric label="Last signal" value={lastCheckInAt ? lastCheckInAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Waiting'} />
      <Metric
        label="Location monitoring"
        value={backgroundActive ? 'Active' : 'Foreground only'}
        tone={backgroundActive ? colors.safe : colors.warn}
      />

      <Pressable onPress={reportFalseAlert} style={({ pressed }) => [styles.falseAlert, pressed && shared.pressed]}>
        <Text style={styles.falseAlertText}>Report false alert</Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        Missed check-ins are currently detected on this device. Server-side detection and trusted-contact
        escalation are not active yet, so LifeClick should not be relied on as an emergency service.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  riskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  riskScore: { fontSize: 44, fontWeight: '800', marginTop: 10 },
  riskOutOf: { fontSize: 18, color: colors.muted, fontWeight: '700' },
  track: { height: 8, borderRadius: 999, backgroundColor: '#ece5f4', overflow: 'hidden', marginTop: 12 },
  trackFill: { height: '100%', borderRadius: 999 },
  falseAlert: {
    marginTop: 24,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.dangerSoft,
  },
  falseAlertText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 22 },
});
