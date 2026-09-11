import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from './src/state/session';
import { SafetyProvider } from './src/state/safety';
import { AuthScreen } from './src/screens/AuthScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { MobileShell } from './src/screens/MobileShell';
import { colors } from './src/theme';

function Root() {
  const { user, restoring, consentCurrent, termsVersion, refreshConsent } = useSession();

  if (restoring) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.lilac} size="large" />
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  // Monitoring must not begin before the user has agreed to the current terms.
  // `null` means the check itself failed (offline), which is not the same as a
  // refusal — the app continues rather than locking the user out of a safety
  // tool because the network dropped.
  if (consentCurrent === false) {
    return <ConsentScreen termsVersion={termsVersion} onDone={() => void refreshConsent()} />;
  }

  // Safety state is scoped to the signed-in user so signing out discards the
  // timer, scores, and scheduled reminders rather than carrying them over.
  return (
    <SafetyProvider key={String(user.id)}>
      <MobileShell />
    </SafetyProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.night },
});
