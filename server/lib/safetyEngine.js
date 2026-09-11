import { query } from '../db/pool.js';
import { config } from '../config.js';
import { buildMessage, sendExpoPush, isExpoPushToken } from './expoPush.js';

/**
 * Server-owned safety monitoring.
 *
 * The device used to own the check-in deadline, which meant a suspended or
 * killed app could not be detected as missing. These functions keep the
 * authoritative deadline in `user_safety_state` so the sweep can act on it
 * without any cooperation from the phone.
 */

/** Sets the next deadline after a successful check-in. */
export async function recordCheckIn(userId, intervalMinutes) {
  // make_interval rather than string concatenation: the same parameter is used
  // as both an integer column value and an interval, and `$2 || ' minutes'`
  // makes Postgres deduce two conflicting types for one parameter.
  const { rows } = await query(
    `INSERT INTO user_safety_state (user_id, interval_minutes, next_check_in_at, last_check_in_at, monitoring_enabled, updated_at)
     VALUES ($1, $2::int, NOW() + make_interval(mins => $2::int), NOW(), TRUE, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       interval_minutes = EXCLUDED.interval_minutes,
       next_check_in_at = EXCLUDED.next_check_in_at,
       last_check_in_at = EXCLUDED.last_check_in_at,
       monitoring_enabled = TRUE,
       updated_at = NOW()
     RETURNING *`,
    [userId, Number(intervalMinutes)]
  );

  // Checking in resolves whatever incident was open.
  await query(
    `UPDATE incidents SET status = 'resolved', resolved_at = NOW(), resolution = 'checked_in'
     WHERE user_id = $1 AND status = 'open'`,
    [userId]
  );

  return rows[0];
}

/** Applies a settings change to the authoritative deadline. */
export async function updateSafetySchedule(userId, { intervalMinutes, monitoringEnabled }) {
  const { rows } = await query(
    `INSERT INTO user_safety_state (user_id, interval_minutes, monitoring_enabled, next_check_in_at, updated_at)
     VALUES ($1, COALESCE($2::int, 30), COALESCE($3::boolean, TRUE),
             CASE WHEN COALESCE($3::boolean, TRUE)
                  THEN NOW() + make_interval(mins => COALESCE($2::int, 30))
                  ELSE NULL END,
             NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       interval_minutes = COALESCE($2::int, user_safety_state.interval_minutes),
       monitoring_enabled = COALESCE($3::boolean, user_safety_state.monitoring_enabled),
       next_check_in_at = CASE
         WHEN COALESCE($3::boolean, user_safety_state.monitoring_enabled) IS NOT TRUE THEN NULL
         WHEN $2::int IS NOT NULL THEN NOW() + make_interval(mins => $2::int)
         ELSE user_safety_state.next_check_in_at
       END,
       updated_at = NOW()
     RETURNING *`,
    [userId, intervalMinutes ?? null, monitoringEnabled ?? null]
  );
  return rows[0];
}

