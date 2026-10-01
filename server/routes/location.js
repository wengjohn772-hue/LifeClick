import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody, locationSchema } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { recordFix, recordPatternAlert } from '../lib/patterns.js';
import { notifyPatternNovelty } from '../lib/safetyEngine.js';

export const locationRouter = Router();

locationRouter.use(requireAuth, requireDatabase);

function serializeLocation(row) {
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    status: row.status,
    capturedAt: row.captured_at,
  };
}

locationRouter.post(
  '/',
  validateBody(locationSchema),
  asyncRoute(async (req, res) => {
    const { latitude, longitude, accuracy, status } = req.body;

    if (req.demoMode) {
      return res.status(202).json({ ok: true, saved: false, message: 'Location accepted in demo mode.' });
    }

    // The user is taken from the verified token. A `userId` in the body is
    // ignored — trusting it previously let any caller write location history
    // against any account.
    await query(
      `INSERT INTO location_events (user_id, latitude, longitude, accuracy, status, captured_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [req.user.id, latitude, longitude, accuracy, status]
    );

    // Fold the fix into the user's learned places and routes. Failures here
    // must never fail the location write: losing a position during an incident
    // matters far more than missing one pattern update.
    let pattern = null;
    try {
      pattern = await recordFix(req.user.id, { latitude, longitude });

      if (pattern.novel) {
        const kind = pattern.isNewPlace ? 'new_place' : 'new_route';
        const detail = pattern.isNewPlace
          ? 'Somewhere you have not been before.'
          : 'A journey between two of your places that you have not made before.';
        await recordPatternAlert(req.user.id, { kind, placeId: pattern.placeId, detail });
        await notifyPatternNovelty(req.user.id, kind);
      }
    } catch (error) {
      console.warn('[patterns] fix not folded in:', error.message);
    }

    return res.json({
      ok: true,
      saved: true,
      pattern: pattern
        ? {
            isNewPlace: pattern.isNewPlace,
            isNewRoute: pattern.isNewTransition,
            learning: pattern.stillLearning,
            placesKnown: pattern.knownPlaces,
          }
        : null,
    });
  })
);

const latest = asyncRoute(async (req, res) => {
  if (req.demoMode) {
    return res.json({ ok: true, location: null, message: 'No stored location in demo mode.' });
  }

  const { rows } = await query(
    `SELECT latitude, longitude, accuracy, status, captured_at
     FROM location_events
     WHERE user_id = $1
     ORDER BY captured_at DESC
     LIMIT 1`,
    [req.user.id]
  );

  return res.json({ ok: true, location: rows[0] ? serializeLocation(rows[0]) : null });
});

locationRouter.get('/', latest);
locationRouter.get('/latest', latest);

locationRouter.get(
  '/history',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, locations: [] });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const { rows } = await query(
      `SELECT latitude, longitude, accuracy, status, captured_at
       FROM location_events
       WHERE user_id = $1
       ORDER BY captured_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );

    return res.json({ ok: true, locations: rows.map(serializeLocation) });
  })
);
