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
import { RiskDashboard } from './pages/RiskDashboard';
import { CheckInRecord, TabId, Profile } from './types/app';
import { getGoogleAuthUrl, login, register, saveLocation } from './lib/api';

interface AppProps {
  initialTab?: TabId;
  initialTheme?: Theme;
}

type ScreenState = 'splash' | 'auth' | 'app';
type AuthMethod = 'google' | 'email';
type AuthMode = 'login' | 'register';

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
  trustedContacts: [],
};

function LogoPulse() {
  return (
    <div className="relative flex w-full max-w-[430px] items-center justify-center">
      <div className="absolute h-40 w-72 rounded-full bg-violet-200/35 blur-3xl" />
      <svg
        viewBox="0 70 455 100"
        role="img"
        aria-label="LifeClick"
        className="relative h-auto w-full drop-shadow-[0_10px_18px_rgba(76,29,149,0.18)]"
      >
        <text
          x="58"
          y="132"
          fill="#43205f"
          fontFamily="Trebuchet MS, Century Gothic, sans-serif"
          fontSize="70"
          fontWeight="700"
          letterSpacing="-3"
        >
          LifeClick
        </text>
        <path
          d="M17 151H164l12-1 9-17 10 48 12-76 13 45h166l10-16 8 20 10-12 9 10h17"
          fill="none"
          stroke="#43205f"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="30" cy="151" r="14" fill="white" stroke="#43205f" strokeWidth="4" />
        <circle cx="30" cy="151" r="5" fill="#43205f" />
        <path
          d="M431 110c-9 0-16 7-16 16 0 13 16 31 16 31s16-18 16-31c0-9-7-16-16-16Z"
          fill="white"
          stroke="#43205f"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="431" cy="126" r="5" fill="#43205f" />
      </svg>
    </div>
  );
}

