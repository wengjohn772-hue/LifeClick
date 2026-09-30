// A local Postgres for development and tests, with nothing to install.
//
// PGlite is real PostgreSQL compiled to WebAssembly; this exposes it over the
// normal PG wire protocol so `pg` (and psql, and DBeaver) connect to it
// unmodified. It stands in for Neon on a machine with no Postgres installed.
//
//   npm run db          # starts it on 5432
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
//
// Caveat worth knowing: it serves ONE connection at a time. Set DB_POOL_MAX=1
// when pointing the API at it, and do not run two test suites concurrently.
// Data is persisted to disk, so it survives a restart of this process.

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const DATA_DIR = process.env.DEV_DB_DIR || new URL('../.devdb', import.meta.url).pathname;
const PORT = Number(process.env.DEV_DB_PORT || 5432);

const db = await PGlite.create({ dataDir: DATA_DIR });
const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
await server.start();

console.log(`Local Postgres ready on 127.0.0.1:${PORT}`);
console.log(`  data: ${DATA_DIR}`);
console.log('  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres DB_POOL_MAX=1');

const shutdown = async () => {
  await server.stop().catch(() => undefined);
  await db.close().catch(() => undefined);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
