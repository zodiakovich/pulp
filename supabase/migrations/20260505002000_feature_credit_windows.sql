-- Build a Track: daily and monthly windows
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS build_daily_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS build_daily_reset_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS build_monthly_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS build_monthly_reset_at timestamptz NOT NULL DEFAULT now();

-- MIDI Generator: daily and monthly windows
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS midi_daily_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS midi_daily_reset_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS midi_monthly_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS midi_monthly_reset_at timestamptz NOT NULL DEFAULT now();

-- Audio to MIDI: daily and monthly windows
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS audio_daily_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_daily_reset_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS audio_monthly_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_monthly_reset_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.increment_feature_usage(target_user_id text, target_feature text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_feature = 'build' THEN
    UPDATE public.user_credits
    SET build_daily_used = build_daily_used + 1,
        build_monthly_used = build_monthly_used + 1
    WHERE user_id = target_user_id;
  ELSIF target_feature = 'midi' THEN
    UPDATE public.user_credits
    SET midi_daily_used = midi_daily_used + 1,
        midi_monthly_used = midi_monthly_used + 1
    WHERE user_id = target_user_id;
  ELSIF target_feature = 'audio' THEN
    UPDATE public.user_credits
    SET audio_daily_used = audio_daily_used + 1,
        audio_monthly_used = audio_monthly_used + 1
    WHERE user_id = target_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid feature: %', target_feature;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_feature_usage(text, text) TO service_role;
