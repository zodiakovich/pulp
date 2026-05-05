-- Single-track MIDI generations from /midi

CREATE TABLE IF NOT EXISTS public.midi_generations (
  id                          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     TEXT        NOT NULL,
  prompt                      TEXT        NOT NULL,
  key                         TEXT        NOT NULL,
  scale                       TEXT        NOT NULL,
  bpm                         INTEGER     NOT NULL,
  bars                        INTEGER     NOT NULL,
  track_type                  TEXT        NOT NULL,
  notes                       JSONB       NOT NULL DEFAULT '[]',
  model                       TEXT        NOT NULL,
  input_tokens                INTEGER     NOT NULL DEFAULT 0,
  output_tokens               INTEGER     NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER     NOT NULL DEFAULT 0,
  cache_read_input_tokens     INTEGER     NOT NULL DEFAULT 0,
  cost_usd                    NUMERIC(12, 8) NOT NULL DEFAULT 0,
  raw_response                JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS midi_generations_user_created_idx
  ON public.midi_generations (user_id, created_at DESC);

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.midi_generations TO anon, authenticated;
GRANT ALL ON TABLE public.midi_generations TO postgres, service_role;

ALTER TABLE public.midi_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "midi_generations_select_own" ON public.midi_generations;
DROP POLICY IF EXISTS "midi_generations_insert_own" ON public.midi_generations;
DROP POLICY IF EXISTS "midi_generations_update_own" ON public.midi_generations;
DROP POLICY IF EXISTS "midi_generations_delete_own" ON public.midi_generations;

CREATE POLICY "midi_generations_select_own"
ON public.midi_generations FOR SELECT
USING (
  (
    NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
    AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
);

CREATE POLICY "midi_generations_insert_own"
ON public.midi_generations FOR INSERT
WITH CHECK (
  (
    NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
    AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
);

CREATE POLICY "midi_generations_update_own"
ON public.midi_generations FOR UPDATE
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

CREATE POLICY "midi_generations_delete_own"
ON public.midi_generations FOR DELETE
USING (
  (
    NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '') IS NOT NULL
    AND user_id = NULLIF(TRIM(COALESCE((auth.jwt() ->> 'sub'), (auth.jwt() ->> 'user_id'))), '')
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
);
