// Server-owned safety monitoring, escalation records, consent, and the
// security/audit log.
//
// Until now the check-in deadline lived only on the device, so nothing could
// detect a missed check-in while the app was closed or killed. These tables
// move the deadline server-side so a scheduled sweep can act without the
// phone's cooperation.
export const id = '004_safety_engine_and_audit';

export const sql = `
-- One row per user: the authoritative check-in deadline the sweep reads.
CREATE TABLE IF NOT EXISTS user_safety_state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monitoring_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_minutes INTEGER NOT NULL DEFAULT 30,
  grace_minutes INTEGER NOT NULL DEFAULT 10,
  next_check_in_at TIMESTAMPTZ,
  last_check_in_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial index: the sweep only ever scans monitored users with a deadline.
CREATE INDEX IF NOT EXISTS user_safety_due_idx
  ON user_safety_state (next_check_in_at)
  WHERE monitoring_enabled AND next_check_in_at IS NOT NULL;

-- An open incident is a user who went past their deadline. Stage advances as
-- escalation proceeds, so a restarted or overlapping sweep cannot double-notify.
CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  stage VARCHAR(24) NOT NULL DEFAULT 'detected',
  missed_deadline_at TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution VARCHAR(32),
  last_latitude DOUBLE PRECISION,
  last_longitude DOUBLE PRECISION,
  last_location_at TIMESTAMPTZ
);

-- At most one open incident per user.
CREATE UNIQUE INDEX IF NOT EXISTS incidents_one_open_per_user
  ON incidents (user_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents (status, opened_at DESC);

-- Every notification attempt, so delivery is auditable and retryable.
CREATE TABLE IF NOT EXISTS incident_notifications (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  channel VARCHAR(16) NOT NULL,
  target TEXT NOT NULL,
  recipient_kind VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS incident_notifications_incident_idx
  ON incident_notifications (incident_id);

-- Recorded consent. Location and IP processing are only lawful with this, so
-- the version is stored to prove WHAT was agreed to, not merely that it was.
CREATE TABLE IF NOT EXISTS user_consents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version VARCHAR(32) NOT NULL,
  location_tracking BOOLEAN NOT NULL DEFAULT FALSE,
  background_monitoring BOOLEAN NOT NULL DEFAULT FALSE,
  ip_logging BOOLEAN NOT NULL DEFAULT FALSE,
  contact_escalation BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address VARCHAR(64),
  user_agent TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_consents_user_idx ON user_consents (user_id, accepted_at DESC);

-- High-value, low-volume: sign-ins, token refreshes, deletions. Kept longer
-- than the raw request log and surfaced to the user as "recent activity".
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  email VARCHAR(255),
  ip_address VARCHAR(64),
  user_agent TEXT,
  outcome VARCHAR(16) NOT NULL DEFAULT 'success',
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_user_idx ON security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events (created_at);

-- Every authenticated request. This is by far the highest-volume table here:
-- a background location ping a minute is ~1,440 rows per user per day, so the
-- sweep prunes it on a retention window.
CREATE TABLE IF NOT EXISTS api_access_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(200) NOT NULL,
  status INTEGER,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_access_log_user_idx ON api_access_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_access_log_created_idx ON api_access_log (created_at);

-- Lets escalation reach a trusted contact who is themselves a LifeClick user,
-- resolved by phone number at escalation time.
ALTER TABLE trusted_contacts ADD COLUMN IF NOT EXISTS contact_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE trusted_contacts ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill safety state for users who registered before this table existed.
INSERT INTO user_safety_state (user_id, interval_minutes, next_check_in_at)
SELECT u.id, COALESCE(s.check_in_interval, 30), NULL
FROM users u
LEFT JOIN user_settings s ON s.user_id = u.id
ON CONFLICT (user_id) DO NOTHING;
`;
