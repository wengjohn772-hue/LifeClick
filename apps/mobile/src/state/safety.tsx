import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { StorageKeys, getJson, setJson } from '../lib/storage';
import { getCheckIns, getSettings, postCheckIn, updateSettings } from '../lib/api';
import { cancelCheckInReminder, notifyMissedCheckIn, scheduleCheckInReminder } from '../lib/notifications';
import {
  MAX_INTERVAL_MINUTES,
  applyFalseAlert,
  applySafeCheckIn,
  computeRisk,
  initialConduct,
  reconcileDeadlines,
  recoveryForStreak,
} from '../lib/scoring';
import type { ConductState, RiskLevel } from '../lib/scoring';
import type { SafetySettings } from '../types';

export {
  MAX_INTERVAL_MINUTES,
  INTERVAL_PRESETS,
  formatMinutes,
  formatCountdown,
  computeRisk,
} from '../lib/scoring';

const DEFAULT_SETTINGS: SafetySettings = {
  checkInIntervalMinutes: 30,
  remindEnabled: true,
  remindBeforeMinutes: 5,
  notificationsEnabled: true,
  trackingEnabled: true,
  monitoringEnabled: true,
};

interface PersistedSafety {
  deadline: number | null;
  intervalMinutes: number;
  fakeAlerts: number;
  lastCheckInAt: string | null;
  conduct: ConductState;
  monitoringEnabled: boolean;
}

interface SafetyValue {
  ready: boolean;
  settings: SafetySettings;
  /** Null when the timer is paused. */
  deadline: number | null;
  remainingSeconds: number;
  monitoringEnabled: boolean;
  missedCount: number;
  recentMisses: number;
  safeStreak: number;
  fakeAlerts: number;
  behaviorScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  /** What the next on-time check-in will earn back. */
  nextRecovery: number;
  lastCheckInAt: Date | null;
  checkIn: () => Promise<void>;
  reportFalseAlert: () => void;
  setMonitoringEnabled: (enabled: boolean) => Promise<void>;
  changeInterval: (minutes: number) => Promise<void>;
  changeSettings: (changes: Partial<SafetySettings>) => Promise<void>;
}

const SafetyContext = createContext<SafetyValue | null>(null);

