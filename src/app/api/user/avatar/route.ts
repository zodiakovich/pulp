import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AVATAR_COLORS } from '@/components/UserAvatar';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ avatarColor: null });

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('avatar_color')
    .eq('user_id', userId)
    .maybeSingle();

  return NextResponse.json({ avatarColor: data?.avatar_color ?? null });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  let body: { avatarColor?: string };
  try {
    body = await req.json() as { avatarColor?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const color = body.avatarColor;
  if (!color || !(AVATAR_COLORS as readonly string[]).includes(color)) {
    return NextResponse.json({ error: 'Invalid color' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('user_credits')
    .upsert({ user_id: userId, avatar_color: color }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
