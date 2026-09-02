import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authenticate, TrustedContact } from './lib/api';

type AuthMode = 'login' | 'register';

export default function App() {
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

  const submit = async () => {
    setMessage('');
    if (!email.trim() || !password.trim() || (mode === 'register' && (!name.trim() || !phone.trim() || !address.trim()))) {
      setMessage('Complete the required fields before continuing.');
      return;
    }

    const trustedContacts: TrustedContact[] = contactName.trim() && contactPhone.trim()
      ? [{ name: contactName.trim(), phone: contactPhone.trim(), relation: contactRelation.trim() || 'Trusted contact' }]
      : [];

    setBusy(true);
    try {
      const result = await authenticate({ mode, email: email.trim(), password, name: name.trim(), phone: phone.trim(), address: address.trim(), trustedContacts });
      setMessage(mode === 'register' && result.saved === false ? 'Account created for this session. Connect the production database to keep it permanently.' : `Welcome, ${result.user.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect to LifeClick.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.glow} />
          <View style={styles.brandRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.brand}>LifeClick</Text>
          </View>
          <Text style={styles.eyebrow}>{mode === 'login' ? 'Personal safety, made simple' : 'Build your safety circle'}</Text>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={styles.subtitle}>Your check-ins, trusted contacts, and safety signals in one protected place.</Text>

          <View style={styles.switcher}>
            {(['login', 'register'] as AuthMode[]).map((item) => (
              <Pressable key={item} onPress={() => { setMode(item); setMessage(''); }} style={[styles.switchButton, mode === item && styles.switchButtonActive]}>
                <Text style={[styles.switchText, mode === item && styles.switchTextActive]}>{item === 'login' ? 'Sign in' : 'Create account'}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.formCard}>
            {mode === 'register' && (
              <>
                <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" />
                <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="Your phone number" keyboardType="phone-pad" />
                <Field label="Address" value={address} onChangeText={setAddress} placeholder="Your address" multiline />
                <View style={styles.contactBlock}>
                  <Text style={styles.contactTitle}>Trusted contact (optional)</Text>
                  <Field label="Name" value={contactName} onChangeText={setContactName} placeholder="Contact name" compact />
                  <Field label="Phone" value={contactPhone} onChangeText={setContactPhone} placeholder="Contact number" keyboardType="phone-pad" compact />
                  <Field label="Relationship" value={contactRelation} onChangeText={setContactRelation} placeholder="Friend, family, colleague" compact />
                </View>
              </>
            )}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
            <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}>
              <Text style={styles.primaryText}>{busy ? 'Connecting...' : mode === 'login' ? 'Continue' : 'Create account'}</Text>
            </Pressable>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: ComponentProps<typeof TextInput> & { label: string; compact?: boolean }) {
  const { label, compact, ...inputProps } = props;
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor="#a9a0bc" style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#08050d' },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 44, paddingBottom: 48, backgroundColor: '#08050d' },
  glow: { position: 'absolute', top: -120, left: -80, width: 360, height: 360, borderRadius: 180, backgroundColor: '#39126b', opacity: 0.55 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 48 },
  pulseDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 4, borderColor: '#d8b4fe', backgroundColor: '#6d28d9' },
  brand: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  eyebrow: { color: '#c4b5fd', fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 },
  title: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: '#c8bfd3', fontSize: 15, lineHeight: 23, marginTop: 10, maxWidth: 350 },
  switcher: { flexDirection: 'row', marginTop: 28, padding: 4, borderRadius: 16, backgroundColor: '#1c1229', borderWidth: 1, borderColor: '#3b2750' },
  switchButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
  switchButtonActive: { backgroundColor: '#fff' },
  switchText: { color: '#d8cde3', fontSize: 14, fontWeight: '700' },
  switchTextActive: { color: '#351050' },
  formCard: { marginTop: 16, padding: 18, borderRadius: 24, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  field: { marginBottom: 15 },
  fieldCompact: { marginBottom: 10 },
  label: { color: '#443650', fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e3dbea', backgroundColor: '#faf8fc', color: '#24152e', fontSize: 15 },
  contactBlock: { marginBottom: 14, padding: 14, borderRadius: 17, backgroundColor: '#f4effb', borderWidth: 1, borderColor: '#e8dcf5' },
  contactTitle: { color: '#5b21b6', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4, borderRadius: 15, backgroundColor: '#6d28d9' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.84 },
  disabled: { opacity: 0.55 },
  message: { color: '#5b21b6', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 14 },
});
