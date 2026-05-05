-- Anthropic usage logging for real cost analysis before plan caps.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id                          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     TEXT,
  endpoint                    TEXT        NOT NULL,
  model                       TEXT        NOT NULL,
  input_tokens                INTEGER     NOT NULL DEFAULT 0,
  output_tokens               INTEGER     NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER     NOT NULL DEFAULT 0,
  cache_read_input_tokens     INTEGER     NOT NULL DEFAULT 0,
  cost_usd                    NUMERIC(12, 8) NOT NULL DEFAULT 0,
  metadata                    JSONB       NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON public.ai_usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_events_endpoint_created_idx
  ON public.ai_usage_events (endpoint, created_at DESC);

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ai_usage_events TO anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_events TO postgres, service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_events_select_own" ON public.ai_usage_events;

CREATE POLICY "ai_usage_events_select_own"
ON public.ai_usage_events FOR SELECT
USING (
  user_id IS NOT NULL
  AND (
    (
      NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
      AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
    )
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
  )
);
