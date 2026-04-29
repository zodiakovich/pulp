-- Ensure user_credits is protected before launch.
-- Reads are limited to the Clerk/Supabase JWT subject. Writes stay server-side
-- through the service role client, which bypasses RLS.

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_credits_select_own" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_update_own" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_insert_own" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_delete_own" ON public.user_credits;

CREATE POLICY "user_credits_select_own"
ON public.user_credits
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'sub') = user_id);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_credits FROM anon, authenticated;
