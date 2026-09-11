import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { StorageKeys, getJson, setJson } from '../lib/storage';
import { getCheckIns, getSettings, postCheckIn, updateSettings } from '../lib/api';
import { cancelCheckInReminder, notifyMissedCheckIn, scheduleCheckInReminder } from '../lib/notifications';
import {
  BEHAVIOUR_PENALTY,
  MAX_INTERVAL_MINUTES,
  computeRisk,
  reconcileDeadlines,
} from '../lib/scoring';
import type { RiskLevel } from '../lib/scoring';
import type { SafetySettings } from '../types';

export { MAX_INTERVAL_MINUTES, INTERVAL_PRESETS, formatMinutes, formatCountdown, computeRisk } from '../lib/scoring';

const DEFAULT_SETTINGS: SafetySettings = {
  checkInIntervalMinutes: 30,
  remindEnabled: true,
  remindBeforeMinutes: 5,
  notificationsEnabled: true,
  trackingEnabled: true,
};

interface PersistedSafety {
  deadline: number;
  intervalMinutes: number;
  missedCount: number;
  fakeAlerts: number;
  behaviorScore: number;
  lastCheckInAt: string | null;
}

interface SafetyValue {
  ready: boolean;
  settings: SafetySettings;
  deadline: number;
  remainingSeconds: number;
  missedCount: number;
  fakeAlerts: number;
  behaviorScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  lastCheckInAt: Date | null;
  checkIn: () => Promise<void>;
  reportFalseAlert: () => void;
  changeInterval: (minutes: number) => Promise<void>;
  changeSettings: (changes: Partial<SafetySettings>) => Promise<void>;
}

const SafetyContext = createContext<SafetyValue | null>(null);

