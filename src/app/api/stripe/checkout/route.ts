import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Keep this pinned to a real Stripe API version supported by stripe-node.
  apiVersion: '2024-06-20',
});

export async function POST(req: Request) {
  console.log('[stripe/checkout] called');
  try {
    const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY);
    const hasPrice = Boolean(process.env.STRIPE_PRICE_ID);
    console.log('[stripe/checkout] env', { hasSecret, hasPrice });
    if (!hasSecret) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const origin = req.headers.get('origin') || 'https://pulp-4ubq.vercel.app';
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: 'Missing STRIPE_PRICE_ID' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pro/success`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: userId,
      allow_promotion_codes: true,
    });

    console.log('[stripe/checkout] created session', { id: session.id, hasUrl: Boolean(session.url) });
    if (!session.url) {
      return NextResponse.json({ error: 'Missing Checkout URL', id: session.id }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.log('[stripe/checkout] error', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

