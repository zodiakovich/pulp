import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PlanType } from '@/lib/credits';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia' as any,
});

function sessionPlanType(session: Stripe.Checkout.Session): PlanType {
  const raw = session.metadata?.plan_type;
  if (raw === 'studio') return 'studio';
  return 'pro';
}

async function resolveCustomerEmail(stripe: Stripe, customerId: string | Stripe.Customer | Stripe.DeletedCustomer): Promise<string | null> {
  try {
    const id = typeof customerId === 'string' ? customerId : customerId.id;
    const customer = await stripe.customers.retrieve(id);
    if (customer.deleted) return null;
    return (customer as Stripe.Customer).email ?? null;
  } catch {
    return null;
  }
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
        await supabaseAdmin.from('user_credits').upsert(
          { user_id: clerkUserId, is_pro: true, plan_type },
          { onConflict: 'user_id' },
        );
      } catch {
        // ignore
      }
    }
  }

  if (event.type === 'customer.subscription.created') {
    const sub = event.data.object as Stripe.Subscription;
    const email = await resolveCustomerEmail(stripe, sub.customer);
    if (email) {
      await sendEmail({
        to: email,
        subject: "You're on Pro. Let's make something. 🎛️",
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090B;font-family:DM Sans,system-ui,sans-serif;color:#FAFAFA;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 40px 32px;">
        <tr><td>
          <p style="font-family:Syne,system-ui,sans-serif;font-size:28px;font-weight:700;color:#FF6D3F;margin:0 0 24px;">pulp.</p>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 16px;color:#FAFAFA;">Your Pro plan is active.</h1>
          <p style="font-size:15px;line-height:1.7;color:#A1A1AA;margin:0 0 24px;">You now have <strong style="color:#FAFAFA;">150 generations/month</strong>. Make something great.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="background:#FF6D3F;border-radius:10px;">
              <a href="https://pulp.bypapaya.com" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:-0.01em;">Start generating →</a>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#71717A;margin:0;">Manage your subscription anytime at <a href="https://pulp.bypapaya.com/profile" style="color:#FF6D3F;text-decoration:none;">pulp.bypapaya.com/profile</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }).catch(() => {});
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const email = await resolveCustomerEmail(stripe, sub.customer);
    if (email) {
      await sendEmail({
        to: email,
        subject: 'Your pulp subscription has ended',
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090B;font-family:DM Sans,system-ui,sans-serif;color:#FAFAFA;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 40px 32px;">
        <tr><td>
          <p style="font-family:Syne,system-ui,sans-serif;font-size:28px;font-weight:700;color:#FF6D3F;margin:0 0 24px;">pulp.</p>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 16px;color:#FAFAFA;">Your subscription has ended.</h1>
          <p style="font-size:15px;line-height:1.7;color:#A1A1AA;margin:0 0 24px;">You're now on the <strong style="color:#FAFAFA;">Free plan</strong> (20 generations/month). Resubscribe anytime to get back to 150/month.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="background:#FF6D3F;border-radius:10px;">
              <a href="https://pulp.bypapaya.com/pricing" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:-0.01em;">Resubscribe →</a>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#71717A;margin:0;">Your generations and history are safe.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ received: true });
}
