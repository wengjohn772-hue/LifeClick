// Seeds the community feed so the mobile Feeds screen has real API-backed rows
// instead of the hardcoded array it shipped with. Runs once; user-authored
// posts are never touched.
export const id = '003_seed_feed_posts';

export const sql = `
INSERT INTO feed_posts (anon_handle, area, body, tag, likes, reposts, created_at)
SELECT * FROM (VALUES
  ('user-7F42', 'Riverside Dr.', 'Streetlights are out along the whole stretch past the bridge.', 'Notice', 12, 3, NOW() - INTERVAL '2 hours'),
  ('user-3K91', 'Market Square', 'Keep devices out of sight while waiting near the taxi rank.', 'Alert', 41, 18, NOW() - INTERVAL '5 hours'),
  ('user-8M16', 'Campus North', 'The reported student has been found safe and is back home.', 'Resolved', 96, 27, NOW() - INTERVAL '9 hours'),
  ('user-2B08', 'Harbour Walk', 'Patrol presence increased after last week''s reports. Feels calmer.', 'Update', 22, 5, NOW() - INTERVAL '1 day'),
  ('user-5X33', 'Old Town', 'Construction has closed the shortcut behind the library after dark.', 'Notice', 8, 2, NOW() - INTERVAL '2 days')
) AS seed(anon_handle, area, body, tag, likes, reposts, created_at)
WHERE NOT EXISTS (SELECT 1 FROM feed_posts);
`;
