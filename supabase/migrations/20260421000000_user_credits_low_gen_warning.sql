-- Add low_gen_warning_sent to user_credits to track per-period warning emails.
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS low_gen_warning_sent boolean NOT NULL DEFAULT false;
