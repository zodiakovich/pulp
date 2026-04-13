'use client';

import { useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createClerkAwareSupabase(getAccessToken: () => Promise<string | null>): SupabaseClient {
  return createClient(url, anonKey, {
    global: {
      fetch: async (input, init = {}) => {
        const headers = new Headers(init.headers);
        const token = await getAccessToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/**
 * Browser Supabase client that sends Clerk's Supabase JWT on each request (Authorization header).
 * In Clerk Dashboard, add a JWT template named `supabase` per Supabase third-party auth docs
 * so PostgREST RLS can match `user_id` to `auth.jwt()->>'sub'`.
 */
export function useSupabaseWithClerk(): SupabaseClient {
  const { getToken } = useAuth();
  return useMemo(
    () =>
      createClerkAwareSupabase(async () => {
        try {
          const t = await getToken({ template: 'supabase' });
          if (t) return t;
        } catch {
          // Template may be missing in dev; fall back below.
        }
        try {
          return await getToken();
        } catch {
          return null;
        }
      }),
    [getToken],
  );
}
