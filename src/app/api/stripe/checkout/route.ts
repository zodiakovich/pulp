import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

let stripeSingleton: Stripe | null = null;
function getStripe() {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
  stripeSingleton = new Stripe(key, {
    apiVersion: '2026-03-25.dahlia' as any,
  });
  return stripeSingleton;
}

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

function resolveBaseUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const xfProto = req.headers.get('x-forwarded-proto');
  const xfHost = req.headers.get('x-forwarded-host');
  const host = xfHost || req.headers.get('host');
  const proto = xfProto || 'https';

  let base =
    envUrl?.trim() ||
    (host ? `${proto}://${host}` : '') ||
    'https://pulp.bypapaya.com';

  // Never emit localhost URLs in production flows.
  if (/localhost|127\.0\.0\.1/i.test(base)) base = 'https://pulp.bypapaya.com';

  return base.replace(/\/+$/, '');
}

export async function POST(req: Request) {
  try {
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

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 });
    }

    if (!priceId.startsWith('price_')) {
      return NextResponse.json({ error: `Invalid Stripe price ID: ${priceId}` }, { status: 500 });
    }

    const origin = resolveBaseUrl(req);
    const plan_type = plan === 'studio' ? 'studio' : 'pro';

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pro/success`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: userId,
      allow_promotion_codes: true,
      metadata: {
        plan_type,
        clerk_user_id: userId,
        billing,
      },
      subscription_data: {
        metadata: {
          plan_type,
          clerk_user_id: userId,
          billing,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Missing Checkout URL', id: session.id }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const e = err as unknown;
    const stripeError = e as Partial<{
      type?: string;
      code?: string;
      decline_code?: string;
      statusCode?: number;
      requestId?: string;
      doc_url?: string;
    }>;

    // Intentionally log diagnostic context (no secrets) so the real Stripe error shows up in server logs.
    console.error('[stripe/checkout] Failed to create session', {
      message: e instanceof Error ? e.message : String(e),
      type: stripeError.type,
      code: stripeError.code,
      decline_code: stripeError.decline_code,
      statusCode: stripeError.statusCode,
      requestId: (stripeError as any)?.requestId,
      doc_url: (stripeError as any)?.doc_url,
    });

    const message = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e) || 'Failed to create checkout session');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
