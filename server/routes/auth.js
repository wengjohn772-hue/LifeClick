import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { query, withTransaction, hasDatabase } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken, revokeAllSessions } from '../lib/tokens.js';
import { USER_COLUMNS, serializeUser, serializeContact, generateFafId } from '../lib/users.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody, registerSchema, loginSchema, refreshSchema } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { recordSecurityEvent } from '../lib/audit.js';
import { pauseMonitoring } from '../lib/safetyEngine.js';

export const authRouter = Router();

// Credential endpoints are the highest-value target, so they get a tighter
// budget than the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again shortly.', code: 'rate_limited' },
});

function demoSession(user) {
  return {
    ok: true,
    saved: false,
    demo: true,
    user,
    accessToken: signAccessToken(user),
    expiresIn: config.accessTokenTtlSeconds,
    message: 'Database not configured. This session is local to the prototype and is not persisted.',
  };
}

async function createSession(user) {
  const refresh = await issueRefreshToken(user.id);
  return {
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
    expiresIn: config.accessTokenTtlSeconds,
  };
}

authRouter.post(
  '/register',
  authLimiter,
  requireDatabase,
  validateBody(registerSchema),
  asyncRoute(async (req, res) => {
    const { name, email, password, phone, address, trustedContacts } = req.body;

    if (req.demoMode) {
      return res.status(202).json(
        demoSession({
          id: `demo-${Date.now()}`,
          name,
          email,
          phone,
          address,
          fafId: 'FAF-DEMO',
          provider: 'email',
          avatarId: 'violet',
          role: 'Member',
          postsEnabled: true,
          feedsEnabled: true,
        })
      );
    }

    const passwordHash = await hashPassword(password);

    const created = await withTransaction(async (client) => {
      let row;
      // Retry only the FaF ID collision; any other constraint failure is real.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const result = await client.query(
            `INSERT INTO users (email, name, phone, address, faf_id, password_hash, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING ${USER_COLUMNS}`,
            [email, name, phone, address, generateFafId(), passwordHash]
          );
          row = result.rows[0];
          break;
        } catch (error) {
          if (error.code === '23505' && String(error.constraint || '').includes('faf_id')) continue;
          throw error;
        }
      }
      if (!row) throw new Error('Could not allocate a unique FaF ID.');

      for (const contact of trustedContacts) {
        await client.query(
          `INSERT INTO trusted_contacts (user_id, name, phone, relationship, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [row.id, contact.name, contact.phone, contact.relation]
        );
      }

      await client.query(
        `INSERT INTO user_settings (user_id, check_in_interval)
         VALUES ($1, 30)
         ON CONFLICT (user_id) DO NOTHING`,
        [row.id]
      );

      return row;
    });

    const user = serializeUser(created);
    const session = await createSession(user);

    await recordSecurityEvent(req, { userId: user.id, eventType: 'register', email: user.email });

    return res.status(201).json({
      ok: true,
      saved: true,
      user,
      trustedContacts,
      ...session,
    });
  })
);

authRouter.post(
  '/login',
  authLimiter,
  requireDatabase,
  validateBody(loginSchema),
  asyncRoute(async (req, res) => {
    const { email, password, method } = req.body;

    if (req.demoMode) {
      return res.json(
        demoSession({
          id: 'demo-user',
          name: method === 'google' ? 'Ava Brooks' : 'LifeClick User',
          email,
          fafId: 'FAF-DEMO',
          provider: method,
          avatarId: 'violet',
          role: 'Member',
          postsEnabled: true,
          feedsEnabled: true,
        })
      );
    }

    const { rows } = await query(
      `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`,
      [email]
    );
    const row = rows[0];

    // Same response for unknown email and wrong password, so the endpoint does
    // not confirm which addresses have accounts.
    const invalid = async (userId) => {
      // Failed attempts are the most important thing in the log: repeated
      // failures from an unfamiliar IP are exactly what the user needs to see.
      await recordSecurityEvent(req, {
        userId: userId ?? null,
        eventType: 'login_failed',
        email,
        outcome: 'failure',
      });
      return res.status(401).json({ error: 'Invalid email or password.', code: 'invalid_credentials' });
    };
    if (!row) return invalid();

    const { valid, needsUpgrade } = await verifyPassword(password, row.password_hash);
    if (!valid) return invalid(row.id);

    if (needsUpgrade) {
      // The stored value was plaintext from before hashing existed. Replace it
      // now that we have verified the password.
      const upgraded = await hashPassword(password);
      await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [upgraded, row.id]);
      console.log(`[auth] upgraded plaintext password to bcrypt for user ${row.id}`);
    }

    const contacts = await query(
      `SELECT id, name, phone, relationship FROM trusted_contacts WHERE user_id = $1 ORDER BY created_at ASC`,
      [row.id]
    );

    const user = serializeUser(row, method);
    const session = await createSession(user);

    await recordSecurityEvent(req, {
      userId: user.id,
      eventType: 'login',
      email: user.email,
      detail: needsUpgrade ? 'password upgraded to bcrypt' : null,
    });

    return res.json({
      ok: true,
      user,
      trustedContacts: contacts.rows.map(serializeContact),
      ...session,
    });
  })
);

authRouter.post(
  '/refresh',
  requireDatabase,
  validateBody(refreshSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) {
      return res.status(400).json({ error: 'Refresh is unavailable in demo mode.', code: 'demo_mode' });
    }

    const rotated = await rotateRefreshToken(req.body.refreshToken);
    if (!rotated) {
      return res.status(401).json({ error: 'Refresh token is invalid or expired.', code: 'refresh_invalid' });
    }

    const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [rotated.userId]);
    const user = serializeUser(rows[0]);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.', code: 'refresh_invalid' });

    return res.json({
      ok: true,
      user,
      accessToken: signAccessToken(user),
      refreshToken: rotated.token,
      expiresIn: config.accessTokenTtlSeconds,
    });
  })
);

authRouter.post(
  '/logout',
  asyncRoute(async (req, res) => {
    if (hasDatabase() && req.body?.refreshToken) {
      await revokeRefreshToken(String(req.body.refreshToken));
    }

    // Stop server-side monitoring: a signed-out phone is not being watched, so
    // escalating on its behalf would alarm trusted contacts for no reason.
    const userId = Number(req.body?.userId);
    if (hasDatabase() && Number.isFinite(userId)) {
      await pauseMonitoring(userId).catch(() => undefined);
      await recordSecurityEvent(req, { userId, eventType: 'logout' });
    }

    return res.json({ ok: true });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  requireDatabase,
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, user: { id: req.user.id, email: req.user.email } });

    const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [req.user.id]);
    const user = serializeUser(rows[0]);
    if (!user) return res.status(404).json({ error: 'Account not found.', code: 'not_found' });
    return res.json({ ok: true, user });
  })
);

authRouter.delete(
  '/account',
  requireAuth,
  requireDatabase,
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, deleted: false });

    // Trusted contacts, check-ins, locations, push tokens and sessions all
    // cascade from users.id.
    // Logged before the delete, since the row cascades away with the account.
    await recordSecurityEvent(req, {
      userId: req.user.id,
      eventType: 'account_deleted',
      email: req.user.email,
    });

    await revokeAllSessions(req.user.id);
    const result = await query('DELETE FROM users WHERE id = $1', [req.user.id]);
    return res.json({ ok: true, deleted: result.rowCount > 0 });
  })
);
