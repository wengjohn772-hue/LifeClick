import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { recordSecurityEvent } from '../lib/audit.js';

export const sensorsRouter = Router();

sensorsRouter.use(requireAuth, requireDatabase);

const impactSchema = z.object({
  kind: z.enum(['impact', 'crash', 'fall']),
  peakG: z.coerce.number().min(0).max(200).optional(),
  followedByStillness: z.boolean().optional().default(false),
  riskWeight: z.coerce.number().int().min(0).max(100).optional().default(10),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * Reports a detected impact and opens the confirmation window.
 *
 * The deadline is stored server-side on purpose. If the countdown lived only on
 * the device, a phone destroyed or dropped in the collision would simply stop
 * counting and nobody would ever be told — the exact case the feature exists
 * for. The sweep escalates anything still pending when the deadline passes.
 */
sensorsRouter.post(
  '/impacts',
  validateBody(impactSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    const { kind, peakG, followedByStillness, riskWeight, latitude, longitude } = req.body;

    // One open confirmation at a time: a tumble produces several impacts, and
    // each should not start its own countdown.
    const { rows: open } = await query(
      `SELECT id, kind, confirm_deadline FROM sensor_events
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY detected_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (open[0]) {
      return res.status(200).json({
        ok: true,
        existing: true,
        event: {
          id: String(open[0].id),
          kind: open[0].kind,
          confirmDeadline: open[0].confirm_deadline,
          secondsRemaining: Math.max(
            0,
            Math.round((new Date(open[0].confirm_deadline).getTime() - Date.now()) / 1000)
          ),
        },
      });
    }

    const { rows } = await query(
      `INSERT INTO sensor_events
         (user_id, kind, peak_g, followed_by_stillness, risk_weight, latitude, longitude, confirm_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + make_interval(secs => $8::int))
       RETURNING id, kind, peak_g, confirm_deadline, detected_at`,
      [
        req.user.id,
        kind,
        peakG ?? null,
        followedByStillness,
        riskWeight,
        latitude ?? null,
        longitude ?? null,
        config.impactConfirmSeconds,
      ]
    );

    await recordSecurityEvent(req, {
      userId: req.user.id,
      eventType: 'impact_detected',
      detail: `${kind}${peakG ? ` ${peakG.toFixed(1)}g` : ''}`,
    });

    return res.status(201).json({
      ok: true,
      existing: false,
      event: {
        id: String(rows[0].id),
        kind: rows[0].kind,
        peakG: rows[0].peak_g,
        confirmDeadline: rows[0].confirm_deadline,
        secondsRemaining: config.impactConfirmSeconds,
      },
    });
  })
);

/** "I'm fine" — stops the countdown before anybody is alerted. */
sensorsRouter.post(
  '/impacts/:id/cancel',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, cancelled: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid event id.', code: 'invalid_id' });

    const { rows } = await query(
      `UPDATE sensor_events SET status = 'cancelled', resolved_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING id`,
      [id.data, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'That alert is no longer waiting for a response.', code: 'not_found' });
    }

    await recordSecurityEvent(req, { userId: req.user.id, eventType: 'impact_cancelled' });
    return res.json({ ok: true, cancelled: true });
  })
);

/** Lets the app restore a countdown it was showing before being killed. */
sensorsRouter.get(
  '/impacts/pending',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, event: null });

    const { rows } = await query(
      `SELECT id, kind, peak_g, confirm_deadline FROM sensor_events
       WHERE user_id = $1 AND status = 'pending' AND confirm_deadline > NOW()
       ORDER BY detected_at DESC LIMIT 1`,
      [req.user.id]
    );

    return res.json({
      ok: true,
      event: rows[0]
        ? {
            id: String(rows[0].id),
            kind: rows[0].kind,
            peakG: rows[0].peak_g,
            confirmDeadline: rows[0].confirm_deadline,
            secondsRemaining: Math.max(
              0,
              Math.round((new Date(rows[0].confirm_deadline).getTime() - Date.now()) / 1000)
            ),
          }
        : null,
    });
  })
);

sensorsRouter.get(
  '/impacts',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, events: [], riskContribution: 0 });

    const { rows } = await query(
      `SELECT id, kind, peak_g, followed_by_stillness, risk_weight, status, detected_at, resolved_at
       FROM sensor_events WHERE user_id = $1
       ORDER BY detected_at DESC LIMIT 25`,
      [req.user.id]
    );

    // Only un-cancelled events count towards risk, and only recent ones.
    const { rows: weight } = await query(
      `SELECT COALESCE(SUM(risk_weight), 0)::int AS total
       FROM sensor_events
       WHERE user_id = $1 AND status IN ('escalated', 'expired')
         AND detected_at > NOW() - INTERVAL '24 hours'`,
      [req.user.id]
    );

    return res.json({
      ok: true,
      riskContribution: Math.min(100, weight[0].total),
      events: rows.map((row) => ({
        id: String(row.id),
        kind: row.kind,
        peakG: row.peak_g === null ? null : Number(row.peak_g),
        followedByStillness: row.followed_by_stillness,
        status: row.status,
        detectedAt: row.detected_at,
        resolvedAt: row.resolved_at,
      })),
    });
  })
);

/* ----------------------------------------------------------------- steps */

const stepsSchema = z.object({
  days: z
    .array(
      z.object({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        steps: z.coerce.number().int().min(0).max(300000),
      })
    )
    .min(1)
    .max(14),
  source: z.enum(['ios', 'android', 'device']).optional().default('device'),
});

sensorsRouter.post(
  '/steps',
  validateBody(stepsSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    for (const entry of req.body.days) {
      await query(
        `INSERT INTO step_counts (user_id, day, steps, source, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, day) DO UPDATE SET
           -- Highest wins: a later sync of the same day should not lose steps
           -- already recorded while the app was open.
           steps = GREATEST(step_counts.steps, EXCLUDED.steps),
           source = EXCLUDED.source,
           updated_at = NOW()`,
        [req.user.id, entry.day, entry.steps, req.body.source]
      );
    }

    return res.json({ ok: true, saved: true, days: req.body.days.length });
  })
);

sensorsRouter.get(
  '/steps',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, days: [], today: 0, average: 0 });

    const { rows } = await query(
      `SELECT day, steps, source FROM step_counts
       WHERE user_id = $1 AND day > CURRENT_DATE - INTERVAL '14 days'
       ORDER BY day DESC`,
      [req.user.id]
    );

    const today = rows.find((row) => new Date(row.day).toDateString() === new Date().toDateString());
    const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.steps, 0) / rows.length) : 0;

    return res.json({
      ok: true,
      today: today?.steps ?? 0,
      average,
      days: rows.map((row) => ({
        day: typeof row.day === 'string' ? row.day : row.day.toISOString().slice(0, 10),
        steps: row.steps,
        source: row.source,
      })),
    });
  })
);
