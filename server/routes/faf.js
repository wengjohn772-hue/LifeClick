import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { buildMessage, sendExpoPush, isExpoPushToken } from '../lib/expoPush.js';
import { recordSecurityEvent } from '../lib/audit.js';

export const fafRouter = Router();

fafRouter.use(requireAuth, requireDatabase);

/**
 * Find-a-Friend pairing.
 *
 * Live location is the most sensitive thing this app holds, so it is released
 * only while a pairing is `accepted`: the owner of a FaF ID must explicitly
 * permit the pairing, and either side can end it at any time. Every query below
 * filters on that status rather than trusting the caller to ask nicely.
 */

async function pushTo(userId, title, body, data) {
  const { rows } = await query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
  const tokens = rows.map((row) => row.token).filter(isExpoPushToken);
  if (!tokens.length) return { delivered: 0 };

  const results = await sendExpoPush(tokens.map((to) => buildMessage({ to, title, body, data, critical: true })));

  const dead = results.filter((r) => r.unregistered).map((r) => r.to);
  if (dead.length) await query('DELETE FROM push_tokens WHERE token = ANY($1)', [dead]);

  return { delivered: results.filter((r) => r.ok).length };
}

function serializeRequest(row) {
  return {
    id: String(row.id),
    status: row.status,
    requestedAt: row.requested_at,
    direction: row.direction,
    person: {
      name: row.other_name,
      fafId: row.other_faf_id,
      avatarId: row.other_avatar_id || 'violet',
    },
  };
}

function serializeConnection(row, viewerId) {
  const hasFix = row.other_latitude !== null && row.other_latitude !== undefined;
  return {
    id: String(row.id),
    status: row.status,
    startedAt: row.responded_at,
    person: {
      name: row.other_name,
      fafId: row.other_faf_id,
      avatarId: row.other_avatar_id || 'violet',
    },
    // Only present while accepted — the SQL never selects it otherwise.
    location: hasFix
      ? {
          latitude: Number(row.other_latitude),
          longitude: Number(row.other_longitude),
          accuracy: row.other_accuracy === null ? null : Number(row.other_accuracy),
          capturedAt: row.other_captured_at,
        }
      : null,
    startedByMe: row.requester_user_id === viewerId,
  };
}

/* ------------------------------------------------------------- requests */

const requestSchema = z.object({
  fafId: z.string().trim().min(3).max(32).transform((value) => value.toUpperCase()),
});

/** Ask the owner of a FaF ID for permission to pair. */
fafRouter.post(
  '/requests',
  validateBody(requestSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    const { fafId } = req.body;

    const { rows: targets } = await query(
      'SELECT id, name, faf_id, avatar_id FROM users WHERE UPPER(faf_id) = $1',
      [fafId]
    );
    const target = targets[0];

    // Deliberately the same answer as "no such ID": otherwise this endpoint
    // becomes a way to enumerate which FaF IDs exist.
    if (!target || target.id === req.user.id) {
      return res.status(404).json({ error: 'No LifeClick user has that FaF ID.', code: 'faf_not_found' });
    }

    const { rows: existing } = await query(
      `SELECT id, status, requester_user_id FROM faf_connections
       WHERE status IN ('pending', 'accepted')
         AND LEAST(requester_user_id, target_user_id) = LEAST($1::int, $2::int)
         AND GREATEST(requester_user_id, target_user_id) = GREATEST($1::int, $2::int)`,
      [req.user.id, target.id]
    );

    if (existing[0]) {
      const already = existing[0];
      return res.status(409).json({
        error:
          already.status === 'accepted'
            ? `You are already connected to ${target.name}.`
            : already.requester_user_id === req.user.id
              ? `${target.name} has not answered your request yet.`
              : `${target.name} has already asked to connect with you. Check your requests.`,
        code: already.status === 'accepted' ? 'already_connected' : 'already_pending',
        connectionId: String(already.id),
      });
    }

    const { rows } = await query(
      `INSERT INTO faf_connections (requester_user_id, target_user_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, status, requested_at`,
      [req.user.id, target.id]
    );

    const { rows: me } = await query('SELECT name, faf_id FROM users WHERE id = $1', [req.user.id]);

    const push = await pushTo(
      target.id,
      'LifeClick pairing request',
      `${me[0].name} wants to connect with you on Find a Friend and share live location.`,
      { type: 'faf_request', connectionId: String(rows[0].id) }
    );

    await recordSecurityEvent(req, {
      userId: req.user.id,
      eventType: 'faf_request_sent',
      detail: `to ${target.faf_id}`,
    });

    return res.status(201).json({
      ok: true,
      request: {
        id: String(rows[0].id),
        status: rows[0].status,
        requestedAt: rows[0].requested_at,
        direction: 'outgoing',
        person: { name: target.name, fafId: target.faf_id, avatarId: target.avatar_id || 'violet' },
      },
      // Surfaced so the UI can say "they have no device registered" rather than
      // implying the other person has been alerted when they have not.
      notified: push.delivered > 0,
    });
  })
);

/** Pending requests in both directions. */
fafRouter.get(
  '/requests',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, incoming: [], outgoing: [] });

    const { rows } = await query(
      `SELECT c.id, c.status, c.requested_at,
              CASE WHEN c.target_user_id = $1 THEN 'incoming' ELSE 'outgoing' END AS direction,
              u.name AS other_name, u.faf_id AS other_faf_id, u.avatar_id AS other_avatar_id
       FROM faf_connections c
       JOIN users u ON u.id = CASE WHEN c.target_user_id = $1 THEN c.requester_user_id ELSE c.target_user_id END
       WHERE c.status = 'pending' AND (c.target_user_id = $1 OR c.requester_user_id = $1)
       ORDER BY c.requested_at DESC`,
      [req.user.id]
    );

    const all = rows.map(serializeRequest);
    return res.json({
      ok: true,
      incoming: all.filter((r) => r.direction === 'incoming'),
      outgoing: all.filter((r) => r.direction === 'outgoing'),
    });
  })
);

