import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PlanType } from '@/lib/credits';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

function sessionPlanType(session: Stripe.Checkout.Session): PlanType {
  const raw = session.metadata?.plan_type;
  if (raw === 'studio') return 'studio';
  return 'pro';
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });

  // IMPORTANT: must read raw body for signature verification.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const clerkUserId = session.client_reference_id;

    if (clerkUserId && supabaseAdmin) {
      try {
        const plan_type = sessionPlanType(session);
        // Studio and Pro both unlock is_pro entitlements; generation caps differ via plan_type.
        await supabaseAdmin.from('user_credits').upsert(
          { user_id: clerkUserId, is_pro: true, plan_type },
          { onConflict: 'user_id' },
        );
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({ received: true });
}
