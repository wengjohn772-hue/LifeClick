import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { summarise } from '../lib/patterns.js';

export const patternsRouter = Router();

patternsRouter.use(requireAuth, requireDatabase);

/** Everything Inertia has learned about where this person goes. */
patternsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    if (req.demoMode) {
      return res.json({ ok: true, learning: true, placesKnown: 0, places: [], routes: [], alerts: [] });
    }
    return res.json({ ok: true, ...(await summarise(req.user.id)) });
  })
);

const labelSchema = z.object({ label: z.string().trim().min(1).max(120) });

/** Naming a place ("Home", "Depot") makes every later alert readable. */
patternsRouter.patch(
  '/places/:id',
  validateBody(labelSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid place id.', code: 'invalid_id' });

    const { rows } = await query(
      `UPDATE places SET label = $3 WHERE id = $1 AND user_id = $2
       RETURNING id, label, latitude, longitude, visit_count`,
      [id.data, req.user.id, req.body.label]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Place not found.', code: 'not_found' });

    return res.json({
      ok: true,
      place: {
        id: String(rows[0].id),
        label: rows[0].label,
        latitude: Number(rows[0].latitude),
        longitude: Number(rows[0].longitude),
        visits: rows[0].visit_count,
      },
    });
  })
);

patternsRouter.post(
  '/alerts/:id/acknowledge',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, acknowledged: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid alert id.', code: 'invalid_id' });

    const result = await query(
      `UPDATE pattern_alerts SET acknowledged_at = NOW()
       WHERE id = $1 AND user_id = $2 AND acknowledged_at IS NULL`,
      [id.data, req.user.id]
    );
    return res.json({ ok: true, acknowledged: result.rowCount > 0 });
  })
);

/** Forgetting a place also forgets every route through it. */
patternsRouter.delete(
  '/places/:id',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, deleted: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid place id.', code: 'invalid_id' });

    const result = await query('DELETE FROM places WHERE id = $1 AND user_id = $2', [id.data, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Place not found.', code: 'not_found' });

    return res.json({ ok: true, deleted: true });
  })
);
