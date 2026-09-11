import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody, profileSchema } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { USER_COLUMNS, serializeUser } from '../lib/users.js';

export const profileRouter = Router();

profileRouter.use(requireAuth, requireDatabase);

profileRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, user: { id: req.user.id, email: req.user.email } });

    const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [req.user.id]);
    const user = serializeUser(rows[0]);
    if (!user) return res.status(404).json({ error: 'Account not found.', code: 'not_found' });
    return res.json({ ok: true, user });
  })
);

const COLUMN_BY_FIELD = {
  name: 'name',
  phone: 'phone',
  address: 'address',
  avatarId: 'avatar_id',
  role: 'role',
  postsEnabled: 'posts_enabled',
  feedsEnabled: 'feeds_enabled',
};

profileRouter.patch(
  '/',
  validateBody(profileSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    // Build the SET clause from the whitelist above so a client cannot name an
    // arbitrary column. Email is deliberately not updatable here: it is the
    // login identifier and changing it needs a verification flow.
    const assignments = [];
    const values = [];
    for (const [field, column] of Object.entries(COLUMN_BY_FIELD)) {
      if (req.body[field] === undefined) continue;
      values.push(req.body[field]);
      assignments.push(`${column} = $${values.length}`);
    }

    if (!assignments.length) {
      return res.status(400).json({ error: 'No supported profile fields were provided.', code: 'no_changes' });
    }

    values.push(req.user.id);
    const { rows } = await query(
      `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING ${USER_COLUMNS}`,
      values
    );

    const user = serializeUser(rows[0]);
    if (!user) return res.status(404).json({ error: 'Account not found.', code: 'not_found' });
    return res.json({ ok: true, user });
  })
);
