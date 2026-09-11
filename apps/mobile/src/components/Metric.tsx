import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  label: { color: colors.body, fontSize: 15, flex: 1, paddingRight: 12 },
  value: { color: colors.inkStrong, fontWeight: '800', fontSize: 15, textAlign: 'right' },
});
