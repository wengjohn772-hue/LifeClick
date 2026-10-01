import { query } from '../db/pool.js';

/**
 * Location-pattern learning.
 *
 * Raw GPS fixes are not a pattern. This turns them into places (clusters of
 * fixes where someone actually stops) and transitions between those places
 * (A→B), then flags a journey the first time it is seen.
 *
 * It is frequency statistics over spatial clusters, not a model — which is why
 * it can be reasoned about and tested. Nothing here needs training data.
 */

/** A fix within this distance of a place is "at" that place. */
export const PLACE_RADIUS_M = 180;

/** Below this, the person is passing through, not stopping somewhere. */
export const MIN_DWELL_MS = 5 * 60 * 1000;

/**
 * Notifications are suppressed until the account has this many places, so a new
 * user is not told that every single thing they do is unprecedented.
 */
export const LEARNING_PLACES = 3;

/** Great-circle distance in metres. */
export function distanceMetres(a, b) {
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Running mean, so a place's centre settles on where the person actually is. */
export function blendCentre(place, fix) {
  const n = Math.max(1, place.visit_count);
  return {
    latitude: (Number(place.latitude) * n + fix.latitude) / (n + 1),
    longitude: (Number(place.longitude) * n + fix.longitude) / (n + 1),
  };
}

/** The place a fix belongs to, or null if it is somewhere new. */
export function matchPlace(places, fix) {
  let best = null;
  let bestDistance = Infinity;
  for (const place of places) {
    const d = distanceMetres({ latitude: Number(place.latitude), longitude: Number(place.longitude) }, fix);
    if (d <= PLACE_RADIUS_M && d < bestDistance) {
      best = place;
      bestDistance = d;
    }
  }
  return best;
}

async function loadPlaces(userId) {
  const { rows } = await query(
    `SELECT id, label, latitude, longitude, visit_count, first_seen, last_seen
     FROM places WHERE user_id = $1`,
    [userId]
  );
  return rows;
}

/**
 * Folds one location fix into the user's pattern model.
 *
 * Returns what changed, so the caller can notify. Deliberately quiet while the
 * account is still learning: `LEARNING_PLACES` has to be reached before
 * anything is reported as novel.
 */
export async function recordFix(userId, fix) {
  const places = await loadPlaces(userId);
  const matched = matchPlace(places, fix);
  const stillLearning = places.length < LEARNING_PLACES;

  let place;
  let isNewPlace = false;

  if (matched) {
    const centre = blendCentre(matched, fix);
    const { rows } = await query(
      `UPDATE places
       SET latitude = $2, longitude = $3, visit_count = visit_count + 1, last_seen = NOW()
       WHERE id = $1
       RETURNING id, label, latitude, longitude, visit_count`,
      [matched.id, centre.latitude, centre.longitude]
    );
    place = rows[0];
  } else {
    const { rows } = await query(
      `INSERT INTO places (user_id, latitude, longitude, visit_count, first_seen, last_seen)
       VALUES ($1, $2, $3, 1, NOW(), NOW())
       RETURNING id, label, latitude, longitude, visit_count`,
      [userId, fix.latitude, fix.longitude]
    );
    place = rows[0];
    isNewPlace = true;
  }

  // Where were they before this?
  const { rows: stateRows } = await query(
    `SELECT current_place_id, current_since FROM user_pattern_state WHERE user_id = $1`,
    [userId]
  );
  const previousPlaceId = stateRows[0]?.current_place_id ?? null;
  const previousSince = stateRows[0]?.current_since ?? null;

  let transition = null;
  let isNewTransition = false;

  if (previousPlaceId && previousPlaceId !== place.id) {
    // Only count it as a journey if they actually dwelt at the origin. Without
    // this, every fix taken while driving past somewhere becomes a "place" and
    // a "journey", and the model fills with noise.
    const dwelled = previousSince ? Date.now() - new Date(previousSince).getTime() >= MIN_DWELL_MS : false;

    if (dwelled) {
      const { rows } = await query(
        `INSERT INTO place_transitions (user_id, from_place_id, to_place_id, count, first_seen, last_seen)
         VALUES ($1, $2, $3, 1, NOW(), NOW())
         ON CONFLICT (user_id, from_place_id, to_place_id)
         DO UPDATE SET count = place_transitions.count + 1, last_seen = NOW()
         RETURNING id, count, (xmax = 0) AS inserted`,
        [userId, previousPlaceId, place.id]
      );
      transition = rows[0];
      isNewTransition = rows[0].inserted === true;
    }
  }

  if (previousPlaceId !== place.id) {
    await query(
      `INSERT INTO user_pattern_state (user_id, current_place_id, current_since, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         current_place_id = EXCLUDED.current_place_id,
         current_since = EXCLUDED.current_since,
         updated_at = NOW()`,
      [userId, place.id]
    );
  }

  const novel = !stillLearning && (isNewPlace || isNewTransition);

  return {
    placeId: place.id,
    isNewPlace,
    isNewTransition,
    transitionCount: transition?.count ?? null,
    stillLearning,
    knownPlaces: places.length + (isNewPlace ? 1 : 0),
    novel,
  };
}

/** Records a novelty so it can be shown in-app and not re-notified. */
export async function recordPatternAlert(userId, { kind, placeId, fromPlaceId, detail }) {
  const { rows } = await query(
    `INSERT INTO pattern_alerts (user_id, kind, place_id, from_place_id, detail)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, kind, detail, created_at`,
    [userId, kind, placeId ?? null, fromPlaceId ?? null, detail ?? null]
  );
  return rows[0];
}

/** Places and routes, most-used first — the "what Inertia has learned" view. */
export async function summarise(userId) {
  const [places, transitions, alerts] = [
    await query(
      `SELECT id, label, latitude, longitude, visit_count, first_seen, last_seen
       FROM places WHERE user_id = $1
       ORDER BY visit_count DESC, last_seen DESC LIMIT 50`,
      [userId]
    ),
    await query(
      `SELECT t.id, t.count, t.first_seen, t.last_seen,
              f.id AS from_id, f.label AS from_label, f.latitude AS from_lat, f.longitude AS from_lng,
              p.id AS to_id,   p.label AS to_label,   p.latitude AS to_lat,   p.longitude AS to_lng
       FROM place_transitions t
       JOIN places f ON f.id = t.from_place_id
       JOIN places p ON p.id = t.to_place_id
       WHERE t.user_id = $1
       ORDER BY t.count DESC, t.last_seen DESC LIMIT 50`,
      [userId]
    ),
    await query(
      `SELECT id, kind, detail, created_at, acknowledged_at
       FROM pattern_alerts WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 25`,
      [userId]
    ),
  ];

  return {
    learning: places.rows.length < LEARNING_PLACES,
    placesKnown: places.rows.length,
    places: places.rows.map((row) => ({
      id: String(row.id),
      label: row.label,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      visits: row.visit_count,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    })),
    routes: transitions.rows.map((row) => ({
      id: String(row.id),
      count: row.count,
      from: { id: String(row.from_id), label: row.from_label, latitude: Number(row.from_lat), longitude: Number(row.from_lng) },
      to: { id: String(row.to_id), label: row.to_label, latitude: Number(row.to_lat), longitude: Number(row.to_lng) },
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    })),
    alerts: alerts.rows.map((row) => ({
      id: String(row.id),
      kind: row.kind,
      detail: row.detail,
      at: row.created_at,
      acknowledged: Boolean(row.acknowledged_at),
    })),
  };
}
