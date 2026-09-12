import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Field } from '../components/Field';
import { GradientScreen } from '../components/GradientScreen';
import { Metric } from '../components/Metric';
import { useSession } from '../state/session';
import { INTERVAL_PRESETS, MAX_INTERVAL_MINUTES, formatMinutes, useSafety } from '../state/safety';
import { useTheme } from '../state/theme';
import type { ThemePreference } from '../state/theme';
import { addContact, deleteAccount, deleteContact, getContacts } from '../lib/api';
import { ProfileScreen } from './ProfileScreen';
import { SecurityScreen } from './SecurityScreen';
import type { Palette } from '../theme';
import type { TrustedContact } from '../types';

const THEME_OPTIONS: Array<{ id: ThemePreference; label: string; icon: string }> = [
  { id: 'light', label: 'Light', icon: '☀' },
  { id: 'dark', label: 'Dark', icon: '☾' },
  { id: 'system', label: 'Auto', icon: '◐' },
];

export function SettingsScreen({
  backgroundActive,
  locationMessage,
  onEnableBackground,
}: {
  backgroundActive: boolean;
  locationMessage: string;
  onEnableBackground: () => void;
}) {
  const { colors, shared, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, signOut, demoMode } = useSession();
  const { settings, changeInterval, changeSettings } = useSafety();

  const [pane, setPane] = useState<'settings' | 'profile' | 'security'>('settings');
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [contactError, setContactError] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const loadContacts = useCallback(async () => {
    const result = await getContacts().catch(() => null);
    if (result) setContacts(result.contacts);
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const onAddContact = async () => {
    setContactError('');
    if (!contactName.trim() || !contactPhone.trim()) {
      setContactError('A name and phone number are required.');
      return;
    }

    setSavingContact(true);
    try {
      await addContact({
        name: contactName.trim(),
        phone: contactPhone.trim(),
        relation: contactRelation.trim() || 'Trusted contact',
      });
      setContactName('');
      setContactPhone('');
      setContactRelation('');
      await loadContacts();
    } catch (error) {
      setContactError(error instanceof Error ? error.message : 'Could not save that contact.');
    } finally {
      setSavingContact(false);
    }
  };

  const onDeleteContact = (contact: TrustedContact) => {
    if (contact.id === undefined) return;
    Alert.alert('Remove contact', `Remove ${contact.name} from your trusted contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void deleteContact(contact.id as number).then(loadContacts).catch(() => undefined);
        },
      },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your LifeClick account, check-in history, location history, and trusted contacts. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteAccount();
              } finally {
                await signOut();
              }
            })();
          },
        },
      ]
    );
  };

  const adjustInterval = (delta: number) => {
    void changeInterval(Math.min(MAX_INTERVAL_MINUTES, Math.max(5, settings.checkInIntervalMinutes + delta)));
  };

  if (pane === 'profile') return <ProfileScreen onBack={() => setPane('settings')} />;
  if (pane === 'security') return <SecurityScreen onBack={() => setPane('settings')} />;

  return (
    <GradientScreen>
      <Text style={shared.screenEyebrow}>Account</Text>
      <Text style={shared.screenTitle}>Settings</Text>

      {/* Profile entry point */}
      <Pressable
        onPress={() => setPane('profile')}
        style={({ pressed }) => [styles.profileCard, pressed && shared.pressed]}
      >
        <Avatar avatarId={user?.avatarId} name={user?.name} size={56} />
        <View style={styles.profileMain}>
          <Text style={styles.profileName} numberOfLines={1}>
            {user?.name}
          </Text>
          <Text style={styles.profileDetail} numberOfLines={1}>
            {user?.email}
          </Text>
          <Text style={styles.profileFaf}>{user?.fafId ?? 'FaF ID pending'}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {demoMode ? <Text style={styles.demoBadge}>Demo session — not saved to a database</Text> : null}

      {/* Appearance */}
      <Text style={shared.sectionTitle}>Appearance</Text>
      <Text style={shared.sectionHint}>Auto follows your device&apos;s light or dark setting.</Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map((option) => {
          const active = preference === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setPreference(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentIcon, active && styles.segmentTextActive]}>{option.icon}</Text>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Check-in timing */}
      <Text style={shared.sectionTitle}>Set click time</Text>
      <Text style={shared.sectionHint}>
        How often you should tap &ldquo;I&apos;m safe&rdquo;. Miss it and your trusted contacts are alerted.
      </Text>

      <View style={styles.presetRow}>
        {INTERVAL_PRESETS.map((minutes) => {
          const active = settings.checkInIntervalMinutes === minutes;
          return (
            <Pressable
              key={minutes}
              onPress={() => void changeInterval(minutes)}
              style={[styles.preset, active && styles.presetActive]}
            >
              <Text style={[styles.presetText, active && styles.presetTextActive]}>{formatMinutes(minutes)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.stepperRow}>
        <Text style={styles.stepperLabel}>Custom interval</Text>
        <View style={styles.stepper}>
          <Pressable onPress={() => adjustInterval(-5)} accessibilityLabel="Decrease by 5 minutes" style={styles.stepButton}>
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{formatMinutes(settings.checkInIntervalMinutes)}</Text>
          <Pressable onPress={() => adjustInterval(5)} accessibilityLabel="Increase by 5 minutes" style={styles.stepButton}>
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{`Remind me ${settings.remindBeforeMinutes} minutes before`}</Text>
        <Switch
          value={settings.remindEnabled}
          onValueChange={(value) => void changeSettings({ remindEnabled: value })}
          trackColor={{ true: colors.brand, false: colors.switchTrackOff }}
          thumbColor={colors.surface}
        />
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Safety notifications</Text>
        <Switch
          value={settings.notificationsEnabled}
          onValueChange={(value) => void changeSettings({ notificationsEnabled: value })}
          trackColor={{ true: colors.brand, false: colors.switchTrackOff }}
          thumbColor={colors.surface}
        />
      </View>

      {/* Trusted contacts */}
      <Text style={shared.sectionTitle}>Trusted contacts</Text>
      <Text style={shared.sectionHint}>Up to five people who are alerted if you go quiet.</Text>

      {contacts.length === 0 ? (
        <Text style={styles.emptyContacts}>No trusted contacts yet.</Text>
      ) : (
        contacts.map((contact) => (
          <Pressable key={contact.id ?? contact.phone} onLongPress={() => onDeleteContact(contact)}>
            <Metric label={`${contact.name} · ${contact.relation}`} value={contact.phone} />
          </Pressable>
        ))
      )}
      {contacts.length > 0 ? <Text style={styles.hintSmall}>Long-press a contact to remove it.</Text> : null}

      {contacts.length < 5 ? (
        <View style={shared.formCard}>
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
          <Pressable
            onPress={onAddContact}
            disabled={savingContact}
            style={({ pressed }) => [shared.primaryButton, pressed && shared.pressed, savingContact && shared.disabled]}
          >
            <Text style={shared.primaryText}>{savingContact ? 'Saving…' : 'Add trusted contact'}</Text>
          </Pressable>
          {contactError ? <Text style={[shared.message, shared.errorMessage]}>{contactError}</Text> : null}
        </View>
      ) : null}

      {/* Monitoring */}
      <Text style={shared.sectionTitle}>Monitoring</Text>
      <Metric
        label="Background location"
        value={backgroundActive ? 'Active' : 'Off'}
        tone={backgroundActive ? colors.safe : colors.warn}
      />
      <Text style={styles.hintSmall}>{locationMessage}</Text>
      {!backgroundActive ? (
        <Pressable onPress={onEnableBackground} style={({ pressed }) => [styles.secondaryButton, pressed && shared.pressed]}>
          <Text style={styles.secondaryText}>Enable background monitoring</Text>
        </Pressable>
      ) : null}

      {/* Privacy */}
      <Text style={shared.sectionTitle}>Privacy &amp; security</Text>
      <Pressable
        onPress={() => setPane('security')}
        style={({ pressed }) => [styles.securityButton, pressed && shared.pressed]}
      >
        <View style={styles.securityMain}>
          <Text style={styles.securityTitle}>Security activity</Text>
          <Text style={styles.securitySub}>
            See every sign-in and network your account has been used from, and manage consent.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable onPress={() => void signOut()} style={({ pressed }) => [styles.logoutButton, pressed && shared.pressed]}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>

      <Pressable onPress={confirmDeleteAccount} style={styles.deleteAccount}>
        <Text style={styles.deleteAccountText}>Delete my account</Text>
      </Pressable>
    </GradientScreen>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginTop: 22,
      padding: 16,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    profileMain: { flex: 1 },
    profileName: { color: colors.inkStrong, fontSize: 18, fontWeight: '800' },
    profileDetail: { color: colors.body, fontSize: 13, marginTop: 3 },
    profileFaf: { color: colors.brand, fontSize: 12, fontWeight: '800', marginTop: 5, letterSpacing: 0.5 },
    chevron: { color: colors.brand, fontSize: 24, fontWeight: '700' },
    demoBadge: { color: colors.warn, fontSize: 12, fontWeight: '700', marginTop: 10 },

    segment: {
      flexDirection: 'row',
      marginTop: 14,
      padding: 4,
      borderRadius: 16,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.lineSoft,
    },
    segmentItem: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
      paddingVertical: 10,
      borderRadius: 12,
    },
    segmentItemActive: { backgroundColor: colors.brand },
    segmentIcon: { color: colors.body, fontSize: 16 },
    segmentText: { color: colors.body, fontSize: 12, fontWeight: '700' },
    segmentTextActive: { color: colors.onBrand },

    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    preset: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.brandSoft },
    presetActive: { backgroundColor: colors.brand },
    presetText: { color: colors.body, fontSize: 13, fontWeight: '700' },
    presetTextActive: { color: colors.onBrand },

    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.brandSoft,
    },
    stepperLabel: { color: colors.body, fontSize: 14 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    stepButtonText: { color: colors.inkStrong, fontSize: 20, fontWeight: '800', lineHeight: 22 },
    stepValue: { color: colors.inkStrong, fontSize: 14, fontWeight: '800', minWidth: 64, textAlign: 'center' },

    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    toggleLabel: { color: colors.body, fontSize: 15, flex: 1, paddingRight: 12 },

    emptyContacts: { color: colors.muted, fontSize: 14, marginTop: 14 },
    hintSmall: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 10 },

    secondaryButton: {
      marginTop: 14,
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.brand,
    },
    secondaryText: { color: colors.brand, fontWeight: '800', fontSize: 14 },

    securityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      padding: 16,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    securityMain: { flex: 1, paddingRight: 12 },
    securityTitle: { color: colors.inkStrong, fontSize: 15, fontWeight: '800' },
    securitySub: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },

    logoutButton: {
      alignItems: 'center',
      marginTop: 28,
      padding: 16,
      borderRadius: 15,
      backgroundColor: colors.dangerSoft,
    },
    logoutText: { color: colors.onDangerSoft, fontWeight: '800' },
    deleteAccount: { alignItems: 'center', marginTop: 14, padding: 8 },
    deleteAccountText: { color: colors.muted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  });
