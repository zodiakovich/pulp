type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Send a transactional email via Resend.
 * If RESEND_API_KEY is not set, logs the payload to console instead.
 * TODO: Add RESEND_API_KEY to env to enable real sending.
 */
export async function sendEmail({ to, subject, html }: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[email] RESEND_API_KEY not configured — would send:', { to, subject });
    // TODO: Uncomment when RESEND_API_KEY is set in env:
    // await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ from: 'pulp@bypapaya.com', to, subject, html }),
    // });
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'pulp@bypapaya.com', to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[email] Resend error:', res.status, text);
  }
}
