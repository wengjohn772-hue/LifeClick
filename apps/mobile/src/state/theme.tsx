import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { StorageKeys, getItem, setItem } from '../lib/storage';
import {
  createShared,
  createTabBarStyles,
  gradients,
  palettes,
  type Palette,
  type SharedStyles,
  type ThemeMode,
} from '../theme';

/** 'system' follows the device; an explicit choice overrides it. */
export type ThemePreference = ThemeMode | 'system';

interface ThemeValue {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: Palette;
  shared: SharedStyles;
  tabBarStyles: ReturnType<typeof createTabBarStyles>;
  gradient: (typeof gradients)[ThemeMode];
  isDark: boolean;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void getItem(StorageKeys.theme).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void setItem(StorageKeys.theme, next);
  }, []);

  const mode: ThemeMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  // Toggling from 'system' commits to the opposite of what is currently shown,
  // rather than silently staying on system and appearing not to respond.
  const toggle = useCallback(() => {
    setPreference(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setPreference]);

  const value = useMemo<ThemeValue>(() => {
    const colors = palettes[mode];
    return {
      mode,
      preference,
      colors,
      shared: createShared(colors),
      tabBarStyles: createTabBarStyles(colors),
      gradient: gradients[mode],
      isDark: mode === 'dark',
      setPreference,
      toggle,
    };
  }, [mode, preference, setPreference, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider.');
  return context;
}
