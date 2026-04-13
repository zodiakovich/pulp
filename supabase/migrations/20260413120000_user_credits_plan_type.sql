-- Paid tier flavor: limits enforced in app via plan_type + is_pro.
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free';

UPDATE user_credits SET plan_type = 'pro' WHERE is_pro = true;

ALTER TABLE user_credits DROP CONSTRAINT IF EXISTS user_credits_plan_type_check;
ALTER TABLE user_credits ADD CONSTRAINT user_credits_plan_type_check CHECK (plan_type IN ('free', 'pro', 'studio'));
