// Pure safety maths, kept free of React Native imports so it can be unit
// tested and reused by both the provider and any future worker.

export const MAX_INTERVAL_MINUTES = 48 * 60;
export const INTERVAL_PRESETS = [15, 30, 60, 120, 480, 1440, MAX_INTERVAL_MINUTES];

/**
 * Ceiling on how many elapsed deadlines a single reconciliation will record.
 * Without it, relaunching after a week on a 15-minute interval would post
 * hundreds of missed check-ins.
 */
export const MAX_RECONCILED_MISSES = 10;

export const BEHAVIOUR_PENALTY = 10;
/** Floor and ceiling on how much a single good check-in can earn back. */
export const BEHAVIOUR_RECOVERY_BASE = 4;
export const BEHAVIOUR_RECOVERY_MAX = 10;
/** Consecutive safe check-ins needed for each +1 of recovery. */
export const STREAK_STEP = 3;

export type RiskLevel = 'Low' | 'Medium' | 'High';

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/**
 * The part of the score model that reflects *current* conduct.
 *
 * `missedCount` is a lifetime total kept only for display. Risk is driven by
 * `recentMisses`, which decays as the user checks in reliably — otherwise a
 * single bad night would pin someone at High risk permanently, and there would
 * be no way for good behaviour to earn anything back.
 */
export interface ConductState {
  behaviorScore: number;
  recentMisses: number;
  safeStreak: number;
  missedCount: number;
}

export const initialConduct = (): ConductState => ({
  behaviorScore: 100,
  recentMisses: 0,
  safeStreak: 0,
  missedCount: 0,
});

/** Longer streaks of good behaviour earn back more per check-in, up to a cap. */
export function recoveryForStreak(safeStreak: number) {
  return Math.min(BEHAVIOUR_RECOVERY_MAX, BEHAVIOUR_RECOVERY_BASE + Math.floor(safeStreak / STREAK_STEP));
}

/** Applies a confirmed "I'm safe" check-in. */
export function applySafeCheckIn(state: ConductState): ConductState {
  const safeStreak = state.safeStreak + 1;
  return {
    behaviorScore: clamp(state.behaviorScore + recoveryForStreak(safeStreak)),
    // One good check-in forgives one recent miss.
    recentMisses: Math.max(0, state.recentMisses - 1),
    safeStreak,
    missedCount: state.missedCount,
  };
}

/** Applies one missed deadline. */
export function applyMissedCheckIn(state: ConductState): ConductState {
  return {
    behaviorScore: clamp(state.behaviorScore - BEHAVIOUR_PENALTY),
    recentMisses: state.recentMisses + 1,
    safeStreak: 0,
    missedCount: state.missedCount + 1,
  };
}

/** A reported false alert costs the same as a miss but is tracked separately. */
export function applyFalseAlert(state: ConductState): ConductState {
  return { ...state, behaviorScore: clamp(state.behaviorScore - BEHAVIOUR_PENALTY) };
}

export function computeRisk(recentMisses: number, fakeAlerts: number, behaviorScore: number) {
  const riskScore = clamp(
    Math.round(recentMisses * 18 + fakeAlerts * 12 + (100 - behaviorScore) * 0.35)
  );
  const riskLevel: RiskLevel = riskScore >= 70 ? 'High' : riskScore >= 35 ? 'Medium' : 'Low';
  return { riskScore, riskLevel };
}

export function formatMinutes(value: number) {
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export interface ReconcileInput {
  deadline: number;
  intervalMinutes: number;
  conduct: ConductState;
  now: number;
}

export interface ReconcileResult {
  deadline: number;
  conduct: ConductState;
  /** Deadlines that should be reported to the API as missed check-ins. */
  missedDeadlines: number[];
  /** Deadlines skipped past because the cap was hit. */
  skipped: number;
}

/**
 * Rolls a deadline forward over every interval that elapsed while the app was
 * closed or suspended, recording a missed check-in for each.
 */
export function reconcileDeadlines({ deadline, intervalMinutes, conduct, now }: ReconcileInput): ReconcileResult {
  const intervalMs = Math.max(1, intervalMinutes) * 60_000;

  let nextDeadline = deadline;
  let next = conduct;
  const missedDeadlines: number[] = [];

  while (nextDeadline <= now && missedDeadlines.length < MAX_RECONCILED_MISSES) {
    missedDeadlines.push(nextDeadline);
    next = applyMissedCheckIn(next);
    nextDeadline += intervalMs;
  }

  // Snap past any remaining backlog beyond the cap without recording each one.
  // floor(...) + 1 rather than ceil(...): when the backlog divides evenly, ceil
  // lands the deadline exactly on `now`, which immediately reads as missed
  // again and restarts the whole cycle.
  let skipped = 0;
  if (nextDeadline <= now) {
    skipped = Math.floor((now - nextDeadline) / intervalMs) + 1;
    nextDeadline += skipped * intervalMs;
  }

  return { deadline: nextDeadline, conduct: next, missedDeadlines, skipped };
}
