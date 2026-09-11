import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { requireDatabase } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/errors.js';
import { runSafetySweep } from '../lib/safetyEngine.js';
import { pruneAuditLogs } from '../lib/audit.js';

export const jobsRouter = Router();

function timingSafeCompare(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

/**
 * Guards the scheduler endpoints with a shared secret.
 *
 * Fails closed: with no CRON_SECRET set, the sweep cannot run at all rather
 * than being publicly triggerable. The trade-off is that monitoring is off
 * until the secret is configured, which is the safe direction.
 */
function requireCronSecret(req, res, next) {
  if (!config.cronSecret) {
    return res.status(503).json({
      error: 'CRON_SECRET is not configured, so scheduled safety monitoring is disabled.',
      code: 'cron_not_configured',
    });
  }

  const provided =
    req.get('x-cron-secret') ||
    (req.get('authorization') || '').replace(/^Bearer /, '') ||
    '';

  if (!provided || !timingSafeCompare(provided, config.cronSecret)) {
    return res.status(401).json({ error: 'Invalid scheduler credentials.', code: 'cron_unauthorized' });
  }

  return next();
}

jobsRouter.use(requireCronSecret, requireDatabase);

/**
 * The safety monitor. Call this on a schedule — every minute is appropriate,
 * since detection latency is bounded by the interval between runs.
 */
jobsRouter.post(
  '/safety-sweep',
  asyncRoute(async (_req, res) => {
    const result = await runSafetySweep();
    return res.json(result);
  })
);

/** Retention enforcement. Safe to run hourly or daily. */
jobsRouter.post(
  '/prune',
  asyncRoute(async (_req, res) => {
    const result = await pruneAuditLogs();
    return res.json({ ok: true, ...result });
  })
);

// GET aliases: several free cron services can only issue GET requests.
jobsRouter.get('/safety-sweep', asyncRoute(async (_req, res) => res.json(await runSafetySweep())));
jobsRouter.get('/prune', asyncRoute(async (_req, res) => res.json({ ok: true, ...(await pruneAuditLogs()) })));
