import { Platform, StyleSheet } from 'react-native';

export type ThemeMode = 'light' | 'dark';

/**
 * Both palettes expose the same keys, so screens can style against semantic
 * roles (surface, body, line) and never branch on the active mode.
 */
export interface Palette {
  brand: string;
  brandDark: string;
  brandTint: string;
  brandSoft: string;
  onBrand: string;
  ink: string;
  inkStrong: string;
  body: string;
  muted: string;
  faint: string;
  line: string;
  lineSoft: string;
  surface: string;
  surfaceRaised: string;
  canvas: string;
  night: string;
  nightCard: string;
  nightLine: string;
  lilac: string;
  danger: string;
  dangerSoft: string;
  onDangerSoft: string;
  safe: string;
  safeSoft: string;
  warn: string;
  warnSoft: string;
  inputBg: string;
  inputBorder: string;
  switchTrackOff: string;
  overlay: string;
  shadow: string;
}

export const lightColors: Palette = {
  brand: '#6d28d9',
  brandDark: '#5b21b6',
  brandTint: '#f0e8ff',
  brandSoft: '#f4effb',
  onBrand: '#ffffff',
  ink: '#24152e',
  inkStrong: '#34104d',
  body: '#6d6174',
  muted: '#8e8197',
  faint: '#a99caf',
  line: '#e9def4',
  lineSoft: '#e8dcf5',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  canvas: '#f7f4fb',
  night: '#08050d',
  nightCard: '#1c1229',
  nightLine: '#3b2750',
  lilac: '#c4b5fd',
  danger: '#be123c',
  dangerSoft: '#fee2e2',
  onDangerSoft: '#9f1239',
  safe: '#047857',
  safeSoft: '#d1fae5',
  warn: '#b45309',
  warnSoft: '#fef3c7',
  inputBg: '#faf8fc',
  inputBorder: '#e3dbea',
  switchTrackOff: '#d6cde0',
  overlay: 'rgba(15, 23, 42, 0.78)',
  shadow: '#6d28d9',
};

export const darkColors: Palette = {
  brand: '#a78bfa',
  brandDark: '#c4b5fd',
  brandTint: '#2a1b3d',
  brandSoft: '#1f1530',
  onBrand: '#1a0f2b',
  ink: '#f4f1f8',
  inkStrong: '#ffffff',
  body: '#b9aecb',
  muted: '#8f84a3',
  faint: '#6f6483',
  line: '#2f2340',
  lineSoft: '#33254a',
  surface: '#181026',
  surfaceRaised: '#1f1533',
  canvas: '#0d0816',
  night: '#08050d',
  nightCard: '#1c1229',
  nightLine: '#3b2750',
  lilac: '#c4b5fd',
  danger: '#fb7185',
  dangerSoft: '#3d1220',
  onDangerSoft: '#fda4af',
  safe: '#34d399',
  safeSoft: '#0f2f26',
  warn: '#fbbf24',
  warnSoft: '#3a2a0c',
  inputBg: '#211733',
  inputBorder: '#3a2b52',
  switchTrackOff: '#3f3354',
  overlay: 'rgba(5, 2, 10, 0.82)',
  shadow: '#000000',
};

export const palettes: Record<ThemeMode, Palette> = { light: lightColors, dark: darkColors };

/** Screen backdrop gradients, per theme. Tuples satisfy LinearGradient's typing. */
export const gradients: Record<ThemeMode, { screen: readonly [string, string, string]; tabBar: readonly [string, string]; hero: readonly [string, string] }> = {
  light: {
    screen: ['#f7f4fb', '#efe9fa', '#e6dcf7'] as const,
    tabBar: ['#ffffff', '#f3ecfd'] as const,
    hero: ['#6d28d9', '#8b5cf6'] as const,
  },
  dark: {
    screen: ['#0d0816', '#140d24', '#1b1030'] as const,
    tabBar: ['#150e24', '#0d0816'] as const,
    hero: ['#4c1d95', '#6d28d9'] as const,
  },
};

export const riskColor = (score: number, colors: Palette) =>
  score >= 70 ? colors.danger : score >= 35 ? colors.warn : colors.safe;

export const riskSoftColor = (score: number, colors: Palette) =>
  score >= 70 ? colors.dangerSoft : score >= 35 ? colors.warnSoft : colors.safeSoft;

/**
 * Styles shared across more than one screen, rebuilt whenever the palette
 * changes. Screens get this from useTheme() rather than importing it directly.
 */
export const createShared = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.night },
    appSafe: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1 },
    appBody: { flex: 1 },
    screenContent: { flexGrow: 1, padding: 24, paddingTop: 28, paddingBottom: 28 },
    screenEyebrow: {
      color: colors.brand,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    screenTitle: { color: colors.ink, fontSize: 34, fontWeight: '800', marginTop: 5 },
    screenSubtitle: { color: colors.body, fontSize: 15, lineHeight: 23, marginTop: 8 },
    card: {
      marginTop: 26,
      padding: 22,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
    cardHint: { color: colors.body, fontSize: 13, lineHeight: 19, marginTop: 6 },
    formCard: {
      marginTop: 16,
      padding: 18,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      shadowColor: colors.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    primaryButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
      borderRadius: 15,
      backgroundColor: colors.brand,
    },
    primaryText: { color: colors.onBrand, fontSize: 16, fontWeight: '800' },
    pressed: { opacity: 0.84 },
    disabled: { opacity: 0.55 },
    message: {
      color: colors.brandDark,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 14,
    },
    errorMessage: { color: colors.danger },
    sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 28 },
    sectionHint: { color: colors.body, fontSize: 13, lineHeight: 19, marginTop: 6 },
  });

export type SharedStyles = ReturnType<typeof createShared>;

export const createTabBarStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      paddingHorizontal: 4,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 4 : 10,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 12 },
    tabActive: { backgroundColor: colors.brandTint },
    icon: { color: colors.faint, fontSize: 19 },
    iconActive: { color: colors.brand },
    label: { color: colors.muted, fontSize: 10, marginTop: 3 },
    labelActive: { color: colors.brand, fontWeight: '800' },
  });
