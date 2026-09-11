import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const ISSUER = 'lifeclick';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email },
    config.jwtSecret,
    { expiresIn: config.accessTokenTtlSeconds, issuer: ISSUER }
  );
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: ISSUER });
    return { ok: true, payload };
  } catch (error) {
    // Distinguished so the client knows to refresh rather than sign in again.
    return { ok: false, expired: error.name === 'TokenExpiredError' };
  }
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Issues a refresh token and records its hash so it can be revoked. */
export async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlSeconds * 1000);

  await query(
    `INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashRefreshToken(token), expiresAt]
  );

  return { token, expiresAt };
}

/**
 * Validates a refresh token and rotates it, so a stolen token is usable at most
 * once before the legitimate client invalidates it.
 */
export async function rotateRefreshToken(token) {
  const tokenHash = hashRefreshToken(token);
  const { rows } = await query(
    `SELECT id, user_id, expires_at, revoked_at
     FROM auth_sessions
     WHERE refresh_token_hash = $1`,
    [tokenHash]
  );

  const session = rows[0];
  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  await query('UPDATE auth_sessions SET revoked_at = NOW(), last_used_at = NOW() WHERE id = $1', [session.id]);
  const next = await issueRefreshToken(session.user_id);
  return { userId: session.user_id, ...next };
}

export async function revokeRefreshToken(token) {
  if (!token) return;
  await query(
    'UPDATE auth_sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1 AND revoked_at IS NULL',
    [hashRefreshToken(token)]
  );
}

export async function revokeAllSessions(userId) {
  await query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}
