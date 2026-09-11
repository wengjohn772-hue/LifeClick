// Applies pending migrations and exits. Migrations also run automatically on
// the API's first request; this is for CI, deploy hooks, and manual runs.
import { ensureSchema } from './migrate.js';
import { pool, hasDatabase } from './pool.js';

if (!hasDatabase()) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const result = await ensureSchema();
await pool.end().catch(() => undefined);

if (!result.ok) {
  console.error(`Migrations failed: ${result.reason}`);
  process.exit(1);
}

console.log('Migrations are up to date.');
