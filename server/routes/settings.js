import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody, settingsSchema } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { updateSafetySchedule } from '../lib/safetyEngine.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth, requireDatabase);

const DEFAULTS = {
  checkInIntervalMinutes: 30,
  remindEnabled: true,
  remindBeforeMinutes: 5,
  notificationsEnabled: true,
  trackingEnabled: true,
  monitoringEnabled: true,
};

function serializeSettings(row) {
  if (!row) return { ...DEFAULTS };
  return {
    checkInIntervalMinutes: row.check_in_interval ?? DEFAULTS.checkInIntervalMinutes,
    remindEnabled: row.remind_enabled ?? DEFAULTS.remindEnabled,
    remindBeforeMinutes: row.remind_before_minutes ?? DEFAULTS.remindBeforeMinutes,
    notificationsEnabled: row.notifications_enabled ?? DEFAULTS.notificationsEnabled,
    trackingEnabled: row.tracking_enabled ?? DEFAULTS.trackingEnabled,
    monitoringEnabled: row.monitoring_enabled ?? DEFAULTS.monitoringEnabled,
  };
}

settingsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, settings: { ...DEFAULTS } });

    const { rows } = await query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    return res.json({ ok: true, settings: serializeSettings(rows[0]) });
  })
);

settingsRouter.put(
  '/',
  validateBody(settingsSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false, settings: { ...DEFAULTS, ...req.body } });

    const { rows: current } = await query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    const merged = { ...serializeSettings(current[0]), ...req.body };

    const { rows } = await query(
      `INSERT INTO user_settings (user_id, check_in_interval, remind_enabled, remind_before_minutes, notifications_enabled, tracking_enabled, monitoring_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         check_in_interval = EXCLUDED.check_in_interval,
         remind_enabled = EXCLUDED.remind_enabled,
         remind_before_minutes = EXCLUDED.remind_before_minutes,
         notifications_enabled = EXCLUDED.notifications_enabled,
         tracking_enabled = EXCLUDED.tracking_enabled,
         monitoring_enabled = EXCLUDED.monitoring_enabled,
         updated_at = NOW()
       RETURNING *`,
      [
        req.user.id,
        merged.checkInIntervalMinutes,
        merged.remindEnabled,
        merged.remindBeforeMinutes,
        merged.notificationsEnabled,
        merged.trackingEnabled,
        merged.monitoringEnabled,
      ]
    );

    // Keep the server-owned deadline aligned with the chosen interval, and stop
    // the sweep when the user pauses their timer — otherwise a deliberate pause
    // would escalate them to their trusted contacts.
    const safetyState = await updateSafetySchedule(req.user.id, {
      intervalMinutes: req.body.checkInIntervalMinutes ?? null,
      monitoringEnabled: req.body.monitoringEnabled ?? null,
    });

    return res.json({
      ok: true,
      saved: true,
      settings: serializeSettings(rows[0]),
      nextCheckInAt: safetyState?.next_check_in_at ?? null,
    });
  })
);
