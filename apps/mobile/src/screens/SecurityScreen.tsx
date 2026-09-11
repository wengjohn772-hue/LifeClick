import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSecurityActivity, withdrawConsent } from '../lib/api';
import { useSession } from '../state/session';
import { colors, shared } from '../theme';
import type { SecurityActivity } from '../types';

const EVENT_LABEL: Record<string, string> = {
  login: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  register: 'Account created',
  logout: 'Signed out',
  consent_updated: 'Privacy choices updated',
  consent_withdrawn: 'Consent withdrawn',
  account_deleted: 'Account deleted',
};

function when(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The user's own view of what has been collected about them. Collecting IP and
 * location without showing the user is surveillance; showing it is what makes
 * an unrecognised sign-in actionable.
 */
export function SecurityScreen({ onBack }: { onBack: () => void }) {
  const { signOut } = useSession();
  const [activity, setActivity] = useState<SecurityActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setActivity(await getSecurityActivity());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your activity.');
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const confirmWithdraw = () => {
    Alert.alert(
      'Withdraw consent',
      'This immediately stops safety monitoring and permanently deletes your location history. Your trusted contacts will no longer be alerted if you go quiet. You will be signed out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const result = await withdrawConsent();
                Alert.alert(
                  'Consent withdrawn',
                  `Monitoring stopped and ${result.locationEventsDeleted} location records deleted.`
                );
              } finally {
                await signOut();
              }
            })();
          },
        },
      ]
    );
  };

  const failedAttempts = activity?.events.filter((event) => event.outcome === 'failure').length ?? 0;

  return (
    <ScrollView
      contentContainerStyle={shared.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.brand}
        />
      }
    >
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Settings</Text>
      </Pressable>

      <Text style={shared.screenEyebrow}>Your data</Text>
      <Text style={shared.screenTitle}>Security activity</Text>
      <Text style={shared.screenSubtitle}>Everything recorded about your account access.</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          {failedAttempts > 0 ? (
            <View style={styles.warning}>
              <Text style={styles.warningTitle}>
                {failedAttempts === 1
                  ? '1 failed sign-in attempt on record'
                  : `${failedAttempts} failed sign-in attempts on record`}
              </Text>
              <Text style={styles.warningBody}>
                If you do not recognise these, change your password.
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Recent account events</Text>
          {activity?.events.length === 0 ? (
            <Text style={styles.empty}>No events recorded yet.</Text>
          ) : (
            activity?.events.map((event, index) => (
              <View key={`${event.at}-${index}`} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={[styles.rowTitle, event.outcome === 'failure' && styles.rowTitleBad]}>
                    {EVENT_LABEL[event.type] ?? event.type}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {[event.ip, when(event.at)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Networks used (last 7 days)</Text>
          {activity?.requestSummary.length === 0 ? (
            <Text style={styles.empty}>No requests recorded yet.</Text>
          ) : (
            activity?.requestSummary.map((entry) => (
              <View key={entry.ip ?? 'unknown'} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{entry.ip ?? 'Unknown address'}</Text>
                  <Text style={styles.rowMeta}>
                    {`${entry.requests} requests · last ${when(entry.lastSeen)}`}
                  </Text>
                </View>
              </View>
            ))
          )}

          {activity ? (
            <Text style={styles.retention}>
              {`Kept automatically: request logs ${activity.retention.accessLogDays} days, sign-in history ${activity.retention.securityLogDays} days, location ${activity.retention.locationDays} days. Older records are deleted.`}
            </Text>
          ) : null}

          <Pressable onPress={confirmWithdraw} style={({ pressed }) => [styles.withdraw, pressed && shared.pressed]}>
            <Text style={styles.withdrawText}>Withdraw consent and stop monitoring</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: { marginBottom: 12, alignSelf: 'flex-start' },
  backText: { color: colors.brand, fontSize: 15, fontWeight: '700' },
  loader: { marginTop: 40 },
  error: { color: colors.danger, fontSize: 14, marginTop: 24, lineHeight: 20 },
  warning: {
    marginTop: 22,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  warningTitle: { color: '#9a3412', fontWeight: '800', fontSize: 14 },
  warningBody: { color: '#9a3412', fontSize: 13, lineHeight: 19, marginTop: 6 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 26, marginBottom: 4 },
  empty: { color: colors.muted, fontSize: 14, marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowMain: { flex: 1 },
  rowTitle: { color: colors.inkStrong, fontSize: 15, fontWeight: '700' },
  rowTitleBad: { color: colors.danger },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  retention: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 20 },
  withdraw: {
    marginTop: 24,
    alignItems: 'center',
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  withdrawText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