/** Stops monitoring — used on sign-out so a signed-out phone is not escalated. */
export async function pauseMonitoring(userId) {
  await query(
    `UPDATE user_safety_state
     SET monitoring_enabled = FALSE, next_check_in_at = NULL, updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );
  await query(
    `UPDATE incidents SET status = 'resolved', resolved_at = NOW(), resolution = 'monitoring_paused'
     WHERE user_id = $1 AND status = 'open'`,
    [userId]
  );
}

async function pushToUser(userId, title, body, data) {
  const { rows } = await query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
  const tokens = rows.map((row) => row.token).filter(isExpoPushToken);
  if (!tokens.length) return { attempted: 0, results: [] };

  const results = await sendExpoPush(tokens.map((to) => buildMessage({ to, title, body, data, critical: true })));

  // Drop tokens Expo reports as dead so they are not retried forever.
  const dead = results.filter((result) => result.unregistered).map((result) => result.to);
  if (dead.length) {
    await query('DELETE FROM push_tokens WHERE token = ANY($1)', [dead]);
  }

  return { attempted: tokens.length, results };
}

async function logNotification(incidentId, channel, target, recipientKind, result) {
  // $5 is explicitly cast: it feeds both a varchar column and a text
  // comparison, which Postgres otherwise refuses to deduce a single type for.
  await query(
    `INSERT INTO incident_notifications (incident_id, channel, target, recipient_kind, status, detail, sent_at)
     VALUES ($1, $2, $3, $4, $5::varchar, $6, CASE WHEN $5::text = 'sent' THEN NOW() ELSE NULL END)`,
    [incidentId, channel, target, recipientKind, result.status, result.detail ?? null]
  );
}

/** Stage 1: the deadline passed. Ask the user directly before alarming anyone. */
async function openIncident(user) {
  const { rows } = await query(
    `INSERT INTO incidents (user_id, missed_deadline_at, status, stage)
     VALUES ($1, $2, 'open', 'detected')
     ON CONFLICT (user_id) WHERE status = 'open' DO NOTHING
     RETURNING *`,
    [user.user_id, user.next_check_in_at]
  );

  const incident = rows[0];
  if (!incident) return null; // Another sweep already opened one.

  // Attach the last known position so responders have somewhere to start.
  await query(
    `UPDATE incidents SET
       last_latitude = l.latitude, last_longitude = l.longitude, last_location_at = l.captured_at
     FROM (
       SELECT latitude, longitude, captured_at FROM location_events
       WHERE user_id = $1 ORDER BY captured_at DESC LIMIT 1
     ) l
     WHERE incidents.id = $2`,
    [user.user_id, incident.id]
  );

  const push = await pushToUser(
    user.user_id,
    'LifeClick: are you safe?',
    'Your check-in is overdue. Open LifeClick to confirm you are okay.',
    { type: 'check_in_overdue', incidentId: incident.id }
  );

  for (const result of push.results) {
    await logNotification(
      incident.id,
      'push',
      result.to,
      'user',
      result.ok ? { status: 'sent' } : { status: 'failed', detail: result.error }
    );
  }

  await query(`UPDATE incidents SET stage = 'user_notified' WHERE id = $1`, [incident.id]);

  return { incident, pushed: push.attempted };
}

/**
 * Stage 2: still no response after the grace period. Alert trusted contacts.
 *
 * Contacts who are themselves LifeClick users are reached by push. Everyone
 * else is recorded as `pending_sms` — visible, auditable, and ready for an SMS
 * provider to pick up, rather than silently dropped.
 */
async function escalateIncident(incident) {
  const { rows: user } = await query('SELECT id, name, faf_id FROM users WHERE id = $1', [incident.user_id]);
  const owner = user[0];
  if (!owner) return { notified: 0 };

  // Resolve contacts against user accounts by phone, ignoring formatting.
  //
  // DISTINCT ON guarantees exactly one row per trusted contact: phone numbers
  // are not unique across accounts (numbers get reused, and the same person may
  // hold two accounts), and without it the join fans out and the same contact
  // is alerted several times for one incident.
  const { rows: contacts } = await query(
    `SELECT DISTINCT ON (tc.id)
            tc.id, tc.name, tc.phone, tc.relationship,
            u.id AS contact_user_id
     FROM trusted_contacts tc
     LEFT JOIN users u
       ON regexp_replace(u.phone, '[^0-9]', '', 'g') = regexp_replace(tc.phone, '[^0-9]', '', 'g')
      AND length(regexp_replace(tc.phone, '[^0-9]', '', 'g')) >= 7
      AND u.id <> tc.user_id
     WHERE tc.user_id = $1 AND tc.notify_enabled
     ORDER BY tc.id, u.id ASC`,
    [incident.user_id]
  );

  const where = incident.last_latitude
    ? ` Last known location: ${Number(incident.last_latitude).toFixed(4)}, ${Number(incident.last_longitude).toFixed(4)}.`
    : '';
  const title = `${owner.name} may need help`;
  const body = `${owner.name} missed a LifeClick safety check-in and has not responded.${where}`;

  let notified = 0;

  for (const contact of contacts) {
    if (contact.contact_user_id) {
      const push = await pushToUser(contact.contact_user_id, title, body, {
        type: 'contact_escalation',
        incidentId: incident.id,
        fafId: owner.faf_id,
      });

      if (push.attempted === 0) {
        await logNotification(incident.id, 'push', contact.phone, 'contact', {
          status: 'unavailable',
          detail: 'Contact has a LifeClick account but no registered device.',
        });
        continue;
      }

      for (const result of push.results) {
        await logNotification(
          incident.id,
          'push',
          result.to,
          'contact',
          result.ok ? { status: 'sent' } : { status: 'failed', detail: result.error }
        );
        if (result.ok) notified += 1;
      }
    } else {
      // No delivery channel yet. Recorded rather than dropped so an SMS
      // provider can be added without losing the escalation history.
      await logNotification(incident.id, 'sms', contact.phone, 'contact', {
        status: 'pending_sms',
        detail: 'No SMS provider configured and contact is not a LifeClick user.',
      });
    }
  }

  await query(
    `UPDATE incidents SET stage = 'contacts_notified', escalated_at = NOW() WHERE id = $1`,
    [incident.id]
  );

  return { notified, contacts: contacts.length };
}

/**
 * One pass of the safety monitor. Idempotent and safe to run concurrently:
 * incident stages gate every side effect, and the partial unique index
 * guarantees a single open incident per user.
 */
export async function runSafetySweep() {
  const startedAt = Date.now();

  // 1. Users past their deadline with no open incident yet.
  const { rows: overdue } = await query(
    `SELECT s.user_id, s.next_check_in_at, s.interval_minutes
     FROM user_safety_state s
     WHERE s.monitoring_enabled
       AND s.next_check_in_at IS NOT NULL
       AND s.next_check_in_at < NOW()
       AND NOT EXISTS (SELECT 1 FROM incidents i WHERE i.user_id = s.user_id AND i.status = 'open')
     LIMIT 500`
  );

  const detected = [];
  const failures = [];

  for (const user of overdue) {
    // Isolated per user: one unreachable device or bad row must not abort the
    // sweep and leave everyone else unmonitored.
    try {
      const opened = await openIncident(user);
      if (!opened) continue;

      detected.push(opened.incident.id);

      // Record the miss in check-in history for the dashboard.
      await query(
        `INSERT INTO check_ins (user_id, scheduled_time, status, interval_minutes, source, created_at)
         VALUES ($1, $2, 'missed', $3, 'server', NOW())`,
        [user.user_id, user.next_check_in_at, user.interval_minutes]
      );
      // Roll the deadline forward so the next miss is detected too.
      await query(
        `UPDATE user_safety_state
         SET next_check_in_at = NOW() + make_interval(mins => interval_minutes), updated_at = NOW()
         WHERE user_id = $1`,
        [user.user_id]
      );
    } catch (error) {
      console.error(`[sweep] detection failed for user ${user.user_id}:`, error.message);
      failures.push({ stage: 'detect', userId: user.user_id, error: error.message });
    }
  }

  // 2. Incidents past the grace period with the user still silent.
  const { rows: toEscalate } = await query(
    `SELECT * FROM incidents
     WHERE status = 'open'
       AND stage = 'user_notified'
       AND opened_at < NOW() - make_interval(mins => $1::int)
     LIMIT 200`,
    [config.escalationGraceMinutes]
  );

  const escalated = [];
  for (const incident of toEscalate) {
    try {
      const result = await escalateIncident(incident);
      escalated.push({ incidentId: incident.id, ...result });
    } catch (error) {
      console.error(`[sweep] escalation failed for incident ${incident.id}:`, error.message);
      failures.push({ stage: 'escalate', incidentId: incident.id, error: error.message });
    }
  }

  return {
    ok: failures.length === 0,
    durationMs: Date.now() - startedAt,
    overdueFound: overdue.length,
    incidentsOpened: detected.length,
    incidentsEscalated: escalated.length,
    escalations: escalated,
    // Surfaced rather than swallowed so a monitoring failure is visible to
    // whatever is calling the sweep.
    failures,
  };
}
