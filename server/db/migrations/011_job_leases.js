export const id = '011_job_leases';

// A lease table rather than a Postgres advisory lock: an advisory lock is
// session-scoped, so holding one means holding a connection for the whole
// sweep. The pool is deliberately tiny in serverless (and exactly 1 against
// PGlite locally), so that would deadlock the moment the sweep ran its first
// query. A conditional UPSERT needs no held connection and is equally atomic.
//
// It doubles as the scheduler's heartbeat: `last_finished_at` is what tells
// you whether anything is actually driving the monitor, which is the failure
// that let abandoned impact countdowns pile up unnoticed.
export const sql = `
CREATE TABLE IF NOT EXISTS job_leases (
  name              VARCHAR(64) PRIMARY KEY,
  locked_until      TIMESTAMPTZ NOT NULL,
  holder            VARCHAR(128),
  last_started_at   TIMESTAMPTZ,
  last_finished_at  TIMESTAMPTZ,
  last_duration_ms  INTEGER,
  last_ok           BOOLEAN,
  last_detail       JSONB,
  run_count         BIGINT NOT NULL DEFAULT 0,
  skip_count        BIGINT NOT NULL DEFAULT 0
);
`;
