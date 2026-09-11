import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      // Neon and most hosted Postgres providers require TLS. Local development
      // against a plain postgres:// on localhost does not.
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
      max: config.dbPoolMax,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

export function hasDatabase() {
  return Boolean(pool);
}

const CONNECTION_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET']);

/** True when the failure is the database being unreachable rather than a bad query. */
export function isConnectionError(error) {
  return Boolean(error) && CONNECTION_ERROR_CODES.has(error.code);
}

export async function query(text, params) {
  if (!pool) throw Object.assign(new Error('Database is not configured.'), { code: 'ENOTFOUND' });
  return pool.query(text, params);
}

/** Runs `handler` inside a transaction, rolling back on any throw. */
export async function withTransaction(handler) {
  if (!pool) throw Object.assign(new Error('Database is not configured.'), { code: 'ENOTFOUND' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
