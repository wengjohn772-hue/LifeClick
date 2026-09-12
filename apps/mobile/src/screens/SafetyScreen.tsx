import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientScreen } from '../components/GradientScreen';
import { formatCountdown, useSafety } from '../state/safety';
import { useTheme } from '../state/theme';
import { riskColor, riskSoftColor, type Palette } from '../theme';

/** One tile in the 2-column metric grid. */
function StatCard({
  label,
  value,
  detail,
  icon,
  tone,
  colors,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone?: string;
  colors: Palette;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: (tone ?? colors.brand) + '22' }]}>
        <Text style={[styles.statIconText, { color: tone ?? colors.brand }]}>{icon}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone ? { color: tone } : null]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statDetail} numberOfLines={2}>
        {detail}
      </Text>
    </View>
  );
}

/** Horizontal progress track used for both risk and behaviour. */
function Meter({ value, tone, track }: { value: number; tone: string; track: string }) {
  return (
    <View style={[meterStyles.track, { backgroundColor: track }]}>
      <View style={[meterStyles.fill, { width: `${Math.max(3, Math.min(100, value))}%`, backgroundColor: tone }]} />
    </View>
  );
}

export function SafetyScreen({ backgroundActive }: { backgroundActive: boolean }) {
  const { colors, shared, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    remainingSeconds,
    lastCheckInAt,
    missedCount,
    recentMisses,
    safeStreak,
    fakeAlerts,
    behaviorScore,
    riskScore,
    riskLevel,
    nextRecovery,
    monitoringEnabled,
    reportFalseAlert,
  } = useSafety();

  const tone = riskColor(riskScore, colors);
  const soft = riskSoftColor(riskScore, colors);
  const behaviourTone = behaviorScore >= 80 ? colors.safe : behaviorScore >= 50 ? colors.warn : colors.danger;

  return (
    <GradientScreen>
      <Text style={shared.screenEyebrow}>AI safety monitor</Text>
      <Text style={shared.screenTitle}>Safety dashboard</Text>
      <Text style={shared.screenSubtitle}>A quiet watch over your check-in behaviour.</Text>

      {/* Headline risk card */}
      <LinearGradient
        colors={isDark ? ['#241640', '#1a1030'] : ['#ffffff', '#f6f0ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.riskCard}
      >
        <View style={styles.riskHeader}>
          <View style={styles.riskHeaderMain}>
            <Text style={shared.cardLabel}>CURRENT RISK</Text>
            <Text style={[styles.riskScore, { color: tone }]}>
              {riskScore}
              <Text style={styles.riskOutOf}>/100</Text>
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: soft }]}>
            <Text style={[styles.badgeText, { color: tone }]}>{riskLevel}</Text>
          </View>
        </View>

        <Meter value={riskScore} tone={tone} track={colors.line} />

        <Text style={shared.cardHint}>
          {riskScore === 0
            ? 'No concerning signals. Keep checking in to stay here.'
            : 'Built from recent missed check-ins, timing signals, and reported false alerts.'}
        </Text>
      </LinearGradient>

      {/* Behaviour card, with recovery made visible */}
      <View style={styles.behaviourCard}>
        <View style={styles.behaviourHeader}>
          <Text style={shared.cardLabel}>BEHAVIOUR SCORE</Text>
          <Text style={[styles.behaviourValue, { color: behaviourTone }]}>{behaviorScore}/100</Text>
        </View>

        <Meter value={behaviorScore} tone={behaviourTone} track={colors.line} />

        <View style={styles.recoveryRow}>
          <View style={[styles.recoveryPill, { backgroundColor: colors.safeSoft }]}>
            <Text style={[styles.recoveryPillText, { color: colors.safe }]}>{`+${nextRecovery} next check-in`}</Text>
          </View>
          {safeStreak > 0 ? (
            <View style={[styles.recoveryPill, { backgroundColor: colors.brandTint }]}>
              <Text style={[styles.recoveryPillText, { color: colors.brand }]}>
                {safeStreak === 1 ? '1 in a row' : `${safeStreak} in a row`}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={shared.cardHint}>
          {behaviorScore >= 100
            ? 'Full score. Checking in on time keeps it here.'
            : `Checking in on time earns points back — longer streaks earn more, up to +10.`}
        </Text>
      </View>

      {/* Metric grid */}
      <View style={styles.grid}>
        <StatCard
          colors={colors}
          icon="⏱"
          label="Next check-in"
          value={monitoringEnabled ? formatCountdown(remainingSeconds) : 'Paused'}
          detail={monitoringEnabled ? 'Time remaining' : 'Timer is off'}
          tone={monitoringEnabled ? undefined : colors.warn}
        />
        <StatCard
          colors={colors}
          icon="⚑"
          label="Recent misses"
          value={String(recentMisses)}
          detail={recentMisses ? 'Clears as you check in' : 'All clear'}
          tone={recentMisses ? colors.danger : colors.safe}
        />
        <StatCard
          colors={colors}
          icon="✓"
          label="Last signal"
          value={lastCheckInAt ? lastCheckInAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          detail={lastCheckInAt ? 'Confirmed safe' : 'No check-in yet'}
        />
        <StatCard
          colors={colors}
          icon="⌖"
          label="Location"
          value={backgroundActive ? 'Active' : 'Foreground'}
          detail={backgroundActive ? 'Watching in background' : 'Only while app is open'}
          tone={backgroundActive ? colors.safe : colors.warn}
        />
        <StatCard
          colors={colors}
          icon="∑"
          label="Total missed"
          value={String(missedCount)}
          detail="Lifetime record"
        />
        <StatCard
          colors={colors}
          icon="!"
          label="False alerts"
          value={String(fakeAlerts)}
          detail="Reported by you"
          tone={fakeAlerts ? colors.warn : undefined}
        />
      </View>

      <Pressable onPress={reportFalseAlert} style={({ pressed }) => [styles.falseAlert, pressed && shared.pressed]}>
        <Text style={styles.falseAlertText}>Report false alert</Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        Missed check-ins are detected by LifeClick&apos;s servers, but trusted-contact escalation has not been
        tested on real devices yet. Do not rely on this as an emergency service.
      </Text>
    </GradientScreen>
  );
}

const meterStyles = StyleSheet.create({
  track: { height: 9, borderRadius: 999, overflow: 'hidden', marginTop: 14 },
  fill: { height: '100%', borderRadius: 999 },
});

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    riskCard: {
      marginTop: 24,
      padding: 20,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.line,
      shadowColor: colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    },
    riskHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    riskHeaderMain: { flex: 1 },
    riskScore: { fontSize: 44, fontWeight: '800', marginTop: 6 },
    riskOutOf: { fontSize: 17, color: colors.muted, fontWeight: '700' },
    badge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, marginTop: 4 },
    badgeText: { fontSize: 13, fontWeight: '800' },

    behaviourCard: {
      marginTop: 14,
      padding: 20,
      borderRadius: 26,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    behaviourHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    behaviourValue: { fontSize: 20, fontWeight: '800' },
    recoveryRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    recoveryPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    recoveryPillText: { fontSize: 12, fontWeight: '800' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
    statCard: {
      // Two per row, accounting for the 12px gap.
      width: '47.8%',
      flexGrow: 1,
      padding: 16,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    statIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statIconText: { fontSize: 17, fontWeight: '800' },
    statLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 12 },
    statValue: { color: colors.inkStrong, fontSize: 19, fontWeight: '800', marginTop: 3 },
    statDetail: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 3 },

    falseAlert: {
      marginTop: 22,
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.dangerSoft,
    },
    falseAlertText: { color: colors.onDangerSoft, fontWeight: '800', fontSize: 13 },
    disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 20 },
  });