export function SafetyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SafetySettings>(DEFAULT_SETTINGS);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [conduct, setConduct] = useState<ConductState>(initialConduct);
  const [fakeAlerts, setFakeAlerts] = useState(0);
  const [lastCheckInAt, setLastCheckInAt] = useState<Date | null>(null);
  const [monitoringEnabled, setMonitoringState] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);

  const stateRef = useRef({ deadline, conduct, settings, fakeAlerts, lastCheckInAt, monitoringEnabled });
  stateRef.current = { deadline, conduct, settings, fakeAlerts, lastCheckInAt, monitoringEnabled };

  const persist = useCallback((next: Partial<PersistedSafety>) => {
    const current = stateRef.current;
    void setJson(StorageKeys.safety, {
      deadline: next.deadline !== undefined ? next.deadline : current.deadline,
      intervalMinutes: next.intervalMinutes ?? current.settings.checkInIntervalMinutes,
      fakeAlerts: next.fakeAlerts ?? current.fakeAlerts,
      lastCheckInAt:
        next.lastCheckInAt !== undefined ? next.lastCheckInAt : current.lastCheckInAt?.toISOString() ?? null,
      conduct: next.conduct ?? current.conduct,
      monitoringEnabled: next.monitoringEnabled ?? current.monitoringEnabled,
    } satisfies PersistedSafety);
  }, []);

  /** Applies reconcileDeadlines and reports each recovered miss to the API. */
  const reconcile = useCallback((fromDeadline: number, intervalMinutes: number, from: ConductState) => {
    const result = reconcileDeadlines({
      deadline: fromDeadline,
      intervalMinutes,
      conduct: from,
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await getJson<PersistedSafety>(StorageKeys.safety);
      const remote = await getSettings().catch(() => null);
      if (cancelled) return;

      const resolvedSettings: SafetySettings = remote?.settings ?? {
        ...DEFAULT_SETTINGS,
        checkInIntervalMinutes: stored?.intervalMinutes ?? DEFAULT_SETTINGS.checkInIntervalMinutes,
      };
      const interval = resolvedSettings.checkInIntervalMinutes;
      const monitoring = resolvedSettings.monitoringEnabled ?? stored?.monitoringEnabled ?? true;

      let nextDeadline: number | null = null;
      let nextConduct = stored?.conduct ?? initialConduct();

      if (monitoring) {
        const result = reconcile(stored?.deadline ?? Date.now() + interval * 60_000, interval, nextConduct);
        if (cancelled) return;
        nextDeadline = result.deadline;
        nextConduct = result.conduct;

        // Prefer the server's lifetime total when nothing was reconstructed
        // locally, so a reinstalled app does not start from a clean slate.
        if (result.missedDeadlines.length === 0) {
          const remoteCheckIns = await getCheckIns().catch(() => null);
          if (cancelled) return;
          if (typeof remoteCheckIns?.missedCount === 'number') {
            nextConduct = { ...nextConduct, missedCount: Math.max(nextConduct.missedCount, remoteCheckIns.missedCount) };
          }
        }
      }

      setSettings(resolvedSettings);
      setMonitoringState(monitoring);
      setDeadline(nextDeadline);
      setConduct(nextConduct);
      setFakeAlerts(stored?.fakeAlerts ?? 0);
      setLastCheckInAt(stored?.lastCheckInAt ? new Date(stored.lastCheckInAt) : null);
      setReady(true);

      persist({ deadline: nextDeadline, intervalMinutes: interval, conduct: nextConduct, monitoringEnabled: monitoring });
    })();

    return () => {
      cancelled = true;
    };
  }, [reconcile, persist]);

  // Countdown tick. Skipped entirely while paused.
  useEffect(() => {
    if (!monitoringEnabled) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [monitoringEnabled]);

  // A deadline passing while the app is open and in the foreground. Routed
  // through the capped reconciliation, since the JS timer can be throttled for
  // hours while the screen is off.
  useEffect(() => {
    if (!ready || !monitoringEnabled || deadline === null || now < deadline) return;

    const result = reconcile(deadline, settings.checkInIntervalMinutes, conduct);
    setDeadline(result.deadline);
    setConduct(result.conduct);
    persist({ deadline: result.deadline, conduct: result.conduct });

    if (result.missedDeadlines.length > 0) void notifyMissedCheckIn().catch(() => undefined);
  }, [now, deadline, ready, monitoringEnabled, settings.checkInIntervalMinutes, conduct, reconcile, persist]);

  // Re-reconcile on foreground: the OS may have suspended the JS timer.
  useEffect(() => {
    if (!ready) return undefined;

    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      const current = stateRef.current;
      if (!current.monitoringEnabled || current.deadline === null) return;

      if (Date.now() < current.deadline) {
        setNow(Date.now());
        return;
      }

      const result = reconcile(current.deadline, current.settings.checkInIntervalMinutes, current.conduct);
      setDeadline(result.deadline);
      setConduct(result.conduct);
      setNow(Date.now());
      persist({ deadline: result.deadline, conduct: result.conduct });
    });

    return () => subscription.remove();
  }, [ready, reconcile, persist]);

  // Keep the scheduled reminder aligned with the current deadline.
  useEffect(() => {
    if (!ready) return;
    if (!monitoringEnabled || deadline === null || !settings.remindEnabled || !settings.notificationsEnabled) {
      void cancelCheckInReminder();
      return;
    }
    void scheduleCheckInReminder(deadline, settings.remindBeforeMinutes).catch(() => undefined);
  }, [
    ready, deadline, monitoringEnabled,
    settings.remindEnabled, settings.notificationsEnabled, settings.remindBeforeMinutes,
  ]);

  const checkIn = useCallback(async () => {
    const at = new Date();
    const interval = stateRef.current.settings.checkInIntervalMinutes;
    const nextDeadline = Date.now() + interval * 60_000;
    // Good behaviour earns score back rather than only ever being penalised.
    const nextConduct = applySafeCheckIn(stateRef.current.conduct);

    setLastCheckInAt(at);
    setDeadline(nextDeadline);
    setConduct(nextConduct);
    setMonitoringState(true);
    persist({ deadline: nextDeadline, lastCheckInAt: at.toISOString(), conduct: nextConduct, monitoringEnabled: true });

    await postCheckIn({
      status: 'safe',
      intervalMinutes: interval,
      scheduledFor: new Date(nextDeadline).toISOString(),
    }).catch(() => undefined);
  }, [persist]);

  const reportFalseAlert = useCallback(() => {
    const nextAlerts = stateRef.current.fakeAlerts + 1;
    const nextConduct = applyFalseAlert(stateRef.current.conduct);
    setFakeAlerts(nextAlerts);
    setConduct(nextConduct);
    persist({ fakeAlerts: nextAlerts, conduct: nextConduct });
  }, [persist]);

  /**
   * Pauses or resumes the check-in timer. Pausing clears the deadline locally
   * and tells the server to stop monitoring, so a deliberately paused user is
   * never escalated to their trusted contacts.
   */
  const setMonitoringEnabled = useCallback(
    async (enabled: boolean) => {
      const interval = stateRef.current.settings.checkInIntervalMinutes;
      const nextDeadline = enabled ? Date.now() + interval * 60_000 : null;

      setMonitoringState(enabled);
      setDeadline(nextDeadline);
      setSettings((previous) => ({ ...previous, monitoringEnabled: enabled }));
      persist({ deadline: nextDeadline, monitoringEnabled: enabled });
      if (!enabled) void cancelCheckInReminder();

      const saved = await updateSettings({ monitoringEnabled: enabled }).catch(() => null);
      if (saved?.settings) setSettings(saved.settings);
    },
    [persist]
  );

  const changeSettings = useCallback(
    async (changes: Partial<SafetySettings>) => {
      setSettings((previous) => ({ ...previous, ...changes }));

      if (changes.checkInIntervalMinutes !== undefined && stateRef.current.monitoringEnabled) {
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
    (minutes: number) => changeSettings({ checkInIntervalMinutes: Math.min(MAX_INTERVAL_MINUTES, Math.max(5, Math.round(minutes))) }),
    [changeSettings]
  );

  const remainingSeconds = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  const { riskScore, riskLevel } = computeRisk(conduct.recentMisses, fakeAlerts, conduct.behaviorScore);

  const value = useMemo<SafetyValue>(
    () => ({
      ready,
      settings,
      deadline,
      remainingSeconds,
      monitoringEnabled,
      missedCount: conduct.missedCount,
      recentMisses: conduct.recentMisses,
      safeStreak: conduct.safeStreak,
      fakeAlerts,
      behaviorScore: conduct.behaviorScore,
      riskScore,
      riskLevel,
      nextRecovery: recoveryForStreak(conduct.safeStreak + 1),
      lastCheckInAt,
      checkIn,
      reportFalseAlert,
      setMonitoringEnabled,
      changeInterval,
      changeSettings,
    }),
    [
      ready, settings, deadline, remainingSeconds, monitoringEnabled, conduct, fakeAlerts,
      riskScore, riskLevel, lastCheckInAt, checkIn, reportFalseAlert, setMonitoringEnabled,
      changeInterval, changeSettings,
    ]
  );

  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
}

export function useSafety() {
  const context = useContext(SafetyContext);
  if (!context) throw new Error('useSafety must be used inside a SafetyProvider.');
  return context;
}
