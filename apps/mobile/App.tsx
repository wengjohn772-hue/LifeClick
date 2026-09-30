import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from './src/state/session';
import { SafetyProvider } from './src/state/safety';
import { ThemeProvider, useTheme } from './src/state/theme';
import { StorageKeys, getItem } from './src/lib/storage';
import { AccountTypeScreen } from './src/screens/AccountTypeScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { MobileShell } from './src/screens/MobileShell';
import { BusinessShell } from './src/business/BusinessShell';

function Root() {
  const { user, restoring, consentCurrent, termsVersion, refreshConsent } = useSession();
  const { gradient, colors, setBrand, isBusiness } = useTheme();

  // Whether this device has ever picked a product. Undefined while loading, so
  // the chooser does not flash before the stored answer arrives.
  const [chosen, setChosen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    void getItem(StorageKeys.brand).then((stored) => setChosen(stored === 'business' || stored === 'individual'));
  }, []);

  // Once signed in, the account is the authority — not whatever was last picked
  // on this device. Signing into a business account on a phone that had chosen
  // Individual must still show the Business app.
  useEffect(() => {
    if (!user?.accountType) return;
    setBrand(user.accountType);
    setChosen(true);
  }, [user?.accountType, setBrand]);

  if (restoring || chosen === undefined) {
    return (
      <View style={styles.splash}>
        <LinearGradient
          colors={gradient.screen}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <StatusBar style="auto" />
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  // First run: pick a product before anything else.
  if (!user && !chosen) {
    return (
      <AccountTypeScreen
        onChoose={(brand) => {
          setBrand(brand);
          setChosen(true);
        }}
      />
    );
  }

  if (!user) return <AuthScreen onBack={() => setChosen(false)} />;

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
      {isBusiness ? <BusinessShell /> : <MobileShell />}
    </SafetyProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
