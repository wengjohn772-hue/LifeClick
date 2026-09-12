import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, appAvatars } from '../components/Avatar';
import { Field } from '../components/Field';
import { GradientScreen } from '../components/GradientScreen';
import { PostCard } from '../components/PostCard';
import { deletePost, getMyPosts } from '../lib/api';
import { useSession } from '../state/session';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';
import type { FeedPost } from '../types';

type ProfileTab = 'details' | 'posts';

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { colors, shared, gradient } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, updateUser } = useSession();

  const [tab, setTab] = useState<ProfileTab>('details');

  /* ------------------------------------------------------------ details */

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [avatarId, setAvatarId] = useState(user?.avatarId ?? 'violet');
  const [role, setRole] = useState(user?.role ?? 'Member');
  const [postsEnabled, setPostsEnabled] = useState(user?.postsEnabled ?? true);
  const [feedsEnabled, setFeedsEnabled] = useState(user?.feedsEnabled ?? true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const dirty =
    name !== (user?.name ?? '') ||
    phone !== (user?.phone ?? '') ||
    address !== (user?.address ?? '') ||
    avatarId !== (user?.avatarId ?? 'violet') ||
    role !== (user?.role ?? 'Member') ||
    postsEnabled !== (user?.postsEnabled ?? true) ||
    feedsEnabled !== (user?.feedsEnabled ?? true);

  const save = async () => {
    if (!name.trim()) {
      setIsError(true);
      setMessage('Your name cannot be empty.');
      return;
    }

    setBusy(true);
    setMessage('');
    setIsError(false);
    try {
      await updateUser({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        avatarId,
        role: role.trim() || 'Member',
        postsEnabled,
        feedsEnabled,
      });
      setIsError(false);
      setMessage('Profile saved.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------------- posts */

  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    const result = await getMyPosts().catch(() => null);
    if (result) setMyPosts(result.posts);
    setPostsLoading(false);
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const updatePost = useCallback((next: FeedPost) => {
    setMyPosts((previous) => previous.map((post) => (post.id === next.id ? next : post)));
  }, []);

  const confirmDeletePost = (post: FeedPost) => {
    Alert.alert('Delete report?', 'This permanently removes your post from the community feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          // Removed immediately; a failure re-syncs from the server.
          setMyPosts((previous) => previous.filter((item) => item.id !== post.id));
          void deletePost(post.id).catch(() => void loadPosts());
        },
      },
    ]);
  };

  /* --------------------------------------------------------------- view */

  return (
    <GradientScreen>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
          <Text style={styles.backText}>‹ Settings</Text>
        </Pressable>
      </View>

      <Text style={shared.screenEyebrow}>Account</Text>
      <Text style={shared.screenTitle}>Profile</Text>

      <LinearGradient colors={gradient.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.identityCard}>
        <Avatar avatarId={avatarId} name={name} size={76} ring="rgba(255,255,255,0.55)" />
        <View style={styles.identityMain}>
          <Text style={styles.identityName} numberOfLines={1}>
            {name || 'Your name'}
          </Text>
          <Text style={styles.identityMeta} numberOfLines={1}>
            {user?.email}
          </Text>
          <View style={styles.fafPill}>
            <Text style={styles.fafText}>{user?.fafId ?? 'FaF ID pending'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabBar}>
        {(['details', 'posts'] as ProfileTab[]).map((item) => {
          const active = item === tab;
          return (
            <Pressable
              key={item}
              onPress={() => setTab(item)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {item === 'details' ? 'Details' : `My posts${myPosts.length ? ` (${myPosts.length})` : ''}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'posts' ? (
        postsLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.brand} />
        ) : myPosts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyBody}>
              Reports you share from the Feeds tab appear here. They stay anonymous to everyone else.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.postsHint}>
              Shown anonymously in the feed — this list is visible only to you.
            </Text>
            {myPosts.map((post) => (
              <PostCard key={post.id} post={post} onChange={updatePost} onDelete={confirmDeletePost} />
            ))}
          </>
        )
      ) : (
        <>
          <Text style={shared.sectionTitle}>Choose an avatar</Text>
          <Text style={shared.sectionHint}>Used across LifeClick. Nothing is uploaded.</Text>
          <View style={styles.avatarRow}>
            {appAvatars.map((avatar) => {
              const selected = avatar.id === avatarId;
              return (
                <Pressable
                  key={avatar.id}
                  onPress={() => setAvatarId(avatar.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Use the ${avatar.label} avatar`}
                  style={[
                    styles.avatarOption,
                    selected && { borderColor: colors.brand, backgroundColor: colors.brandTint },
                  ]}
                >
                  <Avatar avatarId={avatar.id} size={48} />
                  <Text style={[styles.avatarLabel, selected && { color: colors.brand, fontWeight: '800' }]}>
                    {avatar.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={shared.sectionTitle}>Your details</Text>
          <View style={shared.formCard}>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" />
            <Field label="Role" value={role} onChangeText={setRole} placeholder="Member" />
            <Field
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Your phone number"
              keyboardType="phone-pad"
            />
            <Field label="Address" value={address} onChangeText={setAddress} placeholder="Your address" multiline />

            <View style={styles.readOnly}>
              <Text style={styles.readOnlyLabel}>Email</Text>
              <Text style={styles.readOnlyValue}>{user?.email}</Text>
              <Text style={styles.readOnlyHint}>
                Your email is your sign-in identifier and cannot be changed here.
              </Text>
            </View>
          </View>

          <Text style={shared.sectionTitle}>Community</Text>
          <View style={styles.switchCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchMain}>
                <Text style={styles.switchTitle}>Post to Feeds</Text>
                <Text style={styles.switchHint}>Share anonymous safety reports with people nearby.</Text>
              </View>
              <Switch
                value={postsEnabled}
                onValueChange={setPostsEnabled}
                trackColor={{ true: colors.brand, false: colors.switchTrackOff }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={[styles.switchRow, styles.switchRowLast]}>
              <View style={styles.switchMain}>
                <Text style={styles.switchTitle}>Show Feeds</Text>
                <Text style={styles.switchHint}>See anonymous reports from your area.</Text>
              </View>
              <Switch
                value={feedsEnabled}
                onValueChange={setFeedsEnabled}
                trackColor={{ true: colors.brand, false: colors.switchTrackOff }}
                thumbColor={colors.surface}
              />
            </View>
          </View>

          <Pressable
            onPress={save}
            disabled={busy || !dirty}
            style={({ pressed }) => [
              shared.primaryButton,
              styles.saveButton,
              pressed && shared.pressed,
              (busy || !dirty) && shared.disabled,
            ]}
          >
            <Text style={shared.primaryText}>{busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</Text>
          </Pressable>

          {message ? <Text style={[shared.message, isError && shared.errorMessage]}>{message}</Text> : null}
        </>
      )}
    </GradientScreen>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    headerRow: { marginBottom: 12 },
    back: { alignSelf: 'flex-start' },
    backText: { color: colors.brand, fontSize: 15, fontWeight: '700' },

    identityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 22,
      padding: 20,
      borderRadius: 26,
      shadowColor: colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    identityMain: { flex: 1 },
    identityName: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
    identityMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 4 },
    fafPill: {
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    fafText: { color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },

    tabBar: {
      flexDirection: 'row',
      marginTop: 20,
      padding: 4,
      borderRadius: 16,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.lineSoft,
    },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12 },
    tabItemActive: { backgroundColor: colors.brand },
    tabText: { color: colors.body, fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: colors.onBrand, fontWeight: '800' },

    loader: { marginTop: 40 },
    postsHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 18 },
    emptyPosts: { marginTop: 40, alignItems: 'center', paddingHorizontal: 12 },
    emptyTitle: { color: colors.inkStrong, fontSize: 16, fontWeight: '800' },
    emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },

    avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
    avatarOption: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: 'transparent',
      width: '30.5%',
    },
    avatarLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },

    readOnly: {
      marginTop: 4,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.lineSoft,
    },
    readOnlyLabel: { color: colors.body, fontSize: 12, fontWeight: '700' },
    readOnlyValue: { color: colors.inkStrong, fontSize: 15, fontWeight: '700', marginTop: 5 },
    readOnlyHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },

    switchCard: {
      marginTop: 14,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: 16,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    switchRowLast: { borderBottomWidth: 0 },
    switchMain: { flex: 1 },
    switchTitle: { color: colors.inkStrong, fontSize: 15, fontWeight: '700' },
    switchHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },

    saveButton: { marginTop: 24 },
  });
