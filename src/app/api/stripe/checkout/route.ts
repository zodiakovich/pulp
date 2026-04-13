import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Keep this pinned to a real Stripe API version supported by stripe-node.
  apiVersion: '2024-06-20',
});

type CheckoutBody = {
  plan?: string;
  billing?: string;
};

function resolvePriceId(plan: 'pro' | 'studio', billing: 'monthly' | 'annual'): string | null {
  const proMonthly = process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? process.env.STRIPE_PRICE_ID;
  const proAnnual = process.env.STRIPE_PRICE_ID_PRO_ANNUAL;
  // TODO: Stripe Dashboard — create Studio subscription prices and set:
  // STRIPE_PRICE_ID_STUDIO_MONTHLY, STRIPE_PRICE_ID_STUDIO_ANNUAL
  const studioMonthly = process.env.STRIPE_PRICE_ID_STUDIO_MONTHLY;
  const studioAnnual = process.env.STRIPE_PRICE_ID_STUDIO_ANNUAL;

  if (plan === 'studio') {
    return billing === 'annual' ? studioAnnual ?? null : studioMonthly ?? null;
  }
  return billing === 'annual' ? proAnnual ?? null : proMonthly ?? null;
}

export async function POST(req: Request) {
  console.log('[stripe/checkout] called');
  try {
    const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY);
    console.log('[stripe/checkout] env', { hasSecret });
    if (!hasSecret) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: CheckoutBody = {};
    try {
      body = (await req.json()) as CheckoutBody;
    } catch {
      /* empty body — default below */
    }

    const plan: 'pro' | 'studio' = body.plan === 'studio' ? 'studio' : 'pro';
    const billing: 'monthly' | 'annual' = body.billing === 'annual' ? 'annual' : 'monthly';

    const priceId = resolvePriceId(plan, billing);
    if (!priceId) {
      const hint =
        plan === 'studio'
          ? 'Configure STRIPE_PRICE_ID_STUDIO_MONTHLY and STRIPE_PRICE_ID_STUDIO_ANNUAL (see TODO in checkout route).'
          : billing === 'annual'
            ? 'Configure STRIPE_PRICE_ID_PRO_ANNUAL or use monthly billing.'
            : 'Configure STRIPE_PRICE_ID_PRO_MONTHLY or STRIPE_PRICE_ID.';
      return NextResponse.json({ error: `Missing Stripe price ID for this plan. ${hint}` }, { status: 500 });
    }

    const origin = req.headers.get('origin') || 'https://pulp-4ubq.vercel.app';
    const plan_type = plan === 'studio' ? 'studio' : 'pro';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pro/success`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: userId,
      allow_promotion_codes: true,
      metadata: {
        plan_type,
      },
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
