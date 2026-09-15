// Find-a-Friend pairing: one user requests by FaF ID, the other must permit it
// before any location is shared, and either may end the session.
export const id = '007_faf_connections';

export const sql = `
CREATE TABLE IF NOT EXISTS faf_connections (
  id SERIAL PRIMARY KEY,
  requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- pending -> accepted -> ended, or pending -> declined / cancelled
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT faf_no_self_pair CHECK (requester_user_id <> target_user_id),
  CONSTRAINT faf_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'ended'))
);

-- At most one live pairing between any two people, whichever direction it was
-- opened from. Without the LEAST/GREATEST pair, A->B and B->A would both be
-- allowed and the two sessions would fight over the same map.
CREATE UNIQUE INDEX IF NOT EXISTS faf_one_active_pair
  ON faf_connections (
    LEAST(requester_user_id, target_user_id),
    GREATEST(requester_user_id, target_user_id)
  )
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS faf_target_pending_idx
  ON faf_connections (target_user_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS faf_requester_idx
  ON faf_connections (requester_user_id, status, requested_at DESC);

-- Looking a user up by the FaF ID they typed.
CREATE INDEX IF NOT EXISTS users_faf_id_idx ON users (faf_id);
`;
