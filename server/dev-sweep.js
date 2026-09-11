// Development stand-in for the production cron scheduler.
//
// In production the sweep is triggered by an external scheduler calling
// POST /api/jobs/safety-sweep (see README). This just calls the same endpoint
// on a loop so background monitoring can be exercised locally.
//
//   node server/dev-sweep.js [intervalSeconds]

import 'dotenv/config';

const BASE = process.env.SWEEP_TARGET || `http://localhost:${process.env.PORT || 4000}`;
const INTERVAL_SECONDS = Number(process.argv[2] || 60);
const SECRET = process.env.CRON_SECRET;

if (!SECRET) {
  console.error('CRON_SECRET is not set, so the sweep endpoint is disabled. Add it to .env.');
  process.exit(1);
}

async function sweep() {
  try {
    const response = await fetch(`${BASE}/api/jobs/safety-sweep`, {
      method: 'POST',
      headers: { 'x-cron-secret': SECRET, 'Content-Type': 'application/json' },
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(`[sweep] ${response.status}`, result);
      return;
    }

    // Quiet unless something actually happened, so the log stays readable.
    if (result.incidentsOpened || result.incidentsEscalated || result.failures?.length) {
      console.log(
        `[sweep] ${new Date().toLocaleTimeString()} opened=${result.incidentsOpened} escalated=${result.incidentsEscalated}` +
          (result.failures?.length ? ` failures=${JSON.stringify(result.failures)}` : '')
      );
    }
  } catch (error) {
    console.error('[sweep] request failed:', error.message);
  }
}

console.log(`Safety sweep running every ${INTERVAL_SECONDS}s against ${BASE}`);
await sweep();
setInterval(sweep, INTERVAL_SECONDS * 1000);
