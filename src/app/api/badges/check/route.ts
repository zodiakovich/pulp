import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkAndAwardBadges } from '@/lib/badges';

export const runtime = 'nodejs';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const newBadges = await checkAndAwardBadges(userId);
    return NextResponse.json({ newBadges });
  } catch {
    return NextResponse.json({ newBadges: [] });
  }
}
