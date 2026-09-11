import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

type FieldProps = ComponentProps<typeof TextInput> & { label: string; compact?: boolean };

export function Field({ label, compact, style, ...inputProps }: FieldProps) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor="#a9a0bc" style={[styles.input, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 15 },
  fieldCompact: { marginBottom: 10 },
  label: { color: '#443650', fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3dbea',
    backgroundColor: '#faf8fc',
    color: colors.ink,
    fontSize: 15,
  },
});
