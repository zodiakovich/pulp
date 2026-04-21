import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

let stripeSingleton: Stripe | null = null;
function getStripe() {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
  stripeSingleton = new Stripe(key, { apiVersion: '2026-03-25.dahlia' as any });
  return stripeSingleton;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stripe = getStripe();

    // Find subscriptions where we stamped clerk_user_id in metadata at checkout.
    const subscriptions = await stripe.subscriptions.search({
      query: `metadata['clerk_user_id']:'${userId}' AND status:'active'`,
      limit: 1,
    });

    const subscription = subscriptions.data[0];
    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    const cancel_at = updated.items.data[0]?.current_period_end ?? null;
    return NextResponse.json({ success: true, cancel_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
    console.error('[stripe/cancel]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
