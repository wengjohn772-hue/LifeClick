import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody, pushTokenSchema } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';

export const pushRouter = Router();

pushRouter.use(requireAuth, requireDatabase);

pushRouter.post(
  '/',
  validateBody(pushTokenSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    const { token, platform, deviceName } = req.body;

    // A device that is handed to another user must not keep delivering the
    // previous account's alerts, so the token is reassigned on conflict.
    await query(
      `INSERT INTO push_tokens (user_id, token, platform, device_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         device_name = EXCLUDED.device_name,
         updated_at = NOW()`,
      [req.user.id, token, platform ?? null, deviceName ?? null]
    );

    return res.json({ ok: true, saved: true });
  })
);

pushRouter.delete(
  '/',
  validateBody(pushTokenSchema.pick({ token: true })),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, deleted: false });

    const result = await query('DELETE FROM push_tokens WHERE token = $1 AND user_id = $2', [req.body.token, req.user.id]);
    return res.json({ ok: true, deleted: result.rowCount > 0 });
  })
);