const respondSchema = z.object({ accept: z.boolean() });

/** The permission step. Only the person who was asked may answer. */
fafRouter.post(
  '/requests/:id/respond',
  validateBody(respondSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid request id.', code: 'invalid_id' });

    const nextStatus = req.body.accept ? 'accepted' : 'declined';

    // target_user_id in the WHERE clause is the authorisation: the requester
    // cannot approve their own request.
    const { rows } = await query(
      `UPDATE faf_connections
       SET status = $3, responded_at = NOW()
       WHERE id = $1 AND target_user_id = $2 AND status = 'pending'
       RETURNING id, requester_user_id, status, responded_at`,
      [id.data, req.user.id, nextStatus]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'That pairing request is no longer waiting for you.', code: 'not_found' });
    }

    const { rows: me } = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    await pushTo(
      rows[0].requester_user_id,
      req.body.accept ? 'Pairing accepted' : 'Pairing declined',
      req.body.accept
        ? `${me[0].name} accepted. You can now see each other on the map.`
        : `${me[0].name} declined your pairing request.`,
      { type: req.body.accept ? 'faf_accepted' : 'faf_declined', connectionId: String(rows[0].id) }
    );

    await recordSecurityEvent(req, {
      userId: req.user.id,
      eventType: req.body.accept ? 'faf_pairing_accepted' : 'faf_pairing_declined',
    });

    return res.json({ ok: true, status: rows[0].status, connectionId: String(rows[0].id) });
  })
);

/** Withdraw a request you sent. */
fafRouter.delete(
  '/requests/:id',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, cancelled: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid request id.', code: 'invalid_id' });

    const result = await query(
      `UPDATE faf_connections SET status = 'cancelled', ended_at = NOW(), ended_by_user_id = $2
       WHERE id = $1 AND requester_user_id = $2 AND status = 'pending'`,
      [id.data, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Request not found.', code: 'not_found' });

    return res.json({ ok: true, cancelled: true });
  })
);

/* ---------------------------------------------------------- connections */

/**
 * Active pairings, each with the other person's latest position.
 *
 * The location join is gated on `status = 'accepted'` in the same statement, so
 * a declined or ended pairing cannot leak a position even if a stale client
 * keeps polling.
 */
fafRouter.get(
  '/connections',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, connections: [] });

    const { rows } = await query(
      `SELECT c.id, c.status, c.responded_at, c.requester_user_id,
              u.name AS other_name, u.faf_id AS other_faf_id, u.avatar_id AS other_avatar_id,
              l.latitude AS other_latitude, l.longitude AS other_longitude,
              l.accuracy AS other_accuracy, l.captured_at AS other_captured_at
       FROM faf_connections c
       JOIN users u ON u.id = CASE WHEN c.requester_user_id = $1 THEN c.target_user_id ELSE c.requester_user_id END
       LEFT JOIN LATERAL (
         SELECT latitude, longitude, accuracy, captured_at
         FROM location_events
         WHERE user_id = u.id
         ORDER BY captured_at DESC
         LIMIT 1
       ) l ON TRUE
       WHERE c.status = 'accepted' AND (c.requester_user_id = $1 OR c.target_user_id = $1)
       ORDER BY c.responded_at DESC`,
      [req.user.id]
    );

    // The caller's own position, so the map can draw both ends of the trail
    // without a second round trip.
    const { rows: mine } = await query(
      `SELECT latitude, longitude, accuracy, captured_at
       FROM location_events WHERE user_id = $1 ORDER BY captured_at DESC LIMIT 1`,
      [req.user.id]
    );

    return res.json({
      ok: true,
      connections: rows.map((row) => serializeConnection(row, req.user.id)),
      me: mine[0]
        ? {
            latitude: Number(mine[0].latitude),
            longitude: Number(mine[0].longitude),
            accuracy: mine[0].accuracy === null ? null : Number(mine[0].accuracy),
            capturedAt: mine[0].captured_at,
          }
        : null,
    });
  })
);

/** Either side may end the session; location sharing stops immediately. */
fafRouter.post(
  '/connections/:id/disconnect',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, disconnected: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid connection id.', code: 'invalid_id' });

    const { rows } = await query(
      `UPDATE faf_connections
       SET status = 'ended', ended_at = NOW(), ended_by_user_id = $2
       WHERE id = $1 AND status = 'accepted' AND (requester_user_id = $2 OR target_user_id = $2)
       RETURNING id, requester_user_id, target_user_id`,
      [id.data, req.user.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'No active connection to end.', code: 'not_found' });

    const otherId = rows[0].requester_user_id === req.user.id ? rows[0].target_user_id : rows[0].requester_user_id;
    const { rows: me } = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    await pushTo(otherId, 'Pairing ended', `${me[0].name} disconnected. Live location sharing has stopped.`, {
      type: 'faf_ended',
      connectionId: String(rows[0].id),
    });

    await recordSecurityEvent(req, { userId: req.user.id, eventType: 'faf_disconnected' });

    return res.json({ ok: true, disconnected: true });
  })
);
