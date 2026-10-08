// Adds a `stale` terminal state for impact confirmations.
//
// `expired` means the sweep let the window close and escalated. A confirmation
// that was simply superseded — the user is plainly fine, because they are
// reporting a new impact — must not share that status: it would inflate the
// risk score and imply contacts were alerted when they were not.
export const id = '010_sensor_event_stale_status';

export const sql = `
ALTER TABLE sensor_events DROP CONSTRAINT IF EXISTS sensor_events_status_check;

ALTER TABLE sensor_events
  ADD CONSTRAINT sensor_events_status_check
  CHECK (status IN ('pending', 'cancelled', 'escalated', 'expired', 'stale'));

-- Retire confirmations already abandoned before this shipped. They were left
-- pending because nothing was calling the sweep, and each one blocked every
-- later alarm on that account from counting down.
UPDATE sensor_events
SET status = 'stale', resolved_at = NOW()
WHERE status = 'pending' AND confirm_deadline <= NOW() - INTERVAL '15 minutes';
`;
