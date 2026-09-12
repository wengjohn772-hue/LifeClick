// Separates "pause my check-in timer" from "stop tracking my location".
//
// The timer toggle previously had to reuse tracking_enabled, which conflated
// two different user intents: someone pausing check-ins while at home should
// not also silently lose location monitoring.
export const id = '005_monitoring_toggle';

export const sql = `
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Existing rows inherit whatever the safety state already says, so nobody's
-- monitoring silently flips when this ships.
UPDATE user_settings s
SET monitoring_enabled = COALESCE(st.monitoring_enabled, TRUE)
FROM user_safety_state st
WHERE st.user_id = s.user_id;
`;
