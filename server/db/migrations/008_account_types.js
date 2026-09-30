// Splits LifeClick into two products: Individual and Business.
//
// `account_type` is the boundary the eventual Business-only deployment will be
// cut along. Recording it from the first business signup means that split later
// is an export (`WHERE account_type = 'business'`) rather than a per-row
// judgement about which product each account belonged to.
export const id = '008_account_types';

export const sql = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(16) NOT NULL DEFAULT 'individual';
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name VARCHAR(160);
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_type VARCHAR(80);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_account_type_check') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_type_check
      CHECK (account_type IN ('individual', 'business'));
  END IF;
END $$;

-- Every account that existed before this migration is an Individual, which is
-- what the DEFAULT already gives them; this index is what makes the later
-- per-product export cheap.
CREATE INDEX IF NOT EXISTS users_account_type_idx ON users (account_type);

-- Community reports carry the poster's product so the two feeds can be
-- separated when the Business app moves to its own database. Business users
-- should not be reading a consumer feed, nor consumer users a trade one.
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS audience VARCHAR(16) NOT NULL DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_posts_audience_check') THEN
    ALTER TABLE feed_posts
      ADD CONSTRAINT feed_posts_audience_check
      CHECK (audience IN ('individual', 'business'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS feed_posts_audience_idx ON feed_posts (audience, created_at DESC);
`;
