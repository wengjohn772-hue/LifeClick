import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { StorageKeys, getItem, setItem } from '../lib/storage';
import { copyFor, type Copy } from '../copy';
import {
  createShared,
  createTabBarStyles,
  gradients,
  palettes,
  type Brand,
  type GradientSet,
  type Palette,
  type SharedStyles,
  type ThemeMode,
} from '../theme';

/** 'system' follows the device; an explicit choice overrides it. */
export type ThemePreference = ThemeMode | 'system';

interface ThemeValue {
  mode: ThemeMode;
  preference: ThemePreference;
  /** Which product's palette is active: violet for Individual, amber for Business. */
  brand: Brand;
  isBusiness: boolean;
  colors: Palette;
  shared: SharedStyles;
  tabBarStyles: ReturnType<typeof createTabBarStyles>;
  gradient: GradientSet;
  copy: Copy;
  isDark: boolean;
  setPreference: (next: ThemePreference) => void;
  setBrand: (next: Brand) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  // Set before sign-in by the product chooser, then re-asserted from the
  // account once a session exists, so the palette matches the account rather
  // than whatever was last picked on this device.
  const [brand, setBrandState] = useState<Brand>('individual');

  useEffect(() => {
    void getItem(StorageKeys.theme).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
    });
    void getItem(StorageKeys.brand).then((stored) => {
      if (stored === 'business' || stored === 'individual') setBrandState(stored);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void setItem(StorageKeys.theme, next);
  }, []);

  const setBrand = useCallback((next: Brand) => {
    setBrandState(next);
    void setItem(StorageKeys.brand, next);
  }, []);

  const mode: ThemeMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  // Toggling from 'system' commits to the opposite of what is currently shown,
  // rather than silently staying on system and appearing not to respond.
  const toggle = useCallback(() => {
    setPreference(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setPreference]);

  const value = useMemo<ThemeValue>(() => {
    const colors = palettes[brand][mode];
    return {
      mode,
      preference,
      brand,
      isBusiness: brand === 'business',
      colors,
      shared: createShared(colors),
      tabBarStyles: createTabBarStyles(colors),
      gradient: gradients[brand][mode],
      copy: copyFor(brand),
      isDark: mode === 'dark',
      setPreference,
      setBrand,
      toggle,
    };
  }, [brand, mode, preference, setPreference, setBrand, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider.');
  return context;
}

/** Convenience for screens that only need wording. */
export function useCopy() {
  return useTheme().copy;
}
