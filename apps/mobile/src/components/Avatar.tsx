import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface AppAvatar {
  id: string;
  label: string;
  colors: readonly [string, string];
  initial: string;
}

/**
 * Built-in avatars, drawn natively rather than loaded as images.
 *
 * The web app uses inline SVG data URIs, which React Native's <Image> cannot
 * render without react-native-svg. These match the same palette so the two
 * clients stay visually consistent without adding a dependency.
 */
export const appAvatars: AppAvatar[] = [
  { id: 'violet', label: 'Violet', colors: ['#7c3aed', '#a78bfa'] as const, initial: 'V' },
  { id: 'coral', label: 'Coral', colors: ['#e11d48', '#fb7185'] as const, initial: 'C' },
  { id: 'teal', label: 'Teal', colors: ['#0f766e', '#2dd4bf'] as const, initial: 'T' },
  { id: 'amber', label: 'Amber', colors: ['#b45309', '#fbbf24'] as const, initial: 'A' },
  { id: 'indigo', label: 'Indigo', colors: ['#3730a3', '#818cf8'] as const, initial: 'I' },
  { id: 'forest', label: 'Forest', colors: ['#14532d', '#4ade80'] as const, initial: 'F' },
];

export const getAppAvatar = (avatarId?: string) =>
  appAvatars.find((avatar) => avatar.id === avatarId) ?? appAvatars[0];

export function Avatar({
  avatarId,
  size = 56,
  name,
  ring,
}: {
  avatarId?: string;
  size?: number;
  /** When given, the wearer's initials are shown instead of the palette letter. */
  name?: string;
  ring?: string;
}) {
  const avatar = getAppAvatar(avatarId);

  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : avatar.initial;

  return (
    <LinearGradient
      colors={avatar.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        ring ? { borderWidth: 3, borderColor: ring } : null,
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#ffffff', fontWeight: '800', letterSpacing: 0.5 },
});
