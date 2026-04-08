-- RLS policies for pulp tables
-- Tables: generations, user_credits, blog_posts

-- Ensure "public" marker exists for generations
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Enable RLS
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- generations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "generations_select_own_or_public" ON generations;
DROP POLICY IF EXISTS "generations_insert_own" ON generations;
DROP POLICY IF EXISTS "generations_update_own" ON generations;
DROP POLICY IF EXISTS "generations_delete_own" ON generations;

-- SELECT: own rows OR public rows
CREATE POLICY "generations_select_own_or_public"
ON generations
FOR SELECT
USING (
  is_public = TRUE
  OR auth.uid()::text = user_id
);

-- INSERT: only insert rows with your own user_id
CREATE POLICY "generations_insert_own"
ON generations
FOR INSERT
WITH CHECK (
  auth.uid()::text = user_id
);

-- UPDATE/DELETE: only modify your own rows
CREATE POLICY "generations_update_own"
ON generations
FOR UPDATE
USING (
  auth.uid()::text = user_id
)
WITH CHECK (
  auth.uid()::text = user_id
);

CREATE POLICY "generations_delete_own"
ON generations
FOR DELETE
USING (
  auth.uid()::text = user_id
);

-- ---------------------------------------------------------------------------
-- user_credits
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_credits_select_own" ON user_credits;
DROP POLICY IF EXISTS "user_credits_update_own" ON user_credits;

-- SELECT/UPDATE: only own row
CREATE POLICY "user_credits_select_own"
ON user_credits
FOR SELECT
USING (
  auth.uid()::text = user_id
);

CREATE POLICY "user_credits_update_own"
ON user_credits
FOR UPDATE
USING (
  auth.uid()::text = user_id
)
WITH CHECK (
  auth.uid()::text = user_id
);

-- Optional: prevent client inserts/deletes entirely (service role can still bypass RLS)
REVOKE INSERT, DELETE ON TABLE user_credits FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "blog_posts_select_public" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_write_service_role" ON blog_posts;

-- SELECT: public read
CREATE POLICY "blog_posts_select_public"
ON blog_posts
FOR SELECT
USING (TRUE);

-- INSERT/UPDATE/DELETE: service role only (admin)
CREATE POLICY "blog_posts_write_service_role"
ON blog_posts
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

