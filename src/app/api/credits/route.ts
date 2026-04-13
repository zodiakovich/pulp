import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkCreditsAllowed } from '@/lib/credits';

export const runtime = 'nodejs';

/** Current signed-in user credit snapshot (after month rollover). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const s = await checkCreditsAllowed(userId);
    return NextResponse.json({
      credits_used: s.credits_used,
      limit: s.limit,
      is_pro: s.is_pro,
      plan_type: s.plan_type,
      allowed: s.allowed,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load credits' }, { status: 500 });
  }
}
