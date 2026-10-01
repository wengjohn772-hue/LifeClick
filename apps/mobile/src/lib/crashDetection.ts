// Impact and fall detection from raw accelerometer samples.
//
// Pure and free of React Native imports so it can be unit tested against
// synthetic traces — the alternative is "tune it on a real phone by throwing
// it", which is neither repeatable nor safe.
//
// Expo reports acceleration in g (1g = 9.81 m/s²) INCLUDING gravity, so a phone
// at rest reads a magnitude of about 1.0, not 0.

export type ImpactKind = 'impact' | 'crash' | 'fall';

export interface Sample {
  x: number;
  y: number;
  z: number;
  /** Milliseconds. */
  t: number;
}

export interface DetectorConfig {
  /** Above this, something hit something. A firm tap on a table is ~2g. */
  impactG: number;
  /** Vehicle collisions and serious falls land well above this. */
  crashG: number;
  /** Below this the device is in free fall (gravity no longer felt). */
  freeFallG: number;
  /** Free fall must last at least this long to count — filters out jitter. */
  freeFallMinMs: number;
  /** A fall's impact must follow its free fall within this window. */
  freeFallToImpactMs: number;
  /** After an impact, this much quiet suggests the person did not get up. */
  stillnessMs: number;
  /** Deviation from 1g that still counts as "not moving". */
  stillnessToleranceG: number;
  /** Ignore everything for this long after firing, so one event fires once. */
  refractoryMs: number;
}

export const DEFAULT_CONFIG: DetectorConfig = {
  impactG: 4.0,
  crashG: 8.0,
  freeFallG: 0.35,
  freeFallMinMs: 100,
  freeFallToImpactMs: 900,
  stillnessMs: 2500,
  stillnessToleranceG: 0.18,
  refractoryMs: 10_000,
};

export interface DetectedEvent {
  kind: ImpactKind;
  /** Highest magnitude seen during the event, in g. */
  peakG: number;
  at: number;
  /** True when the device went still afterwards — a person who did not get up. */
  followedByStillness: boolean;
}

export const magnitude = (s: Pick<Sample, 'x' | 'y' | 'z'>) => Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);

interface PendingImpact {
  kind: ImpactKind;
  peakG: number;
  at: number;
  stillSince: number | null;
}

/**
 * Streaming detector. Feed it samples in time order; it returns an event on the
 * sample that completes one, and null otherwise.
 *
 * An impact is only reported after the stillness window has elapsed, so the
 * `followedByStillness` flag is known at the moment the caller is told. A
 * crash-grade impact reports regardless of what follows, because waiting 2.5
 * seconds to raise a serious collision would be worse than a false positive.
 */
export class CrashDetector {
  private config: DetectorConfig;
  private freeFallStart: number | null = null;
  private freeFallEnd: number | null = null;
  private pending: PendingImpact | null = null;
  private lastFiredAt = -Infinity;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset() {
    this.freeFallStart = null;
    this.freeFallEnd = null;
    this.pending = null;
  }

  push(sample: Sample): DetectedEvent | null {
    const g = magnitude(sample);
    const now = sample.t;
    const c = this.config;

    // Resolve a pending impact once we know whether stillness followed.
    if (this.pending) {
      const quiet = Math.abs(g - 1) <= c.stillnessToleranceG;
      if (quiet) {
        if (this.pending.stillSince === null) this.pending.stillSince = now;
      } else {
        this.pending.stillSince = null;
      }

      const elapsed = now - this.pending.at;
      if (elapsed >= c.stillnessMs) {
        const event: DetectedEvent = {
          kind: this.pending.kind,
          peakG: this.pending.peakG,
          at: this.pending.at,
          followedByStillness:
            this.pending.stillSince !== null && now - this.pending.stillSince >= c.stillnessMs * 0.6,
        };
        this.pending = null;
        this.lastFiredAt = now;
        return event;
      }

      // Keep the peak up to date while we wait.
      if (g > this.pending.peakG) this.pending.peakG = g;
      return null;
    }

    if (now - this.lastFiredAt < c.refractoryMs) return null;

    // Track free fall, which is what distinguishes a fall from a knock.
    if (g <= c.freeFallG) {
      if (this.freeFallStart === null) this.freeFallStart = now;
      this.freeFallEnd = now;
      return null;
    }

    const hadFreeFall =
      this.freeFallStart !== null &&
      this.freeFallEnd !== null &&
      this.freeFallEnd - this.freeFallStart >= c.freeFallMinMs &&
      now - this.freeFallEnd <= c.freeFallToImpactMs;

    if (g >= c.crashG) {
      // Severe. Report at once rather than waiting out the stillness window.
      this.freeFallStart = null;
      this.freeFallEnd = null;
      this.lastFiredAt = now;
      return { kind: 'crash', peakG: g, at: now, followedByStillness: false };
    }

    if (g >= c.impactG) {
      this.pending = {
        kind: hadFreeFall ? 'fall' : 'impact',
        peakG: g,
        at: now,
        stillSince: null,
      };
      this.freeFallStart = null;
      this.freeFallEnd = null;
      return null;
    }

    // A free-fall window that never produced an impact is stale.
    if (this.freeFallEnd !== null && now - this.freeFallEnd > c.freeFallToImpactMs) {
      this.freeFallStart = null;
      this.freeFallEnd = null;
    }

    return null;
  }
}

/**
 * How much a confirmed (un-cancelled) event should raise the risk score.
 * A crash is treated as severe on its own; a knock that nobody responds to is
 * meaningful but not conclusive.
 */
export function riskWeightFor(event: Pick<DetectedEvent, 'kind' | 'followedByStillness'>) {
  if (event.kind === 'crash') return 45;
  if (event.kind === 'fall') return event.followedByStillness ? 35 : 20;
  return event.followedByStillness ? 20 : 10;
}

export function describeEvent(kind: ImpactKind) {
  if (kind === 'crash') return 'a possible collision';
  if (kind === 'fall') return 'a possible fall';
  return 'a heavy impact';
}
