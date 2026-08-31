import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BellRing, Globe, Lock, Mail, ShieldCheck } from 'lucide-react';
import { ThemeProvider, Theme } from './contexts/ThemeContext';
import { TabBar } from './components/TabBar';
import { MapScreen } from './pages/MapScreen';
import { ClickerScreen } from './pages/ClickerScreen';
import { FafScreen } from './pages/FafScreen';
import { FeedsScreen } from './pages/FeedsScreen';
import { SettingsScreen } from './pages/SettingsScreen';
import { TabId, Profile } from './types/app';
import { login } from './lib/api';

interface AppProps {
  initialTab?: TabId;
  initialTheme?: Theme;
}

type ScreenState = 'splash' | 'auth' | 'app';
type AuthMethod = 'google' | 'email';

const defaultProfile: Profile = {
  name: 'Ava Brooks',
  fafId: 'FAF-2048',
  email: 'ava@lifeclick.app',
  phone: '+1 (415) 555-0147',
  address: '104 Cedar Lane, Austin, TX',
  avatarId: 'violet',
  role: 'Safety lead',
  postsEnabled: true,
  feedsEnabled: true,
};

function LogoPulse() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute h-40 w-40 rounded-full bg-violet-200/40 blur-2xl" />
      <div className="relative flex items-center gap-3 rounded-full border border-violet-300/60 bg-white/70 px-5 py-3 shadow-lg shadow-violet-500/10 backdrop-blur-md">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-lg font-bold text-white shadow-md shadow-violet-500/30">
          <span>❤</span>
        </div>
        <div className="text-4xl font-black tracking-tight text-violet-900">
          <span className="inline-block">Life</span>
          <span className="ml-1 inline-block text-violet-700">Click</span>
        </div>
      </div>
    </div>
  );
}

export function App({ initialTab = 'map', initialTheme = 'light' }: AppProps) {
  const [active, setActive] = useState<TabId>(initialTab);
  const [screen, setScreen] = useState<ScreenState>('splash');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [userId, setUserId] = useState<string | number>('demo-user');
  const [clickMinutes, setClickMinutes] = useState(30);
  const [remind, setRemind] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setScreen('auth'), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  const handleContinue = async () => {
    setIsSubmitting(true);
    setStatus('Checking permissions…');

    try {
      if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setStatus('Notifications enabled');
        } else {
          setStatus('Notifications can be enabled later from browser settings');
        }
      }

      if ('geolocation' in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            () => resolve(),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
          );
        });
      }

      const loginPayload = {
        email: email || 'ava@lifeclick.app',
        password: password || 'demo-pass',
        method: authMethod,
      };

      const authData = await login(loginPayload.email, loginPayload.password, authMethod);

      if (authData?.user) {
        setUserId(authData.user.id);
        setProfile((prev) => ({ ...prev, email: authData.user.email || prev.email, name: authData.user.name || prev.name }));
      }

      setScreen('app');
    } catch (error) {
      console.error(error);
      setStatus('Permission check finished. You can continue in fallback mode.');
      setScreen('app');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (screen === 'splash') {
    return (
      <ThemeProvider initialTheme={initialTheme}>
        <div className="flex h-full w-full items-center justify-center bg-[#f3f0f8] p-5">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="animate-[pulse_1.5s_ease-in-out_infinite]">
              <LogoPulse />
            </div>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-violet-200/80">
              <div className="h-full w-1/2 animate-[loading_1.3s_ease-in-out_infinite] rounded-full bg-violet-700" />
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (screen === 'auth') {
    return (
      <ThemeProvider initialTheme={initialTheme}>
        <div className="flex h-full w-full items-center justify-center bg-[#f6f3fa] px-5 py-6">
          <div className="w-full max-w-md rounded-[28px] border border-violet-200 bg-white p-6 shadow-[0_24px_60px_rgba(91,33,182,0.12)]">
            <div className="mb-6 flex justify-center">
              <LogoPulse />
            </div>

            <div className="mb-5 text-center">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-violet-500">Welcome back</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-violet-900">LifeClick</h2>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAuthMethod('google')}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                  authMethod === 'google'
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-violet-200 bg-violet-50 text-violet-700'
                }`}
              >
                <Globe className="h-4 w-4" />
                Google
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('email')}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                  authMethod === 'email'
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-violet-200 bg-violet-50 text-violet-700'
                }`}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
            </div>

            {authMethod === 'email' ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleContinue();
                }}
              >
                <label className="block text-sm font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-800 outline-none ring-0 transition focus:border-violet-500"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-800 outline-none ring-0 transition focus:border-violet-500"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Authenticating…' : 'Continue'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void handleContinue()}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Globe className="h-4 w-4" />
                  {isSubmitting ? 'Connecting…' : 'Continue with Google'}
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMethod('email')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  <Mail className="h-4 w-4" />
                  Use email instead
                </button>
              </div>
            )}

            <div className="mt-5 space-y-2 rounded-2xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-800">
              <div className="flex items-center gap-2">
                <BellRing className="h-3.5 w-3.5" />
                Notification permission is requested when you begin.
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Location access unlocks your real-time satellite pin.
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                Trusted contact alerts remain protected by your account.
              </div>
            </div>

            {status && <p className="mt-4 text-center text-xs text-slate-500">{status}</p>}
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <div className="flex h-full w-full flex-col bg-[#eef1f5] dark:bg-black">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden bg-slate-50 shadow-[0_30px_80px_rgba(20,17,24,0.15)] dark:bg-slate-950">
          <main
            id={`panel-${active}`}
            role="tabpanel"
            aria-labelledby={`tab-${active}`}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="flex flex-1 flex-col overflow-hidden"
              >
                {active === 'map' && <MapScreen userId={userId} />}
                {active === 'clicker' && <ClickerScreen clickMinutes={clickMinutes} remind={remind} />}
                {active === 'faf' && <FafScreen />}
                {active === 'feeds' && <FeedsScreen />}
                {active === 'settings' && (
                  <SettingsScreen
                    profile={profile}
                    onProfileChange={setProfile}
                    clickMinutes={clickMinutes}
                    onClickMinutesChange={setClickMinutes}
                    remind={remind}
                    onRemindChange={setRemind}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
          <TabBar active={active} onChange={setActive} />
        </div>
      </div>
    </ThemeProvider>
  );
}