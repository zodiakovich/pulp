import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/** Public total generation count (service role). Client cannot aggregate across RLS. */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ totalGenerations: null as number | null });
  }

  const { count, error } = await supabaseAdmin
    .from('generations')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ totalGenerations: null as number | null });
  }

  return NextResponse.json({ totalGenerations: count ?? 0 });
}
