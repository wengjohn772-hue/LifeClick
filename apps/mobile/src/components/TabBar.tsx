import { Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../state/theme';
import type { Tab } from '../types';

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'checkin', icon: '✓', label: 'Check in' },
  { id: 'map', icon: '⌖', label: 'Map' },
  { id: 'faf', icon: '♙', label: 'FaF' },
  { id: 'feeds', icon: '▤', label: 'Feeds' },
  { id: 'safety', icon: '◉', label: 'Safety' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const { tabBarStyles: styles, gradient } = useTheme();

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
