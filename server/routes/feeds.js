import crypto from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { requireAuth, requireDatabase } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncRoute } from '../middleware/errors.js';

export const feedsRouter = Router();

export const FEED_TAGS = ['Alert', 'Resolved', 'Notice', 'Update'];

/** Compressed on-device before upload; this is the server-side backstop. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Images arrive base64-encoded in the JSON body, so this router needs a larger
// limit than the 100kb applied globally.
feedsRouter.use(express.json({ limit: '8mb' }));
feedsRouter.use(requireAuth, requireDatabase);

const DEMO_POSTS = [
  { id: 'demo-1', userId: 'user-7F42', area: 'Riverside Dr.', country: 'Nigeria', state: 'Lagos', tag: 'Notice', body: 'Streetlights are out along the whole stretch past the bridge.', likes: 12, reposts: 3, likedByMe: false, repostedByMe: false, imageUrl: 'https://picsum.photos/seed/lifeclick-riverside/800/500', mine: false, createdAt: new Date().toISOString() },
  { id: 'demo-2', userId: 'user-3K91', area: 'Market Square', country: 'Nigeria', state: 'Lagos', tag: 'Alert', body: 'Keep devices out of sight while waiting near the taxi rank.', likes: 41, reposts: 18, likedByMe: false, repostedByMe: false, imageUrl: 'https://picsum.photos/seed/lifeclick-market/800/500', mine: false, createdAt: new Date().toISOString() },
];

/**
 * Posts are anonymous to readers: the author's account is never exposed, only
 * a stable per-post handle. `mine` is computed for the caller alone.
 */
function serializePost(row, viewerId) {
  return {
    id: String(row.id),
    userId: row.anon_handle,
    area: row.area,
    country: row.country,
    state: row.state,
    body: row.body,
    tag: row.tag,
    likes: Number(row.likes) || 0,
    reposts: Number(row.reposts) || 0,
    likedByMe: Boolean(row.liked_by_me),
    repostedByMe: Boolean(row.reposted_by_me),
    imageUrl: row.image_id ? `/api/feeds/images/${row.image_id}` : row.image_url || null,
    mine: row.author_user_id != null && row.author_user_id === viewerId,
    createdAt: row.created_at,
  };
}

// Displayed counts are the post's baseline (seeded demo engagement) plus real
// reactions. Without the baseline every seeded post would read as zero likes
// the moment reactions became row-backed.
const POST_SELECT = `
  SELECT p.id, p.anon_handle, p.area, p.country, p.state, p.body, p.tag,
         p.image_id, p.image_url, p.author_user_id, p.created_at,
         p.likes   + (SELECT COUNT(*) FROM feed_reactions r WHERE r.post_id = p.id AND r.kind = 'like')   AS likes,
         p.reposts + (SELECT COUNT(*) FROM feed_reactions r WHERE r.post_id = p.id AND r.kind = 'repost') AS reposts,
         EXISTS (SELECT 1 FROM feed_reactions r WHERE r.post_id = p.id AND r.kind = 'like'   AND r.user_id = $1) AS liked_by_me,
         EXISTS (SELECT 1 FROM feed_reactions r WHERE r.post_id = p.id AND r.kind = 'repost' AND r.user_id = $1) AS reposted_by_me
  FROM feed_posts p
`;

/* -------------------------------------------------------------- listing */

feedsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, posts: DEMO_POSTS });

    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const country = typeof req.query.country === 'string' && req.query.country !== 'all' ? req.query.country : null;
    const state = typeof req.query.state === 'string' && req.query.state !== 'all' ? req.query.state : null;

    const { rows } = await query(
      `${POST_SELECT}
       WHERE p.status = 'published'
         AND ($2::text IS NULL OR p.country = $2)
         AND ($3::text IS NULL OR p.state = $3)
       ORDER BY p.created_at DESC
       LIMIT $4`,
      [req.user.id, country, state, limit]
    );

    return res.json({ ok: true, posts: rows.map((row) => serializePost(row, req.user.id)) });
  })
);

/** Drives the location slicer. */
feedsRouter.get(
  '/regions',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, regions: [] });

    const { rows } = await query(
      `SELECT country, state, COUNT(*)::int AS posts
       FROM feed_posts
       WHERE status = 'published' AND country IS NOT NULL
       GROUP BY country, state
       ORDER BY country ASC, posts DESC`
    );

    // Grouped by country so the UI can show a country row and its states.
    const byCountry = new Map();
    for (const row of rows) {
      if (!byCountry.has(row.country)) byCountry.set(row.country, { country: row.country, posts: 0, states: [] });
      const entry = byCountry.get(row.country);
      entry.posts += row.posts;
      if (row.state) entry.states.push({ state: row.state, posts: row.posts });
    }

    return res.json({ ok: true, regions: [...byCountry.values()] });
  })
);

