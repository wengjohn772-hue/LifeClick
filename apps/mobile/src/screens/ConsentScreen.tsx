import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { saveConsent } from '../lib/api';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';
import type { ConsentChoices } from '../types';

/**
 * Shown before monitoring begins. LifeClick processes location, background
 * position, and IP addresses — none of which is lawful or honest to collect
 * without the user knowing specifically what they are agreeing to, so each
 * purpose is a separate switch rather than one blanket "I agree".
 */

interface Item {
  key: keyof ConsentChoices;
  title: string;
  body: string;
  required: boolean;
}

const ITEMS: Item[] = [
  {
    key: 'locationTracking',
    title: 'Location while using the app',
    body: 'Your position is recorded while LifeClick is open so your map is live and your trusted contacts can be told where you were last seen.',
    required: true,
  },
  {
    key: 'backgroundMonitoring',
    title: 'Location in the background',
    body: 'LifeClick keeps checking your position when the app is closed. This is what lets it notice you have gone quiet while your phone is in your pocket.',
    required: false,
  },
  {
    key: 'ipLogging',
    title: 'Sign-in and network activity',
    body: 'Your IP address and device are recorded on every request. This is how unrecognised sign-ins are spotted. You can review this log yourself in Settings.',
    required: true,
  },
  {
    key: 'contactEscalation',
    title: 'Alerting your trusted contacts',
    body: 'If you miss a check-in and do not respond, your trusted contacts are told you may need help, along with your last known location.',
    required: false,
  },
];

export function ConsentScreen({ termsVersion, onDone }: { termsVersion: string; onDone: () => void }) {
  const { colors, shared } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [choices, setChoices] = useState<ConsentChoices>({
    locationTracking: true,
    backgroundMonitoring: true,
    ipLogging: true,
    contactEscalation: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requiredAccepted = ITEMS.filter((item) => item.required).every((item) => choices[item.key]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await saveConsent({ ...choices, termsVersion });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your choices.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={shared.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Before we start</Text>
        <Text style={styles.title}>What LifeClick collects</Text>
        <Text style={styles.subtitle}>
          This is a safety app, so it handles sensitive data. Choose what you are comfortable with. You can change
          or withdraw any of this later in Settings.
        </Text>

        {ITEMS.map((item) => (
          <View key={item.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Switch
                value={choices[item.key]}
                onValueChange={(value) => setChoices((previous) => ({ ...previous, [item.key]: value }))}
                trackColor={{ true: colors.brand, false: '#4a3d5c' }}
                thumbColor={colors.surface}
              />
            </View>
            <Text style={styles.cardBody}>{item.body}</Text>
            {item.required ? (
              <Text style={styles.requiredTag}>Required for LifeClick to work</Text>
            ) : (
              <Text style={styles.optionalTag}>Optional — the app still works without it</Text>
            )}
          </View>
        ))}

        <Text style={styles.retention}>
          Location history is kept for 90 days, request logs for 30 days, and sign-in history for 180 days, then
          deleted automatically. Withdrawing consent stops monitoring and erases your location history immediately.
        </Text>

        <Pressable
          onPress={submit}
          disabled={busy || !requiredAccepted}
          style={({ pressed }) => [
            shared.primaryButton,
            styles.button,
            pressed && shared.pressed,
            (busy || !requiredAccepted) && shared.disabled,
          ]}
        >
          <Text style={shared.primaryText}>{busy ? 'Saving…' : 'Agree and continue'}</Text>
        </Pressable>

        {!requiredAccepted ? (
          <Text style={styles.blocked}>
            Location and sign-in logging are required — without them LifeClick cannot tell whether you are safe.
          </Text>
        ) : null}
        {error ? <Text style={[shared.message, shared.errorMessage]}>{error}</Text> : null}

        <Text style={styles.version}>Terms version {termsVersion}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, backgroundColor: colors.night, flexGrow: 1 },
  eyebrow: {
    color: colors.lilac,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.surface, fontSize: 30, fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#c8bfd3', fontSize: 15, lineHeight: 23, marginTop: 10 },
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: colors.nightLine,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: colors.surface, fontSize: 16, fontWeight: '800', flex: 1 },
  cardBody: { color: '#c8bfd3', fontSize: 14, lineHeight: 21, marginTop: 10 },
  requiredTag: { color: colors.lilac, fontSize: 11, fontWeight: '700', marginTop: 10 },
  optionalTag: { color: '#8e8197', fontSize: 11, fontWeight: '700', marginTop: 10 },
  retention: { color: '#9a8fa8', fontSize: 12, lineHeight: 19, marginTop: 20 },
  button: { marginTop: 22 },
  blocked: { color: '#fca5a5', fontSize: 13, lineHeight: 19, marginTop: 14, textAlign: 'center' },
  version: { color: '#6f6480', fontSize: 11, textAlign: 'center', marginTop: 20 },
  });
