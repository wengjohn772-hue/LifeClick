// Impact detection and location-pattern learning.
export const id = '009_sensors_and_patterns';

export const sql = `
-- A detected impact starts PENDING with a deadline. The user has until that
-- deadline to say they are fine; the safety sweep escalates anything still
-- pending when it passes. The row is the source of truth rather than a timer on
-- the device, because a device that was just in a collision may not survive to
-- send the follow-up.
CREATE TABLE IF NOT EXISTS sensor_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL,
  peak_g DOUBLE PRECISION,
  followed_by_stillness BOOLEAN NOT NULL DEFAULT FALSE,
  risk_weight INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirm_deadline TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL,
  CONSTRAINT sensor_events_kind_check CHECK (kind IN ('impact', 'crash', 'fall')),
  CONSTRAINT sensor_events_status_check CHECK (status IN ('pending', 'cancelled', 'escalated', 'expired'))
);

CREATE INDEX IF NOT EXISTS sensor_events_pending_idx
  ON sensor_events (confirm_deadline) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS sensor_events_user_idx ON sensor_events (user_id, detected_at DESC);

-- A place is somewhere the person actually stops, derived from clustered fixes.
CREATE TABLE IF NOT EXISTS places (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(120),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS places_user_idx ON places (user_id, visit_count DESC);

-- A directed journey between two places. The unique key is what makes "has
-- this route been taken before?" a single upsert rather than a scan.
CREATE TABLE IF NOT EXISTS place_transitions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  to_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT place_transitions_distinct CHECK (from_place_id <> to_place_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS place_transitions_unique
  ON place_transitions (user_id, from_place_id, to_place_id);

-- Where the user currently is, and since when, so a journey is only recorded
-- after a real dwell rather than every time a fix drifts between clusters.
CREATE TABLE IF NOT EXISTS user_pattern_state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  current_since TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pattern_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(24) NOT NULL,
  place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  from_place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  CONSTRAINT pattern_alerts_kind_check CHECK (kind IN ('new_place', 'new_route'))
);

CREATE INDEX IF NOT EXISTS pattern_alerts_user_idx ON pattern_alerts (user_id, created_at DESC);

-- Daily step totals. iOS can backfill seven days; Android has no history API,
-- so its rows only appear for days the app was opened.
CREATE TABLE IF NOT EXISTS step_counts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  steps INTEGER NOT NULL DEFAULT 0,
  source VARCHAR(16) NOT NULL DEFAULT 'device',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS step_counts_user_day ON step_counts (user_id, day);
`;
