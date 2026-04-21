-- generations: ensure all required columns exist (idempotent catch-all)
-- Run this in Supabase SQL Editor if any prior migrations were not applied.

-- ---------------------------------------------------------------------------
-- Table (idempotent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generations (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  prompt          TEXT        NOT NULL,
  genre           TEXT        NOT NULL,
  bpm             INTEGER     NOT NULL,
  style_tag       TEXT,
  layers          JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Missing columns (each idempotent via IF NOT EXISTS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS style_tag TEXT;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS layers JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS inspiration_source TEXT;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS generations_user_created_idx
  ON public.generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS generations_public_created_idx
  ON public.generations (created_at DESC)
  WHERE is_public = TRUE;

CREATE INDEX IF NOT EXISTS generations_favorite_idx
  ON public.generations (user_id, is_favorite)
  WHERE is_favorite = TRUE;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.generations TO anon, authenticated;
GRANT ALL ON TABLE public.generations TO postgres, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generations_select_own_or_public" ON public.generations;
DROP POLICY IF EXISTS "generations_select_own"           ON public.generations;
DROP POLICY IF EXISTS "generations_insert_own"           ON public.generations;
DROP POLICY IF EXISTS "generations_update_own"           ON public.generations;
DROP POLICY IF EXISTS "generations_delete_own"           ON public.generations;

-- SELECT: own rows (Clerk JWT sub) OR public gallery rows
CREATE POLICY "generations_select_own_or_public"
ON public.generations FOR SELECT
USING (
  COALESCE(is_public, FALSE) = TRUE
  OR (
    NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
    AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
);

CREATE POLICY "generations_insert_own"
ON public.generations FOR INSERT
WITH CHECK (
  (
    NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
    AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
);

CREATE POLICY "generations_update_own"
ON public.generations FOR UPDATE
USING (
  (
    NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
    AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
)
WITH CHECK (
  (
    NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
    AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
);

CREATE POLICY "generations_delete_own"
ON public.generations FOR DELETE
USING (
  (
    NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
    AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
);
