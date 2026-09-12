// User-authored feed posts: images, per-user reactions, and regional filtering.
export const id = '006_feed_posts_media_and_reactions';

export const sql = `
-- Uploaded images live in the database rather than object storage, which keeps
-- the prototype free of a third-party credential. Capped by the API at a size
-- the client compresses down to before upload.
CREATE TABLE IF NOT EXISTS feed_images (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mime_type VARCHAR(40) NOT NULL DEFAULT 'image/jpeg',
  width INTEGER,
  height INTEGER,
  byte_size INTEGER,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS country VARCHAR(80);
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS state VARCHAR(80);
-- Either an uploaded image (image_id) or a remote URL (seeded demo content).
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS image_id INTEGER REFERENCES feed_images(id) ON DELETE SET NULL;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'published';

CREATE INDEX IF NOT EXISTS feed_posts_region_idx ON feed_posts (country, state, created_at DESC);
CREATE INDEX IF NOT EXISTS feed_posts_author_idx ON feed_posts (author_user_id, created_at DESC);

-- Reactions are rows rather than a counter, so a like can be toggled off and a
-- user cannot inflate a post by tapping repeatedly.
CREATE TABLE IF NOT EXISTS feed_reactions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT feed_reactions_kind_check CHECK (kind IN ('like', 'repost'))
);

CREATE UNIQUE INDEX IF NOT EXISTS feed_reactions_unique
  ON feed_reactions (post_id, user_id, kind);
CREATE INDEX IF NOT EXISTS feed_reactions_post_idx ON feed_reactions (post_id, kind);

-- Give the seeded posts a region and a photograph so the feed looks real
-- before anyone has posted. picsum.photos serves stable, seeded photos and
-- needs no API key.
UPDATE feed_posts SET country = 'Nigeria', state = 'Lagos',
  image_url = 'https://picsum.photos/seed/lifeclick-riverside/800/500'
  WHERE anon_handle = 'user-7F42' AND country IS NULL;
UPDATE feed_posts SET country = 'Nigeria', state = 'Lagos',
  image_url = 'https://picsum.photos/seed/lifeclick-market/800/500'
  WHERE anon_handle = 'user-3K91' AND country IS NULL;
UPDATE feed_posts SET country = 'Nigeria', state = 'Abuja',
  image_url = 'https://picsum.photos/seed/lifeclick-campus/800/500'
  WHERE anon_handle = 'user-8M16' AND country IS NULL;
UPDATE feed_posts SET country = 'Nigeria', state = 'Rivers',
  image_url = 'https://picsum.photos/seed/lifeclick-harbour/800/500'
  WHERE anon_handle = 'user-2B08' AND country IS NULL;
UPDATE feed_posts SET country = 'Ghana', state = 'Greater Accra',
  image_url = 'https://picsum.photos/seed/lifeclick-oldtown/800/500'
  WHERE anon_handle = 'user-5X33' AND country IS NULL;

-- A few more regions so the location filter has something to filter.
INSERT INTO feed_posts (anon_handle, area, body, tag, likes, reposts, country, state, image_url, created_at)
SELECT * FROM (VALUES
  ('user-9P27', 'Ikeja GRA', 'Traffic lights at the junction have been out since morning — approach slowly.', 'Notice', 17, 4, 'Nigeria', 'Lagos', 'https://picsum.photos/seed/lifeclick-ikeja/800/500', NOW() - INTERVAL '3 hours'),
  ('user-4T61', 'Wuse II', 'Power restored across the district. The earlier outage report is resolved.', 'Resolved', 63, 11, 'Nigeria', 'Abuja', 'https://picsum.photos/seed/lifeclick-wuse/800/500', NOW() - INTERVAL '7 hours'),
  ('user-6D19', 'Port Harcourt Mall', 'Security has increased patrols in the car park after last week''s reports.', 'Update', 29, 6, 'Nigeria', 'Rivers', 'https://picsum.photos/seed/lifeclick-ph/800/500', NOW() - INTERVAL '11 hours'),
  ('user-1Q84', 'Bodija', 'Flooding on the back road after heavy rain. Use the main route tonight.', 'Alert', 88, 34, 'Nigeria', 'Oyo', 'https://picsum.photos/seed/lifeclick-bodija/800/500', NOW() - INTERVAL '16 hours'),
  ('user-3H52', 'Nyali', 'Lost phone handed in at the community desk. Ask for reference 4471.', 'Notice', 9, 1, 'Kenya', 'Mombasa', 'https://picsum.photos/seed/lifeclick-nyali/800/500', NOW() - INTERVAL '1 day')
) AS seed(anon_handle, area, body, tag, likes, reposts, country, state, image_url, created_at)
WHERE NOT EXISTS (SELECT 1 FROM feed_posts WHERE anon_handle = 'user-9P27');
`;