export function SafetyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SafetySettings>(DEFAULT_SETTINGS);
  const [deadline, setDeadline] = useState(() => Date.now() + DEFAULT_SETTINGS.checkInIntervalMinutes * 60_000);
  const [missedCount, setMissedCount] = useState(0);
  const [fakeAlerts, setFakeAlerts] = useState(0);
  const [behaviorScore, setBehaviorScore] = useState(100);
  const [lastCheckInAt, setLastCheckInAt] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);

  // Mirrors of the latest values so the tick and AppState handler can read them
  // without being re-created on every state change.
  const stateRef = useRef({ deadline, missedCount, behaviorScore, settings, fakeAlerts, lastCheckInAt });
  stateRef.current = { deadline, missedCount, behaviorScore, settings, fakeAlerts, lastCheckInAt };

  const persist = useCallback((next: Partial<PersistedSafety>) => {
    const current = stateRef.current;
    void setJson(StorageKeys.safety, {
      deadline: next.deadline ?? current.deadline,
      intervalMinutes: next.intervalMinutes ?? current.settings.checkInIntervalMinutes,
      missedCount: next.missedCount ?? current.missedCount,
      fakeAlerts: next.fakeAlerts ?? current.fakeAlerts,
      behaviorScore: next.behaviorScore ?? current.behaviorScore,
      lastCheckInAt:
        next.lastCheckInAt !== undefined ? next.lastCheckInAt : current.lastCheckInAt?.toISOString() ?? null,
    } satisfies PersistedSafety);
  }, []);

  /** Applies reconcileDeadlines and reports each recovered miss to the API. */
  const reconcile = useCallback(
    (fromDeadline: number, intervalMinutes: number, startMissed: number, startBehavior: number) => {
      const result = reconcileDeadlines({
        deadline: fromDeadline,
        intervalMinutes,
        missedCount: startMissed,
        behaviorScore: startBehavior,
        now: Date.now(),
      });

      for (const missedAt of result.missedDeadlines) {
        void postCheckIn({
          status: 'missed',
          intervalMinutes,
          scheduledFor: new Date(missedAt).toISOString(),
        }).catch(() => undefined);
      }

      return result;
    },
    []
  );

  // Initial load: persisted local state first (so the timer is right even
  // offline), then reconciled against the server.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await getJson<PersistedSafety>(StorageKeys.safety);
      const remote = await getSettings().catch(() => null);
      if (cancelled) return;

      const resolvedSettings = remote?.settings ?? {
        ...DEFAULT_SETTINGS,
        checkInIntervalMinutes: stored?.intervalMinutes ?? DEFAULT_SETTINGS.checkInIntervalMinutes,
      };
      const interval = resolvedSettings.checkInIntervalMinutes;

      const result = reconcile(
        stored?.deadline ?? Date.now() + interval * 60_000,
        interval,
        stored?.missedCount ?? 0,
        stored?.behaviorScore ?? 100
      );
      if (cancelled) return;

      // Prefer the server's total when nothing was reconstructed locally, so a
      // reinstalled app does not start from a clean slate.
      let resolvedMissed = result.missedCount;
      if (result.missedDeadlines.length === 0) {
        const remoteCheckIns = await getCheckIns().catch(() => null);
        if (cancelled) return;
        if (typeof remoteCheckIns?.missedCount === 'number') {
          resolvedMissed = Math.max(result.missedCount, remoteCheckIns.missedCount);
        }
      }

      setSettings(resolvedSettings);
      setDeadline(result.deadline);
      setMissedCount(resolvedMissed);
      setBehaviorScore(result.behaviorScore);
      setFakeAlerts(stored?.fakeAlerts ?? 0);
      setLastCheckInAt(stored?.lastCheckInAt ? new Date(stored.lastCheckInAt) : null);
      setReady(true);

      persist({
        deadline: result.deadline,
        intervalMinutes: interval,
        missedCount: resolvedMissed,
        behaviorScore: result.behaviorScore,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [reconcile, persist]);

  // Countdown tick.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // A deadline passing while the app is open and in the foreground.
  //
  // Routed through the same capped reconciliation as relaunch rather than
  // advancing a single interval: the JS timer can be throttled while the screen
  // is off, so `now` may jump by hours. Stepping one interval per render would
  // spin through thousands of state updates and API posts to catch up.
  // reconcileDeadlines guarantees a strictly future deadline, so this runs once.
  useEffect(() => {
    if (!ready || now < deadline) return;

    const result = reconcile(deadline, settings.checkInIntervalMinutes, missedCount, behaviorScore);

    setDeadline(result.deadline);
    setMissedCount(result.missedCount);
    setBehaviorScore(result.behaviorScore);
    persist({
      deadline: result.deadline,
      missedCount: result.missedCount,
      behaviorScore: result.behaviorScore,
    });

    if (result.missedDeadlines.length > 0) {
      void notifyMissedCheckIn().catch(() => undefined);
    }
  }, [now, deadline, ready, settings.checkInIntervalMinutes, missedCount, behaviorScore, reconcile, persist]);

  // Re-reconcile on foreground: the OS may have suspended the JS timer for
  // hours, so the tick above cannot be relied on alone.
  useEffect(() => {
    if (!ready) return undefined;

    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;

      const current = stateRef.current;
      if (Date.now() < current.deadline) {
        setNow(Date.now());
        return;
      }

      const result = reconcile(
        current.deadline,
        current.settings.checkInIntervalMinutes,
        current.missedCount,
        current.behaviorScore
      );

      setDeadline(result.deadline);
      setMissedCount(result.missedCount);
      setBehaviorScore(result.behaviorScore);
      setNow(Date.now());
      persist({
        deadline: result.deadline,
        missedCount: result.missedCount,
        behaviorScore: result.behaviorScore,
      });
    });

    return () => subscription.remove();
  }, [ready, reconcile, persist]);

  // Keep the scheduled reminder aligned with the current deadline.
  useEffect(() => {
    if (!ready) return;
    if (!settings.remindEnabled || !settings.notificationsEnabled) {
      void cancelCheckInReminder();
      return;
    }
    void scheduleCheckInReminder(deadline, settings.remindBeforeMinutes).catch(() => undefined);
  }, [ready, deadline, settings.remindEnabled, settings.notificationsEnabled, settings.remindBeforeMinutes]);

  const checkIn = useCallback(async () => {
    const at = new Date();
    const nextDeadline = Date.now() + stateRef.current.settings.checkInIntervalMinutes * 60_000;

    setLastCheckInAt(at);
    setDeadline(nextDeadline);
    persist({ deadline: nextDeadline, lastCheckInAt: at.toISOString() });

    await postCheckIn({
      status: 'safe',
      intervalMinutes: stateRef.current.settings.checkInIntervalMinutes,
      scheduledFor: new Date(nextDeadline).toISOString(),
    }).catch(() => undefined);
  }, [persist]);

  const reportFalseAlert = useCallback(() => {
    const nextAlerts = stateRef.current.fakeAlerts + 1;
    const nextBehavior = Math.max(0, stateRef.current.behaviorScore - BEHAVIOUR_PENALTY);
    setFakeAlerts(nextAlerts);
    setBehaviorScore(nextBehavior);
    persist({ fakeAlerts: nextAlerts, behaviorScore: nextBehavior });
  }, [persist]);

  const changeSettings = useCallback(
    async (changes: Partial<SafetySettings>) => {
      setSettings((previous) => ({ ...previous, ...changes }));

      if (changes.checkInIntervalMinutes !== undefined) {
        const nextDeadline = Date.now() + changes.checkInIntervalMinutes * 60_000;
        setDeadline(nextDeadline);
        persist({ deadline: nextDeadline, intervalMinutes: changes.checkInIntervalMinutes });
      }

      const saved = await updateSettings(changes).catch(() => null);
      if (saved?.settings) setSettings(saved.settings);
    },
    [persist]
  );

  const changeInterval = useCallback(
    (minutes: number) => {
      const clamped = Math.min(MAX_INTERVAL_MINUTES, Math.max(5, Math.round(minutes)));
      return changeSettings({ checkInIntervalMinutes: clamped });
    },
    [changeSettings]
  );

  const remainingSeconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const { riskScore, riskLevel } = computeRisk(missedCount, fakeAlerts, behaviorScore);

  const value = useMemo<SafetyValue>(
    () => ({
      ready,
      settings,
      deadline,
      remainingSeconds,
      missedCount,
      fakeAlerts,
      behaviorScore,
      riskScore,
      riskLevel,
      lastCheckInAt,
      checkIn,
      reportFalseAlert,
      changeInterval,
      changeSettings,
    }),
    [
      ready, settings, deadline, remainingSeconds, missedCount, fakeAlerts, behaviorScore,
      riskScore, riskLevel, lastCheckInAt, checkIn, reportFalseAlert, changeInterval, changeSettings,
    ]
  );

  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
}

export function useSafety() {
  const context = useContext(SafetyContext);
  if (!context) throw new Error('useSafety must be used inside a SafetyProvider.');
  return context;
}
