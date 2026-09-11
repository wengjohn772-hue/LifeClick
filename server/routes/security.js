import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { recordConsent, recordSecurityEvent } from '../lib/audit.js';

export const securityRouter = Router();

securityRouter.use(requireAuth, requireDatabase);

const consentSchema = z.object({
  locationTracking: z.boolean(),
  backgroundMonitoring: z.boolean(),
  ipLogging: z.boolean(),
  contactEscalation: z.boolean(),
  termsVersion: z.string().trim().max(32).optional(),
});

/** What the user has agreed to, and whether it matches the current terms. */
securityRouter.get(
  '/consent',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, consent: null, termsVersion: config.termsVersion, current: false });

    const { rows } = await query(
      `SELECT * FROM user_consents
       WHERE user_id = $1 AND withdrawn_at IS NULL
       ORDER BY accepted_at DESC LIMIT 1`,
      [req.user.id]
    );

    const consent = rows[0];
    return res.json({
      ok: true,
      termsVersion: config.termsVersion,
      current: Boolean(consent) && consent.terms_version === config.termsVersion,
      consent: consent
        ? {
            termsVersion: consent.terms_version,
            locationTracking: consent.location_tracking,
            backgroundMonitoring: consent.background_monitoring,
            ipLogging: consent.ip_logging,
            contactEscalation: consent.contact_escalation,
            acceptedAt: consent.accepted_at,
          }
        : null,
    });
  })
);

securityRouter.post(
  '/consent',
  validateBody(consentSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    await recordConsent(req, req.user.id, req.body, req.body.termsVersion || config.termsVersion);
    await recordSecurityEvent(req, {
      userId: req.user.id,
      eventType: 'consent_updated',
      detail: `terms=${req.body.termsVersion || config.termsVersion}`,
    });

    return res.status(201).json({ ok: true, saved: true });
  })
);

/**
 * Withdrawing consent must actually stop the processing it authorised, not just
 * record a preference — so it also halts monitoring and clears location history.
 */
securityRouter.post(
  '/consent/withdraw',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    await query('UPDATE user_consents SET withdrawn_at = NOW() WHERE user_id = $1 AND withdrawn_at IS NULL', [
      req.user.id,
    ]);
    await query(
      `UPDATE user_safety_state SET monitoring_enabled = FALSE, next_check_in_at = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [req.user.id]
    );
    const cleared = await query('DELETE FROM location_events WHERE user_id = $1', [req.user.id]);

    await recordSecurityEvent(req, { userId: req.user.id, eventType: 'consent_withdrawn' });

    return res.json({ ok: true, monitoringStopped: true, locationEventsDeleted: cleared.rowCount });
  })
);

/**
 * The user's own recent activity — the point of collecting this data. Seeing an
 * unfamiliar sign-in is what turns an audit log into a security feature.
 */
securityRouter.get(
  '/activity',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, events: [], requestSummary: [] });

    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

    const { rows: events } = await query(
      `SELECT event_type, ip_address, user_agent, outcome, created_at
       FROM security_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );

    // Raw access rows are far too many to show, so they are summarised per
    // IP/day rather than listed.
    const { rows: requestSummary } = await query(
      `SELECT ip_address,
              COUNT(*)::int AS requests,
              MIN(created_at) AS first_seen,
              MAX(created_at) AS last_seen
       FROM api_access_log
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
       GROUP BY ip_address
       ORDER BY last_seen DESC
       LIMIT 20`,
      [req.user.id]
    );

    return res.json({
      ok: true,
      events: events.map((row) => ({
        type: row.event_type,
        ip: row.ip_address,
        device: row.user_agent,
        outcome: row.outcome,
        at: row.created_at,
      })),
      requestSummary: requestSummary.map((row) => ({
        ip: row.ip_address,
        requests: row.requests,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
      })),
      retention: {
        accessLogDays: config.accessLogRetentionDays,
        securityLogDays: config.securityLogRetentionDays,
        locationDays: config.locationRetentionDays,
      },
    });
  })
);

/** Open/recent incidents, so the app can prompt "are you safe?" on launch. */
securityRouter.get(
  '/incidents',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, incidents: [] });

    const { rows } = await query(
      `SELECT id, status, stage, missed_deadline_at, opened_at, escalated_at, resolved_at, resolution
       FROM incidents WHERE user_id = $1
       ORDER BY opened_at DESC LIMIT 20`,
      [req.user.id]
    );

    return res.json({
      ok: true,
      incidents: rows.map((row) => ({
        id: row.id,
        status: row.status,
        stage: row.stage,
        missedDeadlineAt: row.missed_deadline_at,
        openedAt: row.opened_at,
        escalatedAt: row.escalated_at,
        resolvedAt: row.resolved_at,
        resolution: row.resolution,
      })),
    });
  })
);
