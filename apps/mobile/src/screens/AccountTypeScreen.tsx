import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../state/theme';
import { palettes, type Brand, type Palette } from '../theme';

interface Option {
  brand: Brand;
  label: string;
  tagline: string;
  points: string[];
  swatch: readonly [string, string];
}

const OPTIONS: Option[] = [
  {
    brand: 'individual',
    label: 'Individual',
    tagline: 'Personal safety for you and the people who look out for you.',
    points: ['Check-in timer and reminders', 'Trusted contacts alerted if you go quiet', 'Community safety feed'],
    swatch: ['#6d28d9', '#8b5cf6'] as const,
  },
  {
    brand: 'business',
    label: 'Business',
    tagline: 'Lone-worker safety for your staff and sites.',
    points: ['Shift check-ins', 'Escalation to supervisors and duty managers', 'Trade site reports'],
    swatch: ['#b45309', '#f59e0b'] as const,
  },
];

/**
 * Shown once, before any account exists.
 *
 * The choice is recorded on the account at signup and never changes, because it
 * is the boundary the Business product will eventually be split along — an
 * account that belonged to both would have to be untangled row by row.
 */
export function AccountTypeScreen({ onChoose }: { onChoose: (brand: Brand) => void }) {
  const { mode } = useTheme();
  const styles = useMemo(() => createStyles(palettes.individual[mode]), [mode]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#08050d', '#160d22', '#241405']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.brandRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.brandName}>LifeClick</Text>
          </View>

          <Text style={styles.eyebrow}>Welcome</Text>
          <Text style={styles.title}>How will you use LifeClick?</Text>
          <Text style={styles.subtitle}>
            This sets up the right app for you. It is fixed once your account is created, so pick the one that
            matches how you will actually use it.
          </Text>

          {OPTIONS.map((option) => (
            <Pressable
              key={option.brand}
              onPress={() => onChoose(option.brand)}
              accessibilityRole="button"
              accessibilityLabel={`Continue as ${option.label}`}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <LinearGradient
                colors={option.swatch}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardAccent}
              />
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>{option.label}</Text>
                <Text style={styles.cardTagline}>{option.tagline}</Text>
                {option.points.map((point) => (
                  <View key={point} style={styles.pointRow}>
                    <View style={[styles.pointDot, { backgroundColor: option.swatch[1] }]} />
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
                <Text style={[styles.cardCta, { color: option.swatch[1] }]}>{`Continue as ${option.label}  ›`}</Text>
              </View>
            </Pressable>
          ))}

          <Text style={styles.footnote}>
            Need both? Create a separate account for each — they are kept apart on purpose.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#08050d' },
    safe: { flex: 1 },
    content: { padding: 24, paddingTop: 32, paddingBottom: 48, flexGrow: 1 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 36 },
    pulseDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 4,
      borderColor: '#d8b4fe',
      backgroundColor: colors.brand,
    },
    brandName: { color: '#ffffff', fontSize: 26, fontWeight: '800', letterSpacing: -1 },
    eyebrow: {
      color: '#c4b5fd',
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    title: { color: '#ffffff', fontSize: 32, fontWeight: '800', marginTop: 8, letterSpacing: -0.8 },
    subtitle: { color: '#c8bfd3', fontSize: 15, lineHeight: 23, marginTop: 10 },

    card: {
      flexDirection: 'row',
      marginTop: 20,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
    cardAccent: { width: 6 },
    cardBody: { flex: 1, padding: 20 },
    cardLabel: { color: '#ffffff', fontSize: 21, fontWeight: '800' },
    cardTagline: { color: '#c8bfd3', fontSize: 14, lineHeight: 20, marginTop: 6 },
    pointRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
    pointDot: { width: 6, height: 6, borderRadius: 3 },
    pointText: { color: '#ded5e8', fontSize: 13, flex: 1 },
    cardCta: { fontSize: 14, fontWeight: '800', marginTop: 16 },

    footnote: { color: '#9a8fa8', fontSize: 12, lineHeight: 18, marginTop: 26, textAlign: 'center' },
  });
