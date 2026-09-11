import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody, trustedContactSchema } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';
import { serializeContact } from '../lib/users.js';

export const contactsRouter = Router();

contactsRouter.use(requireAuth, requireDatabase);

const MAX_CONTACTS = 5;

contactsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, contacts: [] });

    const { rows } = await query(
      `SELECT id, name, phone, relationship
       FROM trusted_contacts
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.user.id]
    );

    return res.json({ ok: true, contacts: rows.map(serializeContact) });
  })
);

contactsRouter.post(
  '/',
  validateBody(trustedContactSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    const { rows: existing } = await query(
      'SELECT COUNT(*)::int AS count FROM trusted_contacts WHERE user_id = $1',
      [req.user.id]
    );
    if (existing[0].count >= MAX_CONTACTS) {
      return res.status(409).json({ error: `You can have at most ${MAX_CONTACTS} trusted contacts.`, code: 'limit_reached' });
    }

    const { name, phone, relation } = req.body;
    const { rows } = await query(
      `INSERT INTO trusted_contacts (user_id, name, phone, relationship, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, phone, relationship`,
      [req.user.id, name, phone, relation]
    );

    return res.status(201).json({ ok: true, contact: serializeContact(rows[0]) });
  })
);

contactsRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, deleted: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid contact id.', code: 'invalid_id' });

    // Scoped to the authenticated user so one account cannot delete another's.
    const result = await query('DELETE FROM trusted_contacts WHERE id = $1 AND user_id = $2', [id.data, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Contact not found.', code: 'not_found' });

    return res.json({ ok: true, deleted: true });
  })
);
