import { useMemo } from 'react';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';

type FieldProps = ComponentProps<typeof TextInput> & { label: string; compact?: boolean };

export function Field({ label, compact, style, ...inputProps }: FieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor={colors.faint} style={[styles.input, style]} />
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    field: { marginBottom: 15 },
    fieldCompact: { marginBottom: 10 },
    label: { color: colors.body, fontSize: 12, fontWeight: '700', marginBottom: 7 },
    input: {
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.ink,
      fontSize: 15,
    },
  });
