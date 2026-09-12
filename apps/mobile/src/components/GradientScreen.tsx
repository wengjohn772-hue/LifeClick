import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../state/theme';

/**
 * Every tab's backdrop. The gradient sits behind a transparent ScrollView so it
 * covers the full screen including the area under the bounce/overscroll, rather
 * than scrolling away with the content.
 */
export function GradientScreen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: object;
}) {
  const { colors, shared, gradient } = useTheme();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradient.screen}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[shared.screenContent, contentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1, backgroundColor: 'transparent' },
});
