import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!serviceKey) {
  // This module is intended for server-side use. If no service key is configured,
  // callers should handle the null client case.
}

export const supabaseAdmin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;

