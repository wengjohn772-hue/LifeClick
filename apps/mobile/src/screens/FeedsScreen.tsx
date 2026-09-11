import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getFeeds } from '../lib/api';
import { colors, shared } from '../theme';
import type { FeedPost } from '../types';

function relativeTime(iso: string) {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

const TAG_TONE: Record<string, string> = {
  Alert: colors.danger,
  Resolved: colors.safe,
  Update: colors.brand,
  Notice: colors.muted,
};

export function FeedsScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await getFeeds();
      setPosts(result.posts);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the community feed.');
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={shared.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <Text style={shared.screenEyebrow}>Community safety</Text>
      <Text style={shared.screenTitle}>Feeds</Text>
      <Text style={shared.screenSubtitle}>Anonymous updates from around the city.</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : posts.length === 0 ? (
        <Text style={styles.empty}>No reports have been shared yet.</Text>
      ) : (
        posts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{post.userId.slice(-2)}</Text>
              </View>
              <View style={styles.postMeta}>
                <Text style={styles.postUser}>{post.userId}</Text>
                <Text style={styles.postArea}>
                  {[post.area, relativeTime(post.createdAt)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={[styles.postTag, { color: TAG_TONE[post.tag] ?? colors.brand }]}>{post.tag}</Text>
            </View>
            <Text style={styles.postBody}>{post.body}</Text>
            <View style={styles.postActions}>
              <Text style={styles.actionText}>{`♡ ${post.likes}`}</Text>
              <Text style={styles.actionText}>{`↻ ${post.reposts}`}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  empty: { color: colors.muted, fontSize: 14, marginTop: 32, textAlign: 'center' },
  errorBox: { marginTop: 28, padding: 18, borderRadius: 18, backgroundColor: colors.dangerSoft },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  retry: { marginTop: 12, alignSelf: 'flex-start' },
  retryText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
  postCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  avatarText: { color: colors.surface, fontSize: 11, fontWeight: '800' },
  postMeta: { flex: 1, marginLeft: 10 },
  postUser: { color: colors.inkStrong, fontSize: 13, fontWeight: '800' },
  postArea: { color: colors.muted, fontSize: 11, marginTop: 3 },
  postTag: { fontSize: 11, fontWeight: '800' },
  postBody: { color: '#55495d', fontSize: 15, lineHeight: 22, marginTop: 14 },
  postActions: { flexDirection: 'row', gap: 20, marginTop: 14 },
  actionText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
});
