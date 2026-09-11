import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Field } from '../components/Field';
import { useSession } from '../state/session';
import { isLoopbackApi } from '../lib/api';
import { colors, shared } from '../theme';
import type { TrustedContact } from '../types';

type AuthMode = 'login' | 'register';

export function AuthScreen() {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const fail = (text: string) => {
    setIsError(true);
    setMessage(text);
  };

  const submit = async () => {
    setMessage('');
    setIsError(false);

    if (!email.trim() || !password.trim()) {
      fail('Enter your email and password to continue.');
      return;
    }
    if (mode === 'register') {
      if (!name.trim() || !phone.trim() || !address.trim()) {
        fail('Complete your name, phone number, and address.');
        return;
      }
      // Matches the server's minimum, so the failure is caught before a round trip.
      if (password.length < 8) {
        fail('Choose a password with at least 8 characters.');
        return;
      }
    }

    const trustedContacts: TrustedContact[] =
      contactName.trim() && contactPhone.trim()
        ? [
            {
              name: contactName.trim(),
              phone: contactPhone.trim(),
              relation: contactRelation.trim() || 'Trusted contact',
            },
          ]
        : [];

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn({ email: email.trim(), password });
      } else {
        await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          address: address.trim(),
          trustedContacts,
        });
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Unable to reach LifeClick.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={shared.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={shared.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.glow} />

          <View style={styles.brandRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.brand}>LifeClick</Text>
          </View>

          <Text style={styles.eyebrow}>
            {mode === 'login' ? 'Personal safety, made simple' : 'Build your safety circle'}
          </Text>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={styles.subtitle}>
            Your check-ins, trusted contacts, and safety signals in one protected place.
          </Text>

          <View style={styles.switcher}>
            {(['login', 'register'] as AuthMode[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setMode(item);
                  setMessage('');
                  setIsError(false);
                }}
                style={[styles.switchButton, mode === item && styles.switchButtonActive]}
              >
                <Text style={[styles.switchText, mode === item && styles.switchTextActive]}>
                  {item === 'login' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={shared.formCard}>
            {mode === 'register' && (
              <>
                <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" />
                <Field
                  label="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Your phone number"
                  keyboardType="phone-pad"
                />
                <Field
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Your address"
                  multiline
                />
                <View style={styles.contactBlock}>
                  <Text style={styles.contactTitle}>Trusted contact (optional)</Text>
                  <Field label="Name" value={contactName} onChangeText={setContactName} placeholder="Contact name" compact />
                  <Field
                    label="Phone"
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    placeholder="Contact number"
                    keyboardType="phone-pad"
                    compact
                  />
                  <Field
                    label="Relationship"
                    value={contactRelation}
                    onChangeText={setContactRelation}
                    placeholder="Friend, family, colleague"
                    compact
                  />
                </View>
              </>
            )}

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoCapitalize="none"
            />

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [shared.primaryButton, pressed && shared.pressed, busy && shared.disabled]}
            >
              <Text style={shared.primaryText}>
                {busy ? 'Connecting…' : mode === 'login' ? 'Continue' : 'Create account'}
              </Text>
            </Pressable>

            {message ? <Text style={[shared.message, isError && shared.errorMessage]}>{message}</Text> : null}
          </View>

          {isLoopbackApi ? (
            <Text style={styles.configHint}>
              This build points at {'\n'}localhost, which a physical device cannot reach. Set
              EXPO_PUBLIC_API_BASE_URL to your machine&apos;s LAN address or a deployed API.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingTop: 44, paddingBottom: 48, backgroundColor: colors.night },
  glow: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#39126b',
    opacity: 0.55,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 48 },
  pulseDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 4,
    borderColor: '#d8b4fe',
    backgroundColor: colors.brand,
  },
  brand: { color: colors.surface, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  eyebrow: {
    color: colors.lilac,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: { color: colors.surface, fontSize: 36, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: '#c8bfd3', fontSize: 15, lineHeight: 23, marginTop: 10, maxWidth: 350 },
  switcher: {
    flexDirection: 'row',
    marginTop: 28,
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: colors.nightLine,
  },
  switchButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
  switchButtonActive: { backgroundColor: colors.surface },
  switchText: { color: '#d8cde3', fontSize: 14, fontWeight: '700' },
  switchTextActive: { color: '#351050' },
  contactBlock: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 17,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: '#e8dcf5',
  },
  contactTitle: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  configHint: {
    marginTop: 20,
    color: '#c8bfd3',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
