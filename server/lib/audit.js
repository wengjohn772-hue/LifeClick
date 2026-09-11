import { query, hasDatabase } from '../db/pool.js';
import { config } from '../config.js';

/**
 * Client IP. `app.set('trust proxy', 1)` makes Express honour a single proxy
 * hop, which is what Vercel and most platforms put in front of the app, so
 * req.ip is the caller rather than the load balancer.
 */
export function clientIp(req) {
  return (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 64) || null;
}

export function userAgent(req) {
  return (req.headers['user-agent'] || '').slice(0, 500) || null;
}

/**
 * Records a security-relevant event (sign-in, refresh, deletion...).
 *
 * Never throws and never blocks the caller's response on failure: losing an
 * audit row must not turn a successful sign-in into an error.
 */
export async function recordSecurityEvent(req, { userId, eventType, email, outcome = 'success', detail }) {
  if (!hasDatabase() || !config.securityLogging) return;

  try {
    await query(
      `INSERT INTO security_events (user_id, event_type, email, ip_address, user_agent, outcome, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId ?? null, eventType, email ?? null, clientIp(req), userAgent(req), outcome, detail ?? null]
    );
  } catch (error) {
    console.warn('[audit] security event not recorded:', error.message);
  }
}

/** Records consent as given at a point in time, with the version agreed to. */
export async function recordConsent(req, userId, consent, termsVersion) {
  await query(
    `INSERT INTO user_consents
       (user_id, terms_version, location_tracking, background_monitoring, ip_logging, contact_escalation, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      termsVersion,
      Boolean(consent.locationTracking),
      Boolean(consent.backgroundMonitoring),
      Boolean(consent.ipLogging),
      Boolean(consent.contactEscalation),
      clientIp(req),
      userAgent(req),
    ]
  );
}

// Paths whose bodies or volume make them uninteresting to log in full.
const PATH_MAX = 200;

/**
 * Logs every authenticated request.
 *
 * This is deliberately the highest-volume table in the schema; a device
 * reporting background location once a minute produces ~1,440 rows a day on its
 * own. The safety sweep prunes it to `config.accessLogRetentionDays`, and
 * ACCESS_LOG_ENABLED=false turns it off without a redeploy of the clients.
 */
export function accessLogger(req, res, next) {
  if (!config.accessLogging || !hasDatabase()) return next();

  res.on('finish', () => {
    // Only authenticated traffic; requireAuth has populated req.user by now.
    if (!req.user?.id) return;

    const path = String(req.baseUrl || '' ) + String(req.path || '');

    query(
      `INSERT INTO api_access_log (user_id, method, path, status, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.id,
        req.method,
        path.slice(0, PATH_MAX),
        res.statusCode,
        clientIp(req),
        userAgent(req),
      ]
    ).catch((error) => {
      console.warn('[audit] access log not recorded:', error.message);
    });
  });

  return next();
}

/** Deletes audit rows past their retention window. Called by the safety sweep. */
export async function pruneAuditLogs() {
  const access = await query(
    `DELETE FROM api_access_log WHERE created_at < NOW() - make_interval(days => $1::int)`,
    [config.accessLogRetentionDays]
  );
  const security = await query(
    `DELETE FROM security_events WHERE created_at < NOW() - make_interval(days => $1::int)`,
    [config.securityLogRetentionDays]
  );
  const locations = await query(
    `DELETE FROM location_events WHERE captured_at < NOW() - make_interval(days => $1::int)`,
    [config.locationRetentionDays]
  );

  return {
    accessLogDeleted: access.rowCount,
    securityEventsDeleted: security.rowCount,
    locationEventsDeleted: locations.rowCount,
  };
}
