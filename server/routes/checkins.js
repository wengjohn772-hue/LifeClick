import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody, checkInSchema } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { recordCheckIn } from '../lib/safetyEngine.js';

export const checkInsRouter = Router();

checkInsRouter.use(requireAuth, requireDatabase);

function serializeCheckIn(row) {
  return {
    id: row.id,
    status: row.status,
    checkedInAt: row.checkin_time,
    scheduledFor: row.scheduled_time,
    intervalMinutes: row.interval_minutes,
  };
}

checkInsRouter.post(
  '/',
  validateBody(checkInSchema),
  asyncRoute(async (req, res) => {
    const { status, intervalMinutes, scheduledFor } = req.body;

    if (req.demoMode) {
      return res.status(202).json({ ok: true, saved: false, checkIn: { status, checkedInAt: new Date().toISOString() } });
    }

    const { rows } = await query(
      `INSERT INTO check_ins (user_id, scheduled_time, checkin_time, status, interval_minutes, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, status, checkin_time, scheduled_time, interval_minutes`,
      [
        req.user.id,
        scheduledFor ?? null,
        // A missed check-in is recorded as an event with no confirmation time.
        status === 'safe' ? new Date() : null,
        status,
        intervalMinutes ?? null,
        'mobile',
      ]
    );

    // A confirmed check-in moves the server-owned deadline and resolves any
    // open incident. This is what lets the scheduled sweep detect a missed
    // check-in without the phone being awake.
    let safetyState = null;
    if (status === 'safe') {
      safetyState = await recordCheckIn(req.user.id, intervalMinutes ?? 30);
    }

    return res.status(201).json({
      ok: true,
      saved: true,
      checkIn: serializeCheckIn(rows[0]),
      nextCheckInAt: safetyState?.next_check_in_at ?? null,
    });
  })
);

checkInsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, checkIns: [], missedCount: 0 });

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    // Issued sequentially rather than with Promise.all: the serverless pool
    // caps at 3 connections, so one request should not hold two of them.
    const recent = await query(
      `SELECT id, status, checkin_time, scheduled_time, interval_minutes
       FROM check_ins
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    const missed = await query(
      `SELECT COUNT(*)::int AS count
       FROM check_ins
       WHERE user_id = $1 AND status = 'missed'`,
      [req.user.id]
    );

    return res.json({
      ok: true,
      checkIns: recent.rows.map(serializeCheckIn),
      missedCount: missed.rows[0].count,
    });
  })
);
