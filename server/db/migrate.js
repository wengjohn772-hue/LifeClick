import { pool, isConnectionError } from './pool.js';
import * as baseline from './migrations/001_baseline.js';
import * as authSessions from './migrations/002_auth_sessions_and_integrity.js';
import * as seedFeed from './migrations/003_seed_feed_posts.js';
import * as safetyEngine from './migrations/004_safety_engine_and_audit.js';

// Migrations are imported as modules rather than read from disk with
// readFileSync + import.meta.url. Vercel's bundler does not trace a runtime
// file read, so the previous schema.sql load silently failed in production.
const migrations = [baseline, authSessions, seedFeed, safetyEngine];

let migrationRun;

async function applyMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      await client.query('COMMIT');
      console.log(`[migrate] applied ${migration.id}`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(`Migration ${migration.id} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

/**
 * Runs pending migrations once per process. Resolves to a status the health
 * endpoint can report, so a failure is visible instead of being swallowed by a
 * console.warn the way the old auto-init was.
 */
export function ensureSchema() {
  if (!pool) return Promise.resolve({ ok: false, reason: 'not-configured' });

  if (!migrationRun) {
    migrationRun = applyMigrations()
      .then(() => ({ ok: true }))
      .catch((error) => {
        // Allow a later request to retry a transient connection failure, but do
        // not retry a genuinely broken migration on every single request.
        if (isConnectionError(error)) migrationRun = undefined;
        console.error('[migrate] failed:', error.message);
        return { ok: false, reason: error.message };
      });
  }

  return migrationRun;
}
