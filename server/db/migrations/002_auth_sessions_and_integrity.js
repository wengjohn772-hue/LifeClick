// Adds the tables secure authentication and mobile data integration need, and
// repairs the location_events.user_id type mismatch.
export const id = '002_auth_sessions_and_integrity';

export const sql = `
-- Refresh tokens are stored hashed so a database leak cannot be replayed, and
-- as rows so a session can be revoked on sign-out or account deletion.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(16),
  device_name VARCHAR(160),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);

CREATE TABLE IF NOT EXISTS feed_posts (
  id SERIAL PRIMARY KEY,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  anon_handle VARCHAR(32) NOT NULL,
  area VARCHAR(160),
  body TEXT NOT NULL,
  tag VARCHAR(20) NOT NULL DEFAULT 'Notice',
  likes INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feed_posts_created_idx ON feed_posts (created_at DESC);

-- Profile fields the web app already renders but the database never stored.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(32) DEFAULT 'violet';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(64) DEFAULT 'Member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS posts_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS feeds_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Personalised check-in timing, matching the web app's presets (up to 48h).
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS remind_before_minutes INTEGER DEFAULT 5;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS remind_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_settings ALTER COLUMN check_in_interval SET DEFAULT 30;

-- One settings row per user so the API can upsert.
DELETE FROM user_settings a
  USING user_settings b
  WHERE a.user_id = b.user_id AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_key ON user_settings (user_id);

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS interval_minutes INTEGER;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS source VARCHAR(16) DEFAULT 'mobile';

-- location_events.user_id was VARCHAR with no foreign key while users.id is an
-- integer, so rows could never be joined or cascade-deleted. Convert it, first
-- discarding prototype rows that hold non-numeric IDs such as 'demo-user'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'location_events'
      AND column_name = 'user_id'
      AND data_type <> 'integer'
  ) THEN
    DELETE FROM location_events WHERE user_id !~ '^[0-9]+$';
    DELETE FROM location_events le
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = le.user_id::integer);
    ALTER TABLE location_events
      ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'location_events_user_id_fkey'
  ) THEN
    ALTER TABLE location_events
      ADD CONSTRAINT location_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS location_events_user_captured_idx
  ON location_events (user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS check_ins_user_scheduled_idx
  ON check_ins (user_id, scheduled_time DESC);
CREATE INDEX IF NOT EXISTS trusted_contacts_user_idx
  ON trusted_contacts (user_id);
CREATE INDEX IF NOT EXISTS alerts_user_status_idx
  ON alerts (user_id, status);
`;
