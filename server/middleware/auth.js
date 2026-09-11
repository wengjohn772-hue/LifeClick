import { verifyAccessToken } from '../lib/tokens.js';
import { hasDatabase } from '../db/pool.js';
import { config } from '../config.js';

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/**
 * Rejects the request unless it carries a valid access token, and attaches the
 * authenticated user to `req.user`.
 *
 * Route handlers must take the user ID from `req.user.id` and never from the
 * request body — trusting a body-supplied `userId` is what allowed any caller
 * to write location rows against any account.
 */
export function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.', code: 'no_token' });
  }

  const result = verifyAccessToken(token);
  if (!result.ok) {
    return res.status(401).json({
      error: result.expired ? 'Access token expired.' : 'Invalid access token.',
      code: result.expired ? 'token_expired' : 'token_invalid',
    });
  }

  const id = Number(result.payload.sub);
  req.user = {
    id: Number.isFinite(id) ? id : result.payload.sub,
    email: result.payload.email,
  };
  return next();
}

/**
 * Guards routes that cannot function without persistence. Demo mode is an
 * explicit opt-in, so a deploy that merely forgot DATABASE_URL fails closed
 * instead of handing out sessions.
 */
export function requireDatabase(req, res, next) {
  if (hasDatabase()) return next();

  if (config.allowDemoAuth) {
    req.demoMode = true;
    return next();
  }

  return res.status(503).json({
    error: 'The LifeClick database is not configured. Set DATABASE_URL, or set ALLOW_DEMO_AUTH=true for prototype use.',
    code: 'database_unavailable',
  });
}
