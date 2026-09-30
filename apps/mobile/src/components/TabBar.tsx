import { Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../state/theme';
import type { Tab } from '../types';

const TAB_ICONS: Array<{ id: Tab; icon: string }> = [
  { id: 'checkin', icon: '✓' },
  { id: 'map', icon: '⌖' },
  { id: 'faf', icon: '♙' },
  { id: 'feeds', icon: '▤' },
  { id: 'safety', icon: '◉' },
  { id: 'settings', icon: '⚙' },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const { tabBarStyles: styles, gradient, copy } = useTheme();
  // Labels come from the active product: 'Check in' vs 'Shift', 'Feeds' vs 'Reports'.
  const TABS = TAB_ICONS.map((tab) => ({ ...tab, label: copy.tabs[tab.id] }));

  return (
    <LinearGradient
      colors={gradient.tabBar}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.bar}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </LinearGradient>
  );
}
