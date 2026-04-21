import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

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

    // Prefer looking up by subscription metadata (most reliable)
    const subscriptions = await stripe.subscriptions.search({
      query: `metadata['clerk_user_id']:'${userId}'`,
      limit: 1,
    });

    let customerId: string | null = null;

    if (subscriptions.data[0]) {
      const c = subscriptions.data[0].customer;
      customerId = typeof c === 'string' ? c : c.id;
    } else {
      // Fallback: look up customer by email
      const user = await currentUser();
      const email = user?.emailAddresses?.[0]?.emailAddress;
      if (email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        if (customers.data[0]) customerId = customers.data[0].id;
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://pulp.bypapaya.com/profile',
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal session';
    console.error('[stripe/portal]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
