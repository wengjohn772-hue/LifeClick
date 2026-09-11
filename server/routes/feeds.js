import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/errors.js';

export const feedsRouter = Router();

feedsRouter.use(requireAuth, requireDatabase);

// Shown while the database is unreachable in demo mode, so the screen still
// renders something during investor prototypes.
const DEMO_POSTS = [
  { id: 'demo-1', userId: 'user-7F42', area: 'Riverside Dr.', tag: 'Notice', body: 'Streetlights are out along the whole stretch past the bridge.', likes: 12, reposts: 3, createdAt: new Date().toISOString() },
  { id: 'demo-2', userId: 'user-3K91', area: 'Market Square', tag: 'Alert', body: 'Keep devices out of sight while waiting near the taxi rank.', likes: 41, reposts: 18, createdAt: new Date().toISOString() },
  { id: 'demo-3', userId: 'user-8M16', area: 'Campus North', tag: 'Resolved', body: 'The reported student has been found safe and is back home.', likes: 96, reposts: 27, createdAt: new Date().toISOString() },
];

feedsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, posts: DEMO_POSTS });

    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const { rows } = await query(
      `SELECT id, anon_handle, area, body, tag, likes, reposts, created_at
       FROM feed_posts
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({
      ok: true,
      // Posts stay anonymous: the author's account is never exposed to readers.
      posts: rows.map((row) => ({
        id: String(row.id),
        userId: row.anon_handle,
        area: row.area,
        body: row.body,
        tag: row.tag,
        likes: row.likes,
        reposts: row.reposts,
        createdAt: row.created_at,
      })),
    });
  })
);
