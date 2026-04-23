import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ preferences: null });

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();

  return NextResponse.json({ preferences: (data as { preferences?: unknown } | null)?.preferences ?? null });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ ok: true });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  await supabaseAdmin
    .from('user_credits')
    .upsert({ user_id: userId, preferences: body }, { onConflict: 'user_id' });

  return NextResponse.json({ ok: true });
}
