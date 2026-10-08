import crypto from 'node:crypto';
import { query } from '../db/pool.js';

/**
 * Mutual exclusion for scheduled jobs across every serverless instance.
 *
 * The safety sweep alerts people's emergency contacts. Two overlapping runs
 * would alert them twice for one incident, so the sweep must be single-flight
 * cluster-wide — not merely idempotent per row.
 */

/**
 * Claims `name` for at most `ttlSeconds`.
 *
 * Returns the holder token on success, or null when another run holds it. The
 * TTL is a crash guard: a run killed mid-flight (a serverless timeout, say)
 * never releases its lease, so the lease has to expire on its own. Keep the
 * TTL below the calling cadence or a crashed run blocks the following one.
 */
export async function acquireLease(name, ttlSeconds) {
  const holder = `${process.env.VERCEL_REGION || 'local'}-${crypto.randomUUID().slice(0, 8)}`;

  const { rows } = await query(
    `INSERT INTO job_leases (name, locked_until, holder, last_started_at, run_count)
     VALUES ($1, NOW() + make_interval(secs => $2::int), $3::varchar, NOW(), 1)
     ON CONFLICT (name) DO UPDATE
       SET locked_until = NOW() + make_interval(secs => $2::int),
           holder = $3::varchar,
           last_started_at = NOW(),
           run_count = job_leases.run_count + 1
       WHERE job_leases.locked_until <= NOW()
     RETURNING holder`,
    [name, ttlSeconds, holder]
  );

  // No row means the ON CONFLICT guard rejected the update: someone else holds
  // an unexpired lease.
  if (!rows.length) {
    await query(`UPDATE job_leases SET skip_count = skip_count + 1 WHERE name = $1`, [name]).catch(
      () => undefined
    );
    return null;
  }

  return rows[0].holder;
}

/**
 * Releases the lease and records the outcome.
 *
 * Guarded on `holder` so a run that overran its TTL cannot clobber the stats of
 * the run that legitimately took the lease from it.
 */
export async function releaseLease(name, holder, { ok, durationMs, detail }) {
  await query(
    `UPDATE job_leases
     SET locked_until = NOW(),
         last_finished_at = NOW(),
         last_duration_ms = $3::int,
         last_ok = $4::boolean,
         last_detail = $5::jsonb
     WHERE name = $1 AND holder = $2::varchar`,
    [name, holder, Math.round(durationMs), ok, JSON.stringify(detail ?? {})]
  );
}

/**
 * Scheduler heartbeat for the health endpoint: whether anything is driving the
 * monitor, and how long ago. Without this, a dead scheduler is invisible.
 */
export async function readLease(name) {
  const { rows } = await query(
    `SELECT last_started_at, last_finished_at, last_duration_ms, last_ok, last_detail,
            run_count, skip_count,
            EXTRACT(EPOCH FROM (NOW() - last_finished_at))::int AS seconds_since_finish
     FROM job_leases WHERE name = $1`,
    [name]
  );

  const row = rows[0];
  if (!row) return { name, everRan: false };

  return {
    name,
    everRan: Boolean(row.last_finished_at),
    lastFinishedAt: row.last_finished_at,
    secondsSinceLastRun: row.seconds_since_finish,
    lastDurationMs: row.last_duration_ms,
    lastOk: row.last_ok,
    runCount: Number(row.run_count),
    skippedCount: Number(row.skip_count),
    lastDetail: row.last_detail ?? null,
  };
}
