import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { reactToPost, resolveImageUrl } from '../lib/api';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';
import type { FeedPost } from '../types';

export const TAG_TONE = (colors: Palette): Record<string, string> => ({
  Alert: colors.danger,
  Resolved: colors.safe,
  Update: colors.brand,
  Notice: colors.muted,
});

/** Liked hearts are pink and reposts green, regardless of theme. */
export const LIKE_COLOR = '#ec4899';
export const REPOST_COLOR = '#16a34a';

export function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

export function PostCard({
  post,
  onChange,
  onDelete,
}: {
  post: FeedPost;
  onChange: (next: FeedPost) => void;
  onDelete?: (post: FeedPost) => void;
}) {
  const { colors, shared } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tone = TAG_TONE(colors)[post.tag] ?? colors.brand;
  const [pending, setPending] = useState<'like' | 'repost' | null>(null);

  const imageUri = resolveImageUrl(post.imageUrl);
  const place = [post.area, post.state, post.country].filter(Boolean).join(', ');

  /**
   * Applied optimistically so the tap feels instant, then reconciled with the
   * server's authoritative counts — and rolled back if the request fails.
   */
  const react = async (kind: 'like' | 'repost') => {
    if (pending) return;
    setPending(kind);

    const wasOn = kind === 'like' ? post.likedByMe : post.repostedByMe;
    const optimistic: FeedPost =
      kind === 'like'
        ? { ...post, likedByMe: !wasOn, likes: Math.max(0, post.likes + (wasOn ? -1 : 1)) }
        : { ...post, repostedByMe: !wasOn, reposts: Math.max(0, post.reposts + (wasOn ? -1 : 1)) };
    onChange(optimistic);

    try {
      const result = await reactToPost(post.id, kind);
      onChange({
        ...post,
        likes: result.likes,
        reposts: result.reposts,
        likedByMe: result.likedByMe,
        repostedByMe: result.repostedByMe,
      });
    } catch {
      onChange(post); // Roll back to the pre-tap state.
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: tone }]}>
          <Text style={styles.avatarText}>{post.userId.slice(-2)}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.handle}>{post.userId}</Text>
          <Text style={styles.place} numberOfLines={1}>
            {[place, relativeTime(post.createdAt)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={[styles.tagPill, { backgroundColor: `${tone}22` }]}>
          <Text style={[styles.tagText, { color: tone }]}>{post.tag}</Text>
        </View>
      </View>

      <Text style={styles.body}>{post.body}</Text>

      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          contentFit="cover"
          transition={180}
          accessibilityLabel="Photo attached to this report"
        />
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => void react('like')}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel={post.likedByMe ? 'Remove your like' : 'Like this report'}
          accessibilityState={{ selected: post.likedByMe }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionButton,
            post.likedByMe && { backgroundColor: `${LIKE_COLOR}1f` },
            pressed && shared.pressed,
          ]}
        >
          <Text style={[styles.actionIcon, post.likedByMe && { color: LIKE_COLOR }]}>
            {post.likedByMe ? '♥' : '♡'}
          </Text>
          <Text style={[styles.actionCount, post.likedByMe && { color: LIKE_COLOR, fontWeight: '800' }]}>
            {post.likes}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void react('repost')}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel={post.repostedByMe ? 'Undo your repost' : 'Repost this report'}
          accessibilityState={{ selected: post.repostedByMe }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionButton,
            post.repostedByMe && { backgroundColor: `${REPOST_COLOR}1f` },
            pressed && shared.pressed,
          ]}
        >
          <Text style={[styles.actionIcon, post.repostedByMe && { color: REPOST_COLOR }]}>↻</Text>
          <Text style={[styles.actionCount, post.repostedByMe && { color: REPOST_COLOR, fontWeight: '800' }]}>
            {post.reposts}
          </Text>
        </Pressable>

        <View style={styles.spacer} />

        {post.mine && onDelete ? (
          <Pressable onPress={() => onDelete(post)} hitSlop={8} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        ) : post.mine ? (
          <View style={[styles.tagPill, { backgroundColor: colors.brandTint }]}>
            <Text style={[styles.tagText, { color: colors.brand }]}>Yours</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      marginTop: 14,
      padding: 16,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    header: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    meta: { flex: 1, marginLeft: 10 },
    handle: { color: colors.inkStrong, fontSize: 13, fontWeight: '800' },
    place: { color: colors.muted, fontSize: 11, marginTop: 3 },
    tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    tagText: { fontSize: 11, fontWeight: '800' },
    body: { color: colors.body, fontSize: 15, lineHeight: 22, marginTop: 14 },
    image: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: 16,
      marginTop: 14,
      backgroundColor: colors.brandSoft,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.brandSoft,
    },
    actionIcon: { color: colors.muted, fontSize: 15 },
    actionCount: { color: colors.muted, fontSize: 13, fontWeight: '700' },
    spacer: { flex: 1 },
    deleteButton: { paddingHorizontal: 10, paddingVertical: 6 },
    deleteText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  });
