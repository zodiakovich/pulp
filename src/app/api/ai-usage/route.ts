import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAiUsageDashboard } from '@/lib/ai-usage';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const usage = await getAiUsageDashboard(userId);
  return NextResponse.json(usage);
}
