import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { cancelImpact, getPendingImpact, reportImpact, syncSteps } from '../lib/api';
import { riskWeightFor, type DetectedEvent } from '../lib/crashDetection';
import { readStepHistory, startImpactMonitor, watchSteps, type MonitorHandle } from '../lib/sensors';
import { cancelImpactReminders, startImpactReminders, notifyImpactDetected } from '../lib/notifications';
import type { PendingImpact } from '../types';

interface SensorsValue {
  /** Null unless an impact is awaiting confirmation. */
  pending: PendingImpact | null;
  secondsRemaining: number;
  monitoring: boolean;
  unavailableReason: string | null;
  stepsToday: number;
  confirmSafe: () => Promise<void>;
  /** Simulates an impact so the alarm can be exercised without a real one. */
  simulate: (kind?: DetectedEvent['kind']) => Promise<void>;
}

const SensorsContext = createContext<SensorsValue | null>(null);

export function SensorsProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [pending, setPending] = useState<PendingImpact | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [stepsToday, setStepsToday] = useState(0);
  const monitor = useRef<MonitorHandle | null>(null);
  const stepWatcher = useRef<MonitorHandle | null>(null);
  const reporting = useRef(false);

  /** Opens the confirmation window, locally and on the server. */
  const raise = useCallback(async (event: DetectedEvent) => {
    // One at a time: a tumble produces several impacts in quick succession.
    if (reporting.current) return;
    reporting.current = true;

    try {
      const result = await reportImpact({
        kind: event.kind,
        peakG: Number(event.peakG.toFixed(2)),
        followedByStillness: event.followedByStillness,
        riskWeight: riskWeightFor(event),
      });

      setPending(result.event);
      setSecondsRemaining(result.event.secondsRemaining);
      await notifyImpactDetected(event.kind, result.event.secondsRemaining);
      await startImpactReminders(event.kind, result.event.secondsRemaining);
    } catch {
      // Offline: still show the alarm locally so the user can respond. The
      // server cannot escalate what it never received, which is the honest
      // failure mode — better than silently swallowing the detection.
      setPending({
        id: 'local',
        kind: event.kind,
        peakG: event.peakG,
        confirmDeadline: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      });
      setSecondsRemaining(120);
      await notifyImpactDetected(event.kind, 120).catch(() => undefined);
    } finally {
      reporting.current = false;
    }
  }, []);

  // Accelerometer monitoring, scoped to a signed-in, consented session.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    void (async () => {
      const handle = await startImpactMonitor((event) => void raise(event));
      if (cancelled) {
        handle?.stop();
        return;
      }
      monitor.current = handle;
      setMonitoring(Boolean(handle));
      if (!handle) setUnavailableReason('This device has no usable accelerometer.');
    })();

    return () => {
      cancelled = true;
      monitor.current?.stop();
      monitor.current = null;
      setMonitoring(false);
    };
  }, [enabled, raise]);

  // Restore a countdown that was running when the app was killed or reopened.
  useEffect(() => {
    if (!enabled) return undefined;

    const check = async () => {
      const result = await getPendingImpact().catch(() => null);
      if (!result) return;
      if (result.event) {
        setPending(result.event);
        setSecondsRemaining(result.event.secondsRemaining);
      } else {
        setPending(null);
      }
    };

    void check();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void check();
    });
    return () => subscription.remove();
  }, [enabled]);

  // Countdown tick.
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((new Date(pending.confirmDeadline).getTime() - Date.now()) / 1000));
      setSecondsRemaining(left);
      // The server escalates when the deadline passes; the screen stops
      // claiming otherwise rather than pretending it is still cancellable.
      if (left === 0) setPending(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [pending]);

  // Steps: history on iOS, live counting on Android where no history exists.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    void (async () => {
      const history = await readStepHistory();
      if (cancelled) return;

      if (history.historyAvailable && history.days.length) {
        setStepsToday(history.days[0]?.steps ?? 0);
        await syncSteps(history.days, 'ios').catch(() => undefined);
      } else if (history.available) {
        const handle = await watchSteps((steps) => setStepsToday(steps));
        if (cancelled) handle?.stop();
        else stepWatcher.current = handle;
      }
    })();

    return () => {
      cancelled = true;
      stepWatcher.current?.stop();
      stepWatcher.current = null;
    };
  }, [enabled]);

  // Android has no step history, so the running total is pushed up as it grows.
  useEffect(() => {
    if (!enabled || Platform.OS === 'ios' || stepsToday <= 0) return undefined;
    const timer = setTimeout(() => {
      void syncSteps([{ day: new Date().toISOString().slice(0, 10), steps: stepsToday }], 'android').catch(
        () => undefined
      );
    }, 30_000);
    return () => clearTimeout(timer);
  }, [enabled, stepsToday]);

  const confirmSafe = useCallback(async () => {
    const current = pending;
    setPending(null);
    setSecondsRemaining(0);
    await cancelImpactReminders();
    if (current && current.id !== 'local') await cancelImpact(current.id).catch(() => undefined);
  }, [pending]);

  const simulate = useCallback(
    async (kind: DetectedEvent['kind'] = 'crash') => {
      await raise({ kind, peakG: kind === 'crash' ? 11.2 : 5.4, at: Date.now(), followedByStillness: true });
    },
    [raise]
  );

  const value = useMemo<SensorsValue>(
    () => ({ pending, secondsRemaining, monitoring, unavailableReason, stepsToday, confirmSafe, simulate }),
    [pending, secondsRemaining, monitoring, unavailableReason, stepsToday, confirmSafe, simulate]
  );

  return <SensorsContext.Provider value={value}>{children}</SensorsContext.Provider>;
}

export function useSensors() {
  const context = useContext(SensorsContext);
  if (!context) throw new Error('useSensors must be used inside a SensorsProvider.');
  return context;
}