/** The author's own posts, for the Profile tab. */
feedsRouter.get(
  '/mine',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, posts: [] });

    const { rows } = await query(
      `${POST_SELECT}
       WHERE p.author_user_id = $1
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    return res.json({ ok: true, posts: rows.map((row) => serializePost(row, req.user.id)) });
  })
);

/* -------------------------------------------------------------- images */

feedsRouter.get(
  '/images/:id',
  asyncRoute(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid image id.', code: 'invalid_id' });

    const { rows } = await query('SELECT mime_type, data FROM feed_images WHERE id = $1', [id.data]);
    if (!rows[0]) return res.status(404).json({ error: 'Image not found.', code: 'not_found' });

    res.setHeader('Content-Type', rows[0].mime_type);
    // Image bytes are immutable once uploaded, so they cache indefinitely.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(rows[0].data);
  })
);

/* ------------------------------------------------------------ creation */

const createPostSchema = z.object({
  body: z.string().trim().min(4).max(1000),
  tag: z.enum(['Alert', 'Resolved', 'Notice', 'Update']),
  area: z.string().trim().max(160).optional(),
  country: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  image: z
    .object({
      base64: z.string().min(1),
      mimeType: z.string().trim().max(40).optional().default('image/jpeg'),
      width: z.coerce.number().int().positive().optional(),
      height: z.coerce.number().int().positive().optional(),
    })
    .optional(),
});

/** A per-post pseudonym, so readers cannot correlate a user's posts. */
function anonHandle() {
  return `user-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

feedsRouter.post(
  '/',
  validateBody(createPostSchema),
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    const { body, tag, area, country, state, image } = req.body;

    let buffer = null;
    if (image) {
      if (!ALLOWED_MIME.has(image.mimeType)) {
        return res.status(400).json({ error: 'Images must be JPEG, PNG, or WebP.', code: 'bad_image_type' });
      }
      buffer = Buffer.from(image.base64, 'base64');
      if (!buffer.length) {
        return res.status(400).json({ error: 'The image could not be decoded.', code: 'bad_image' });
      }
      if (buffer.length > MAX_IMAGE_BYTES) {
        return res.status(413).json({ error: 'That image is too large. Keep it under 2 MB.', code: 'image_too_large' });
      }
    }

    const post = await withTransaction(async (client) => {
      let imageId = null;
      if (buffer) {
        const saved = await client.query(
          `INSERT INTO feed_images (user_id, mime_type, width, height, byte_size, data)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [req.user.id, image.mimeType, image.width ?? null, image.height ?? null, buffer.length, buffer]
        );
        imageId = saved.rows[0].id;
      }

      const { rows } = await client.query(
        `INSERT INTO feed_posts (author_user_id, anon_handle, area, country, state, body, tag, image_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id, anon_handle, area, country, state, body, tag, image_id, image_url, author_user_id, created_at,
                   0 AS likes, 0 AS reposts, FALSE AS liked_by_me, FALSE AS reposted_by_me`,
        [req.user.id, anonHandle(), area ?? null, country ?? null, state ?? null, body, tag, imageId]
      );
      return rows[0];
    });

    return res.status(201).json({ ok: true, saved: true, post: serializePost(post, req.user.id) });
  })
);

feedsRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    if (req.demoMode) return res.json({ ok: true, deleted: false });

    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid post id.', code: 'invalid_id' });

    // Scoped to the author, so one user cannot delete another's post.
    const result = await query('DELETE FROM feed_posts WHERE id = $1 AND author_user_id = $2', [id.data, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Post not found.', code: 'not_found' });

    return res.json({ ok: true, deleted: true });
  })
);

/* ----------------------------------------------------------- reactions */

const reactionSchema = z.object({ kind: z.enum(['like', 'repost']) });

/**
 * Toggles a reaction. Stored as a row per user, so tapping twice removes it and
 * a user cannot inflate a post by tapping repeatedly.
 */
feedsRouter.post(
  '/:id/reactions',
  validateBody(reactionSchema),
  asyncRoute(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid post id.', code: 'invalid_id' });

    if (req.demoMode) return res.status(202).json({ ok: true, saved: false });

    const { kind } = req.body;

    const removed = await query('DELETE FROM feed_reactions WHERE post_id = $1 AND user_id = $2 AND kind = $3', [
      id.data,
      req.user.id,
      kind,
    ]);

    if (!removed.rowCount) {
      try {
        await query('INSERT INTO feed_reactions (post_id, user_id, kind) VALUES ($1, $2, $3)', [
          id.data,
          req.user.id,
          kind,
        ]);
      } catch (error) {
        // 23503 = the post disappeared between the delete and the insert.
        if (error.code === '23503') return res.status(404).json({ error: 'Post not found.', code: 'not_found' });
        if (error.code !== '23505') throw error;
      }
    }

    // Mirrors POST_SELECT so the optimistic UI and the list agree.
    const { rows } = await query(
      `SELECT
         p.likes   + (SELECT COUNT(*) FROM feed_reactions r WHERE r.post_id = p.id AND r.kind = 'like')   AS likes,
         p.reposts + (SELECT COUNT(*) FROM feed_reactions r WHERE r.post_id = p.id AND r.kind = 'repost') AS reposts,
         EXISTS (SELECT 1 FROM feed_reactions r WHERE r.post_id = p.id AND r.kind = 'like'   AND r.user_id = $2) AS liked_by_me,
         EXISTS (SELECT 1 FROM feed_reactions r WHERE r.post_id = p.id AND r.kind = 'repost' AND r.user_id = $2) AS reposted_by_me
       FROM feed_posts p WHERE p.id = $1`,
      [id.data, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found.', code: 'not_found' });

    return res.json({
      ok: true,
      likes: Number(rows[0].likes) || 0,
      reposts: Number(rows[0].reposts) || 0,
      likedByMe: rows[0].liked_by_me,
      repostedByMe: rows[0].reposted_by_me,
    });
  })
);
