import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field } from '../components/Field';
import { Metric } from '../components/Metric';
import { useSession } from '../state/session';
import { colors, shared } from '../theme';

// Peer presence is not yet a backend capability — connecting by FaF ID needs
// the Phase 3 escalation service. These are clearly labelled as a preview so
// the screen does not imply live tracking that is not happening.
const PREVIEW_FRIENDS = [
  { alias: 'Blue Kite', detail: '400 m · Safe' },
  { alias: 'Night Owl', detail: '2.1 km · Safe' },
  { alias: 'Red Lantern', detail: 'Last seen 6h ago' },
];

export function FafScreen() {
  const { user } = useSession();
  const [friendId, setFriendId] = useState('');
  const [connected, setConnected] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const connect = () => {
    const id = friendId.trim().toUpperCase();
    if (!id) return;

    if (user?.fafId && id === user.fafId.toUpperCase()) {
      setMessage('That is your own FaF ID.');
      return;
    }
    if (connected.includes(id)) {
      setMessage(`${id} is already in your circle.`);
      return;
    }

    setConnected((previous) => [...previous, id]);
    setFriendId('');
    setMessage(`${id} added to your circle on this device.`);
  };

  return (
    <ScrollView contentContainerStyle={shared.screenContent}>
      <Text style={shared.screenEyebrow}>Safety circle</Text>
      <Text style={shared.screenTitle}>Find a Friend</Text>
      <Text style={shared.screenSubtitle}>Connect by FaF ID to share live safety status.</Text>

      {user?.fafId ? (
        <View style={styles.idCard}>
          <Text style={shared.cardLabel}>YOUR FAF ID</Text>
          <Text style={styles.idValue}>{user.fafId}</Text>
          <Text style={shared.cardHint}>Share this with people you trust so they can connect to you.</Text>
        </View>
      ) : null}

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
          onPress={connect}
          disabled={!friendId.trim()}
          style={({ pressed }) => [
            shared.primaryButton,
            pressed && shared.pressed,
            !friendId.trim() && shared.disabled,
          ]}
        >
          <Text style={shared.primaryText}>Connect friend</Text>
        </Pressable>
        {message ? <Text style={shared.message}>{message}</Text> : null}
      </View>

      {connected.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Connected</Text>
          {connected.map((id) => (
            <Metric key={id} label={id} value="Pending sync" />
          ))}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Preview</Text>
      {PREVIEW_FRIENDS.map((friend) => (
        <Metric key={friend.alias} label={friend.alias} value={friend.detail} />
      ))}
      <Text style={styles.previewNote}>
        Sample data. Live friend status arrives with the shared safety service.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  idCard: {
    marginTop: 26,
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  idValue: { color: colors.inkStrong, fontSize: 28, fontWeight: '800', marginTop: 8, letterSpacing: 1 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 26,
    marginBottom: 4,
  },
  previewNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
});
