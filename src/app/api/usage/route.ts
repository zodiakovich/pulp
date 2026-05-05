import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getFeatureUsage } from '@/lib/feature-credits';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const usage = await getFeatureUsage(userId);
  return NextResponse.json(usage);
}
