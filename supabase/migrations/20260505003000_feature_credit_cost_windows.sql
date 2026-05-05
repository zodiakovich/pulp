-- Replace feature usage counters with cost windows.

DROP FUNCTION IF EXISTS public.increment_feature_usage(text, text);

ALTER TABLE user_credits
  DROP COLUMN IF EXISTS build_daily_used,
  DROP COLUMN IF EXISTS build_weekly_used,
  DROP COLUMN IF EXISTS build_weekly_reset_at,
  DROP COLUMN IF EXISTS build_monthly_used,
  DROP COLUMN IF EXISTS midi_daily_used,
  DROP COLUMN IF EXISTS midi_weekly_used,
  DROP COLUMN IF EXISTS midi_weekly_reset_at,
  DROP COLUMN IF EXISTS midi_monthly_used,
  DROP COLUMN IF EXISTS audio_daily_used,
  DROP COLUMN IF EXISTS audio_weekly_used,
  DROP COLUMN IF EXISTS audio_weekly_reset_at,
  DROP COLUMN IF EXISTS audio_monthly_used;

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS build_daily_cost float NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS build_daily_reset_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS build_monthly_cost float NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS build_monthly_reset_at timestamptz NOT NULL DEFAULT now(),

  ADD COLUMN IF NOT EXISTS midi_daily_cost float NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS midi_daily_reset_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS midi_monthly_cost float NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS midi_monthly_reset_at timestamptz NOT NULL DEFAULT now(),

  ADD COLUMN IF NOT EXISTS audio_daily_cost float NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_daily_reset_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS audio_monthly_cost float NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_monthly_reset_at timestamptz NOT NULL DEFAULT now();
