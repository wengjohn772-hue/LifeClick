import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  SunIcon,
  MoonIcon,
  TimerIcon,
  MinusIcon,
  PlusIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  FingerprintIcon,
  HeadphonesIcon,
  MessageCircleIcon,
  MailIcon,
  PhoneIcon,
  ChevronRightIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { TrustedContactsSheet } from '../components/TrustedContactsSheet';
import { Profile } from '../types/app';
import { ProfileScreen } from './ProfileScreen';
import { getAppAvatar } from '../data/avatars';

const MAX_CLICK_MINUTES = 48 * 60;
const presets = [15, 30, 60, 120, 480, 1440, MAX_CLICK_MINUTES];

interface SettingsScreenProps {
  profile: Profile;
  onProfileChange: (next: Profile) => void;
  clickMinutes: number;
  onClickMinutesChange: (next: number) => void;
  remind: boolean;
  onRemindChange: (next: boolean) => void;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
        checked ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/15'
      }`}
    >
      <motion.span
        aria-hidden="true"
        animate={{ x: checked ? 22 : 3 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof TimerIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm shadow-violet-500/[0.04] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function SettingsScreen({
  profile,
  onProfileChange,
  clickMinutes,
  onClickMinutesChange,
  remind,
  onRemindChange,
}: SettingsScreenProps) {
  const { theme, toggleTheme } = useTheme();
  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'sms' | 'app'>('app');
  const [appLock, setAppLock] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const formatMinutes = (value: number) =>
    value >= 60 ? `${Math.floor(value / 60)}h${value % 60 ? ` ${value % 60}m` : ''}` : `${value}m`;

  if (profileOpen) {
    return <ProfileScreen profile={profile} onBack={() => setProfileOpen(false)} onUpdate={onProfileChange} />;
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-5 pt-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Settings</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Tune how the app watches over you.</p>
          </div>
          <div role="group" aria-label="Appearance" className="flex items-center gap-1 rounded-full border border-violet-200 bg-white p-1 dark:border-white/10 dark:bg-white/5">
            {(['light', 'dark'] as const).map((mode) => {
              const isActive = theme === mode;
              const Icon = mode === 'light' ? SunIcon : MoonIcon;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`${mode === 'light' ? 'Light' : 'Dark'} mode`}
                  onClick={() => {
                    if (!isActive) toggleTheme();
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    isActive ? 'bg-violet-700 text-white dark:bg-violet-500/20 dark:text-violet-300' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </header>

        <div className="rounded-3xl border border-violet-100 bg-gradient-to-r from-violet-100 to-white p-4 shadow-sm shadow-violet-500/[0.04] dark:border-violet-900/60 dark:from-violet-900/20 dark:to-slate-900/80">
          <div className="flex items-center gap-3">
            <img src={getAppAvatar(profile.avatarId).src} alt="App avatar" className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-slate-900 dark:text-white">{profile.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{profile.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="rounded-full bg-violet-700 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/20"
            >
              Manage profile
            </button>
          </div>
        </div>

        <Card title="Set click time" icon={TimerIcon}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            How often you should tap “I’m safe”. Miss it and your trusted contacts are alerted.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((minutes) => {
              const isActive = clickMinutes === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => onClickMinutesChange(minutes)}
                  aria-pressed={isActive}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    isActive ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                  }`}
                >
                  {formatMinutes(minutes)}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2.5 dark:bg-white/5">
            <span className="text-sm text-slate-600 dark:text-slate-300">Custom interval</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease interval by 5 minutes"
                onClick={() => onClickMinutesChange(Math.max(5, clickMinutes - 5))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition-colors duration-150 ease-out hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
              >
                <MinusIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-14 text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatMinutes(clickMinutes)}
              </span>
              <button
                type="button"
                aria-label="Increase interval by 5 minutes"
                onClick={() => onClickMinutesChange(Math.min(MAX_CLICK_MINUTES, clickMinutes + 5))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition-colors duration-150 ease-out hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
              >
                <PlusIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between px-1 py-1.5">
            <span className="text-sm text-slate-600 dark:text-slate-300">Remind me 5 minutes before</span>
            <Toggle checked={remind} onChange={onRemindChange} label="Remind me before check-in is due" />
          </div>
        </Card>

        <Card title="Double factor authentication" icon={KeyRoundIcon}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">Require a second step when signing in on a new device.</p>
            <Toggle checked={twoFactor} onChange={setTwoFactor} label="Double factor authentication" />
          </div>
          {twoFactor && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                { id: 'app', label: 'Authenticator app' },
                { id: 'sms', label: 'SMS code' },
              ] as const).map((method) => {
                const isActive = twoFactorMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setTwoFactorMethod(method.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      isActive
                        ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/10 dark:text-violet-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300'
                    }`}
                  >
                    {method.label}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Security / App lock" icon={LockKeyholeIcon}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Lock the app</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Ask for a 4-digit PIN on open.</p>
            </div>
            <Toggle checked={appLock} onChange={setAppLock} label="App lock" />
          </div>
          {appLock && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2.5 dark:bg-white/5">
                <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <FingerprintIcon className="h-4 w-4" aria-hidden="true" />
                  Unlock with biometrics
                </span>
                <Toggle checked={biometric} onChange={setBiometric} label="Unlock with biometrics" />
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 ease-out hover:text-violet-700 dark:text-slate-200 dark:hover:text-violet-300"
              >
                Change PIN
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </Card>

        <Card title="Customer care service" icon={HeadphonesIcon}>
          <ul className="divide-y divide-slate-100 dark:divide-white/10">
            {[
              { icon: MessageCircleIcon, label: 'Live chat', detail: 'Typically replies in 2 min' },
              { icon: PhoneIcon, label: 'Emergency hotline', detail: 'Available 24/7' },
              { icon: MailIcon, label: 'Email support', detail: 'help@safeapp.io' },
            ].map((row) => (
              <li key={row.label}>
                <button type="button" className="flex w-full items-center gap-3 py-2.5 text-left transition-colors duration-150 ease-out hover:text-violet-700 dark:hover:text-violet-300">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                    <row.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">{row.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{row.detail}</span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <button
          type="button"
          onClick={() => setContactsOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-violet-700 p-4 text-left transition-colors duration-150 ease-out hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white">
            <UsersRoundIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">Trusted Contacts</span>
            <span className="block text-xs text-white/70">3 people alerted if you go quiet</span>
          </span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-white/60" aria-hidden="true" />
        </button>
      </div>

      <TrustedContactsSheet open={contactsOpen} onClose={() => setContactsOpen(false)} />
    </div>
  );
}