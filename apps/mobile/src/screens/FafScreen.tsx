import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Avatar } from '../components/Avatar';
import { FafMap } from '../components/FafMap';
import { Field } from '../components/Field';
import { GradientScreen } from '../components/GradientScreen';
import {
  cancelFafRequest,
  disconnectFaf,
  getFafConnections,
  getFafRequests,
  requestFafPairing,
  respondToFafRequest,
} from '../lib/api';
import { useSession } from '../state/session';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';
import type { FafConnection, FafFix, FafRequest } from '../types';

/**
 * Polling interval while the screen is open.
 *
 * Push delivers the pairing prompt, but push is unavailable in Expo Go on
 * Android and before `eas init`, so the screen must not depend on it. Polling
 * also keeps the other person's marker moving.
 */
const POLL_MS = 10_000;

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : new Date(iso).toLocaleDateString();
}

export function FafScreen() {
  const { colors, shared } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useSession();

  const [friendId, setFriendId] = useState('');
  const [incoming, setIncoming] = useState<FafRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FafRequest[]>([]);
  const [connections, setConnections] = useState<FafConnection[]>([]);
  const [myFix, setMyFix] = useState<FafFix | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const mounted = useRef(true);

  const say = (text: string, error = false) => {
    setIsError(error);
    setMessage(text);
  };

  const refresh = useCallback(async () => {
    const [requests, active] = await Promise.all([
      getFafRequests().catch(() => null),
      getFafConnections().catch(() => null),
    ]);
    if (!mounted.current) return;

    if (requests) {
      setIncoming(requests.incoming);
      setOutgoing(requests.outgoing);
    }
    if (active) {
      setConnections(active.connections);
      setMyFix(active.me);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh().finally(() => mounted.current && setLoading(false));

    const timer = setInterval(() => void refresh(), POLL_MS);

    // A pairing push should update the screen immediately rather than waiting
    // out the poll interval.
    const received = Notifications.addNotificationReceivedListener((n) => {
      if (String(n.request.content.data?.type || '').startsWith('faf_')) void refresh();
    });
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = String(response.notification.request.content.data?.type || '');
      if (type.startsWith('faf_')) void refresh();
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });

    return () => {
      mounted.current = false;
      clearInterval(timer);
      received.remove();
      responded.remove();
      appState.remove();
    };
  }, [refresh]);

  const send = async () => {
    const id = friendId.trim().toUpperCase();
    if (!id) return;

    setBusy(true);
    setMessage('');
    try {
      const result = await requestFafPairing(id);
      setFriendId('');
      say(
        result.notified
          ? `Request sent to ${result.request.person.name}. Waiting for them to permit it.`
          : `Request sent to ${result.request.person.name}, but they have no device registered yet, so they will only see it when they open LifeClick.`
      );
      await refresh();
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not send that request.', true);
    } finally {
      setBusy(false);
    }
  };

  const respond = async (request: FafRequest, accept: boolean) => {
    setBusy(true);
    try {
      await respondToFafRequest(request.id, accept);
      say(
        accept
          ? `Connected to ${request.person.name}. You can both see the map now.`
          : `Declined ${request.person.name}.`
      );
      await refresh();
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not answer that request.', true);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (request: FafRequest) => {
    setBusy(true);
    try {
      await cancelFafRequest(request.id);
      await refresh();
      say(`Withdrew your request to ${request.person.name}.`);
    } catch {
      say('Could not withdraw that request.', true);
    } finally {
      setBusy(false);
    }
  };

  const confirmDisconnect = (connection: FafConnection) => {
    Alert.alert(
      'Disconnect?',
      `This ends the session with ${connection.person.name}. You will both stop seeing each other's location immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setConnections((previous) => previous.filter((c) => c.id !== connection.id));
              try {
                await disconnectFaf(connection.id);
                say(`Disconnected from ${connection.person.name}.`);
              } catch {
                say('Could not disconnect. Refreshing.', true);
              }
              await refresh();
            })();
          },
        },
      ]
    );
  };

  return (
    <GradientScreen refreshing={false} onRefresh={() => void refresh()}>
      <Text style={shared.screenEyebrow}>Safety circle</Text>
      <Text style={shared.screenTitle}>Find a Friend</Text>
      <Text style={shared.screenSubtitle}>
        Connect by FaF ID to share live location. Both sides must agree, and either can stop it.
      </Text>

      {user?.fafId ? (
        <View style={styles.idCard}>
          <Text style={shared.cardLabel}>YOUR FAF ID</Text>
          <Text style={styles.idValue}>{user.fafId}</Text>
          <Text style={shared.cardHint}>Share this with people you trust so they can request to connect.</Text>
        </View>
      ) : null}

      {/* Incoming — the permission step */}
      {incoming.length > 0 ? (
        <>
          <Text style={shared.sectionTitle}>Permission needed</Text>
          {incoming.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Avatar avatarId={request.person.avatarId} name={request.person.name} size={44} />
                <View style={styles.requestMain}>
                  <Text style={styles.requestName}>{request.person.name}</Text>
                  <Text style={styles.requestMeta}>
                    {`${request.person.fafId} · asked ${ago(request.requestedAt)}`}
                  </Text>
                </View>
              </View>
              <Text style={styles.requestBody}>
                {`${request.person.name} wants to connect. If you allow it, you will both see each other's live location until one of you disconnects.`}
              </Text>
              <View style={styles.requestActions}>
                <Pressable
                  onPress={() => void respond(request, true)}
                  disabled={busy}
                  style={({ pressed }) => [styles.allowButton, pressed && shared.pressed, busy && shared.disabled]}
                >
                  <Text style={styles.allowText}>Allow</Text>
                </Pressable>
                <Pressable
                  onPress={() => void respond(request, false)}
                  disabled={busy}
                  style={({ pressed }) => [styles.denyButton, pressed && shared.pressed, busy && shared.disabled]}
                >
                  <Text style={styles.denyText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      ) : null}

      {/* Connected */}
      {connections.length > 0 ? (
        <>
          <Text style={shared.sectionTitle}>Connected</Text>
          {connections.map((connection) => (
            <View key={connection.id} style={styles.connectionCard}>
              <View style={styles.requestHeader}>
                <Avatar avatarId={connection.person.avatarId} name={connection.person.name} size={44} />
                <View style={styles.requestMain}>
                  <Text style={styles.requestName}>{connection.person.name}</Text>
                  <Text style={styles.requestMeta}>
                    {connection.location
                      ? `${connection.person.fafId} · updated ${ago(connection.location.capturedAt)}`
                      : `${connection.person.fafId} · no position yet`}
                  </Text>
                </View>
                <View style={styles.liveDot} />
              </View>

              <FafMap
                me={myFix}
                them={connection.location}
                myName={user?.name ?? 'You'}
                theirName={connection.person.name}
              />

              <Pressable
                onPress={() => confirmDisconnect(connection)}
                style={({ pressed }) => [styles.disconnectButton, pressed && shared.pressed]}
              >
                <Text style={styles.disconnectText}>Disconnect</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      {/* Search */}
      <Text style={shared.sectionTitle}>Connect to someone</Text>
      <View style={shared.formCard}>
        <Field
          label="FaF ID"
          value={friendId}
          onChangeText={(value) => {
            setFriendId(value);
            setMessage('');
          }}
          placeholder="FAF-0000"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Pressable
          onPress={send}
          disabled={!friendId.trim() || busy}
          style={({ pressed }) => [
            shared.primaryButton,
            pressed && shared.pressed,
            (!friendId.trim() || busy) && shared.disabled,
          ]}
        >
          <Text style={shared.primaryText}>{busy ? 'Sending…' : 'Request to connect'}</Text>
        </Pressable>
        {message ? <Text style={[shared.message, isError && shared.errorMessage]}>{message}</Text> : null}
      </View>

      {/* Outgoing */}
      {outgoing.length > 0 ? (
        <>
          <Text style={shared.sectionTitle}>Waiting for permission</Text>
          {outgoing.map((request) => (
            <View key={request.id} style={styles.pendingRow}>
              <Avatar avatarId={request.person.avatarId} name={request.person.name} size={36} />
              <View style={styles.requestMain}>
                <Text style={styles.pendingName}>{request.person.name}</Text>
                <Text style={styles.requestMeta}>{`${request.person.fafId} · sent ${ago(request.requestedAt)}`}</Text>
              </View>
              <Pressable onPress={() => void withdraw(request)} hitSlop={8} disabled={busy}>
                <Text style={styles.withdrawText}>Withdraw</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      {loading ? <ActivityIndicator style={styles.loader} color={colors.brand} /> : null}

      {!loading && connections.length === 0 && incoming.length === 0 && outgoing.length === 0 ? (
        <Text style={styles.emptyNote}>
          No connections yet. Ask someone for their FaF ID, or share yours above.
        </Text>
      ) : null}
    </GradientScreen>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    idCard: {
      marginTop: 24,
      padding: 20,
      borderRadius: 24,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.lineSoft,
    },
    idValue: { color: colors.inkStrong, fontSize: 28, fontWeight: '800', marginTop: 8, letterSpacing: 1 },

    requestCard: {
      marginTop: 14,
      padding: 16,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.brand,
    },
    connectionCard: {
      marginTop: 14,
      padding: 16,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    requestMain: { flex: 1 },
    requestName: { color: colors.inkStrong, fontSize: 16, fontWeight: '800' },
    requestMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
    requestBody: { color: colors.body, fontSize: 13, lineHeight: 19, marginTop: 12 },
    requestActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    allowButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: colors.brand,
    },
    allowText: { color: colors.onBrand, fontWeight: '800', fontSize: 14 },
    denyButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.line,
    },
    denyText: { color: colors.body, fontWeight: '800', fontSize: 14 },

    liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.safe },
    disconnectButton: {
      marginTop: 14,
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    disconnectText: { color: colors.danger, fontWeight: '800', fontSize: 14 },

    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    pendingName: { color: colors.inkStrong, fontSize: 15, fontWeight: '700' },
    withdrawText: { color: colors.muted, fontSize: 12, fontWeight: '800' },

    loader: { marginTop: 24 },
    emptyNote: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 20, textAlign: 'center' },
  });
