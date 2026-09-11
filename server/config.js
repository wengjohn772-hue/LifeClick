import crypto from 'node:crypto';
import 'dotenv/config';

const isProduction = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';

/**
 * Demo mode lets the API issue sessions without a database so the Vercel
 * prototype keeps working for investor demos. It is an authentication bypass by
 * design, so it must be opted into explicitly and can never be reached by an
 * accidentally misconfigured deploy.
 */
const allowDemoAuth = process.env.ALLOW_DEMO_AUTH === 'true';

function resolveJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 32) return configured;

  if (isProduction) {
    // Fail closed. A production deploy without a stable secret would either
    // sign tokens with a guessable key or invalidate every session on each
    // cold start.
    throw new Error(
      'JWT_SECRET must be set to at least 32 characters in production. Generate one with: openssl rand -base64 48'
    );
  }

  if (configured) {
    console.warn('[config] JWT_SECRET is shorter than 32 characters. Using it anyway in development.');
    return configured;
  }

  console.warn(
    '[config] JWT_SECRET is not set. Generating an ephemeral development secret; all sessions will be invalidated when the server restarts.'
  );
  return crypto.randomBytes(48).toString('base64');
}

function resolveAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length) return configured;
  if (isProduction) return [];

  return ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'];
}

export const config = {
  isProduction,
  allowDemoAuth,
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: resolveJwtSecret(),
  allowedOrigins: resolveAllowedOrigins(),
  // Short-lived access token, long-lived refresh token stored hashed in the
  // database so it can be revoked on sign-out or account deletion.
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 60 * 60),
  refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  // Serverless keeps this small to avoid exhausting the database's connection
  // limit across many warm instances. Set DB_POOL_MAX=1 when developing against
  // a single-connection stand-in such as PGlite.
  dbPoolMax: Number(process.env.DB_POOL_MAX || (isProduction ? 3 : 10)),

  // Shared secret for the scheduler endpoint. Without it the safety sweep
  // cannot be triggered at all, so monitoring stays off rather than open.
  cronSecret: process.env.CRON_SECRET || '',

  // How long after a missed deadline before trusted contacts are alerted.
  escalationGraceMinutes: Number(process.env.ESCALATION_GRACE_MINUTES || 10),

  // Audit + retention. Access logging is the high-volume one; it can be turned
  // off without redeploying clients.
  accessLogging: process.env.ACCESS_LOG_ENABLED !== 'false',
  securityLogging: process.env.SECURITY_LOG_ENABLED !== 'false',
  accessLogRetentionDays: Number(process.env.ACCESS_LOG_RETENTION_DAYS || 30),
  securityLogRetentionDays: Number(process.env.SECURITY_LOG_RETENTION_DAYS || 180),
  locationRetentionDays: Number(process.env.LOCATION_RETENTION_DAYS || 90),

  // Bumped whenever the consent wording changes, so stored consent records
  // prove what the user actually agreed to.
  termsVersion: process.env.TERMS_VERSION || '2026-09-11',
};

if (config.isProduction && config.allowDemoAuth) {
  console.warn('[config] ALLOW_DEMO_AUTH is enabled in a production deploy. Any credentials will be accepted when the database is unreachable.');
}
