import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientScreen } from '../components/GradientScreen';
import { PostCard } from '../components/PostCard';
import { ComposePostScreen } from './ComposePostScreen';
import { getFeedRegions, getFeeds } from '../lib/api';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';
import type { FeedPost, FeedRegion } from '../types';

interface Slice {
  key: string;
  label: string;
  country?: string;
  state?: string;
}

/** Flattens the region tree into the horizontal chip list. */
function buildSlices(regions: FeedRegion[]): Slice[] {
  const slices: Slice[] = [{ key: 'all', label: 'Everywhere' }];
  for (const region of regions) {
    slices.push({ key: `c:${region.country}`, label: region.country, country: region.country });
    for (const entry of region.states) {
      slices.push({
        key: `s:${region.country}:${entry.state}`,
        label: entry.state,
        country: region.country,
        state: entry.state,
      });
    }
  }
  return slices;
}

export function FeedsScreen() {
  const { colors, shared } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [regions, setRegions] = useState<FeedRegion[]>([]);
  const [slice, setSlice] = useState<Slice>({ key: 'all', label: 'Everywhere' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState('');

  const slices = useMemo(() => buildSlices(regions), [regions]);

  const load = useCallback(async (active: Slice) => {
    try {
      const result = await getFeeds({ country: active.country, state: active.state });
      setPosts(result.posts);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the community feed.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const regionResult = await getFeedRegions().catch(() => null);
      if (regionResult) setRegions(regionResult.regions);
      await load(slice);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only.
  }, []);

  const selectSlice = async (next: Slice) => {
    setSlice(next);
    setLoading(true);
    await load(next);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const regionResult = await getFeedRegions().catch(() => null);
    if (regionResult) setRegions(regionResult.regions);
    await load(slice);
    setRefreshing(false);
  }, [load, slice]);

  /** Replaces one post in place so a reaction does not reorder the list. */
  const updatePost = useCallback((next: FeedPost) => {
    setPosts((previous) => previous.map((post) => (post.id === next.id ? next : post)));
  }, []);

  if (composing) {
    return (
      <ComposePostScreen
        onClose={() => setComposing(false)}
        onPosted={(post) => {
          setComposing(false);
          // Show it immediately, then refresh so region chips pick it up.
          setPosts((previous) => [post, ...previous]);
          void onRefresh();
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <GradientScreen refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.content}>
        <Text style={shared.screenEyebrow}>Community safety</Text>
        <Text style={shared.screenTitle}>Feeds</Text>
        <Text style={shared.screenSubtitle}>Anonymous updates from around you.</Text>

        {/* Verification / guidelines notice */}
        <View style={styles.notice}>
          <View style={styles.noticeHeader}>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedIcon}>✓</Text>
            </View>
            <Text style={styles.noticeTitle}>Verified community feed</Text>
          </View>
          <Text style={styles.noticeBody}>
            Reports here are reviewed and must follow the community guidelines. Share only what you have seen
            yourself — posting fake news or misleading reports will result in a penalty.
          </Text>
        </View>

        {/* Location slicer */}
        {slices.length > 1 ? (
          <View style={styles.sliceWrap}>
            <Text style={styles.sliceLabel}>Filter by location</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sliceRow}
            >
              {slices.map((item) => {
                const active = item.key === slice.key;
                const isCountry = Boolean(item.country) && !item.state;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => void selectSlice(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.sliceChip,
                      isCountry && styles.sliceChipCountry,
                      active && styles.sliceChipActive,
                    ]}
                  >
                    <Text style={[styles.sliceChipText, active && styles.sliceChipTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

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
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nothing reported here yet</Text>
            <Text style={styles.emptyBody}>
              {slice.key === 'all'
                ? 'Be the first to share a safety update.'
                : `No reports from ${slice.label}. Try another location or post the first one.`}
            </Text>
          </View>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} onChange={updatePost} />)
        )}
      </GradientScreen>

      {/* Add post */}
      <Pressable
        onPress={() => setComposing(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a safety report"
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1 },
    // Leaves room so the floating button never covers the last post.
    content: { paddingBottom: 96 },

    notice: {
      marginTop: 22,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.lineSoft,
    },
    noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    verifiedBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand,
    },
    verifiedIcon: { color: colors.onBrand, fontSize: 11, fontWeight: '900' },
    noticeTitle: { color: colors.inkStrong, fontSize: 14, fontWeight: '800' },
    noticeBody: { color: colors.body, fontSize: 12, lineHeight: 18, marginTop: 8 },

    sliceWrap: { marginTop: 20 },
    sliceLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    sliceRow: { gap: 8, paddingRight: 8 },
    sliceChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    // Countries read as the group header for the states that follow.
    sliceChipCountry: { backgroundColor: colors.brandTint, borderColor: colors.lineSoft },
    sliceChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    sliceChipText: { color: colors.body, fontSize: 13, fontWeight: '700' },
    sliceChipTextActive: { color: colors.onBrand },

    loader: { marginTop: 40 },
    errorBox: { marginTop: 24, padding: 18, borderRadius: 18, backgroundColor: colors.dangerSoft },
    errorText: { color: colors.onDangerSoft, fontSize: 14, lineHeight: 20 },
    retry: { marginTop: 12, alignSelf: 'flex-start' },
    retryText: { color: colors.onDangerSoft, fontWeight: '800', fontSize: 14 },
    emptyBox: { marginTop: 40, alignItems: 'center', paddingHorizontal: 20 },
    emptyTitle: { color: colors.inkStrong, fontSize: 16, fontWeight: '800' },
    emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },

    fab: {
      position: 'absolute',
      right: 22,
      bottom: 22,
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand,
      shadowColor: colors.brand,
      shadowOpacity: 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    fabPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
    fabIcon: { color: colors.onBrand, fontSize: 32, fontWeight: '300', lineHeight: 36 },
  });
