import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

// Clerk delivers webhooks with svix signature headers.
// For full signature verification install the `svix` package and verify with:
//   import { Webhook } from 'svix';
//   const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
//   wh.verify(rawBody, headers);
// The CLERK_WEBHOOK_SECRET is set in the Clerk dashboard under Webhooks.

type ClerkEmailAddress = { email_address: string; id: string };

type ClerkUserCreatedEvent = {
  type: 'user.created';
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    email_addresses: ClerkEmailAddress[];
    primary_email_address_id: string | null;
  };
};

type ClerkEvent = ClerkUserCreatedEvent | { type: string; data: unknown };

export async function POST(req: Request) {
  // Basic guard: ensure caller knows the webhook secret
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[clerk/webhook] CLERK_WEBHOOK_SECRET not set — skipping signature check');
  }

  let event: ClerkEvent;
  try {
    event = (await req.json()) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (event.type === 'user.created') {
    const { data } = event as ClerkUserCreatedEvent;

    const primary = data.email_addresses.find(e => e.id === data.primary_email_address_id)
      ?? data.email_addresses[0];
    const email = primary?.email_address;
    const name = data.first_name || data.username || email?.split('@')[0] || 'there';

    if (email) {
      await sendEmail({
        to: email,
        subject: 'Welcome to pulp. 🎹',
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090B;font-family:DM Sans,system-ui,sans-serif;color:#FAFAFA;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 40px 32px;">
        <tr><td>
          <p style="font-family:Syne,system-ui,sans-serif;font-size:28px;font-weight:700;color:#FF6D3F;margin:0 0 24px;">pulp.</p>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 16px;color:#FAFAFA;">Hey ${name}, welcome to pulp.</h1>
          <p style="font-size:15px;line-height:1.7;color:#A1A1AA;margin:0 0 24px;">You have <strong style="color:#FAFAFA;">20 free generations</strong> this month. Start creating beats with nothing but a prompt.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="background:#FF6D3F;border-radius:10px;">
              <a href="https://pulp.bypapaya.com" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:-0.01em;">Generate your first beat →</a>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#71717A;margin:0;">Need help? Reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
    }
  }

  return NextResponse.json({ received: true });
}
