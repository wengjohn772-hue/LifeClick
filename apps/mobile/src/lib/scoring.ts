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

export type RiskLevel = 'Low' | 'Medium' | 'High';

/** Mirrors the web app's scoring so both clients report the same risk. */
export function computeRisk(missedCount: number, fakeAlerts: number, behaviorScore: number) {
  const riskScore = Math.min(
    100,
    Math.round(missedCount * 18 + fakeAlerts * 12 + (100 - behaviorScore) * 0.35)
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
  missedCount: number;
  behaviorScore: number;
  now: number;
}

export interface ReconcileResult {
  deadline: number;
  missedCount: number;
  behaviorScore: number;
  /** Deadlines that should be reported to the API as missed check-ins. */
  missedDeadlines: number[];
  /** Deadlines skipped past because the cap was hit. */
  skipped: number;
}

/**
 * Rolls a deadline forward over every interval that elapsed while the app was
 * closed or suspended, recording a missed check-in for each.
 *
 * The previous implementation simply reset the deadline on launch, so missed
 * check-ins disappeared and the behaviour score never moved.
 */
export function reconcileDeadlines({
  deadline,
  intervalMinutes,
  missedCount,
  behaviorScore,
  now,
}: ReconcileInput): ReconcileResult {
  const intervalMs = Math.max(1, intervalMinutes) * 60_000;

  let nextDeadline = deadline;
  let missed = missedCount;
  let behavior = behaviorScore;
  const missedDeadlines: number[] = [];

  while (nextDeadline <= now && missedDeadlines.length < MAX_RECONCILED_MISSES) {
    missedDeadlines.push(nextDeadline);
    missed += 1;
    behavior = Math.max(0, behavior - BEHAVIOUR_PENALTY);
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

  return { deadline: nextDeadline, missedCount: missed, behaviorScore: behavior, missedDeadlines, skipped };
}