export function App({ initialTab = 'map', initialTheme = 'light' }: AppProps) {
  const [active, setActive] = useState<TabId>(initialTab);
  const [screen, setScreen] = useState<ScreenState>('splash');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [trustedContactName, setTrustedContactName] = useState('');
  const [trustedContactPhone, setTrustedContactPhone] = useState('');
  const [trustedContactRelation, setTrustedContactRelation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [userId, setUserId] = useState<string | number>('demo-user');
  const [clickMinutes, setClickMinutes] = useState(30);
  const [remind, setRemind] = useState(true);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [missedClicks, setMissedClicks] = useState(0);
  const [fakeAlerts, setFakeAlerts] = useState(0);
  const [behaviorScore, setBehaviorScore] = useState(100);
  const [nextCheckInAt, setNextCheckInAt] = useState(() => Date.now() + 30 * 60 * 1000);
  const [sessionActive, setSessionActive] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<Date | null>(null);

  const handleCheckIn = (record: CheckInRecord) => {
    setCheckIns((previous) => [record, ...previous].slice(0, 5));
    setNextCheckInAt(Date.now() + clickMinutes * 60 * 1000);
  };

  useEffect(() => {
    if (!sessionActive || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(nextLocation);
        setLocationUpdatedAt(new Date());
        void saveLocation({ userId, ...nextLocation, status: 'live' }).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sessionActive, userId]);

  const handleFalseAlert = () => {
    setFakeAlerts((previous) => previous + 1);
    setBehaviorScore((previous) => Math.max(0, previous - 10));
  };

  useEffect(() => {
    if (!sessionActive) return undefined;
    const timer = window.setInterval(() => {
      if (Date.now() < nextCheckInAt) return;
      setBehaviorScore((previous) => Math.max(0, previous - 10));
      setMissedClicks((previous) => {
        if (previous === 0 && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('LifeClick check-in missed', { body: 'Please confirm you are safe.' });
        }
        return previous + 1;
      });
      setNextCheckInAt(Date.now() + clickMinutes * 60 * 1000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [clickMinutes, nextCheckInAt, sessionActive]);

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

      const contact = trustedContactName.trim() && trustedContactPhone.trim()
        ? [{ name: trustedContactName.trim(), phone: trustedContactPhone.trim(), relation: trustedContactRelation.trim() || 'Trusted contact' }]
        : [];
      const authData = authMode === 'register'
        ? await register({ name: fullName.trim(), email: loginPayload.email, password: loginPayload.password, phone: phone.trim(), address: address.trim(), trustedContacts: contact })
        : await login(loginPayload.email, loginPayload.password, authMethod);

      if (authData?.user) {
        setUserId(authData.user.id);
        setProfile((prev) => ({
          ...prev,
          email: authData.user.email || prev.email,
          name: authData.user.name || prev.name,
          phone: authData.user.phone || phone || prev.phone,
          address: authData.user.address || address || prev.address,
          fafId: authData.user.fafId || prev.fafId,
          trustedContacts: authMode === 'register' ? contact : prev.trustedContacts,
        }));
      }

      setSessionActive(true);
      setScreen('app');
    } catch (error) {
      console.error(error);
      setStatus('Permission check finished. You can continue in fallback mode.');
      setScreen('app');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = () => {
    setSessionActive(false);
    setLocation(null);
    setLocationUpdatedAt(null);
    setCheckIns([]);
    setMissedClicks(0);
    setFakeAlerts(0);
    setBehaviorScore(100);
    setNextCheckInAt(Date.now() + clickMinutes * 60 * 1000);
    setScreen('auth');
  };

  const handleGoogleAuth = () => {
    const authUrl = getGoogleAuthUrl();
    if (authUrl) {
      window.location.assign(authUrl);
      return;
    }
    setStatus('Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in.');
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
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_0%,_rgba(124,58,237,0.55),_transparent_42%),linear-gradient(145deg,_#050507_0%,_#160b26_52%,_#3b0764_100%)] px-5 py-6">
          <div className="w-full max-w-md rounded-[28px] border border-white/15 bg-black/35 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="mb-6 flex justify-center">
              <LogoPulse />
            </div>

            <div className="mb-5 text-center">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-violet-300">{authMode === 'login' ? 'Welcome back' : 'Join LifeClick'}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{authMode === 'login' ? 'LifeClick' : 'Create account'}</h2>
            </div>

            <div className="mb-4 flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-xs font-semibold text-violet-100">
              <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 rounded-full px-3 py-2 ${authMode === 'login' ? 'bg-white text-violet-900' : ''}`}>Sign in</button>
              <button type="button" onClick={() => setAuthMode('register')} className={`flex-1 rounded-full px-3 py-2 ${authMode === 'register' ? 'bg-white text-violet-900' : ''}`}>Create account</button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('google');
                  handleGoogleAuth();
                }}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                  authMethod === 'google'
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-white/15 bg-white/10 text-violet-100 hover:bg-white/15'
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
                    : 'border-white/15 bg-white/10 text-violet-100 hover:bg-white/15'
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
                {authMode === 'register' && (
                  <>
                    <label className="block text-sm font-medium text-violet-100">
                      Full name
                      <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" required className="mt-1 w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-violet-400 focus:bg-white/15" />
                    </label>
                    <label className="block text-sm font-medium text-violet-100">
                      Number
                      <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Your phone number" required className="mt-1 w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-violet-400 focus:bg-white/15" />
                    </label>
                    <label className="block text-sm font-medium text-violet-100">
                      Address
                      <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Your address" required rows={2} className="mt-1 w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-violet-400 focus:bg-white/15" />
                    </label>
                    <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Trusted contact</p>
                      <div className="mt-2 space-y-2">
                        <input value={trustedContactName} onChange={(event) => setTrustedContactName(event.target.value)} placeholder="Contact name" className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-violet-400" />
                        <input type="tel" value={trustedContactPhone} onChange={(event) => setTrustedContactPhone(event.target.value)} placeholder="Contact number" className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-violet-400" />
                        <input value={trustedContactRelation} onChange={(event) => setTrustedContactRelation(event.target.value)} placeholder="Relationship" className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-violet-400" />
                      </div>
                    </div>
                  </>
                )}
                <label className="block text-sm font-medium text-violet-100">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-white outline-none ring-0 transition placeholder:text-white/40 focus:border-violet-400 focus:bg-white/15"
                  />
                </label>

                <label className="block text-sm font-medium text-violet-100">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-white outline-none ring-0 transition placeholder:text-white/40 focus:border-violet-400 focus:bg-white/15"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Working…' : authMode === 'register' ? 'Create account' : 'Continue'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Globe className="h-4 w-4" />
                  {isSubmitting ? 'Connecting…' : authMode === 'register' ? 'Create with Google' : 'Continue with Google'}
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMethod('email')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-white/15"
                >
                  <Mail className="h-4 w-4" />
                  Use email instead
                </button>
              </div>
            )}

            <div className="mt-5 space-y-2 rounded-2xl border border-violet-300/20 bg-violet-400/10 p-3 text-xs text-violet-100">
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

            {status && <p className="mt-4 text-center text-xs text-violet-200/75">{status}</p>}
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
                {active === 'map' && <MapScreen location={location} updatedAt={locationUpdatedAt} />}
                {active === 'clicker' && <ClickerScreen clickMinutes={clickMinutes} remind={remind} nextCheckInAt={nextCheckInAt} onCheckIn={handleCheckIn} />}
                {active === 'faf' && <FafScreen />}
                {active === 'feeds' && <FeedsScreen />}
                {active === 'risk' && <RiskDashboard checkIns={checkIns} missedClicks={missedClicks} fakeAlerts={fakeAlerts} behaviorScore={behaviorScore} nextCheckInAt={nextCheckInAt} onFalseAlert={handleFalseAlert} />}
                {active === 'settings' && (
                  <SettingsScreen
                    profile={profile}
                    onProfileChange={setProfile}
                    clickMinutes={clickMinutes}
                    onClickMinutesChange={setClickMinutes}
                    remind={remind}
                    onRemindChange={setRemind}
                    onDisconnect={handleDisconnect}
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