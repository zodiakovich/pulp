import { LegalDocShell, LegalSection } from '@/components/legal/LegalDocShell';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Privacy Policy',
  description:
    'How pulp collects and uses account data, generation history, cookies, and analytics—and how to access, correct, or delete your information.',
  path: '/privacy',
});

const LAST = 'April 13, 2026';

export default function PrivacyPolicyPage() {
  return (
    <LegalDocShell title="Privacy Policy" lastUpdated={LAST}>
      <p style={{ color: 'var(--muted)' }}>
        This policy describes how papaya (“we”, “us”) handles information when you use <strong style={{ color: 'var(--text)' }}>pulp</strong>, our AI MIDI
        generator. We aim to be clear and practical—if anything is unclear, contact us at the address below.
      </p>

      <LegalSection title="What we collect">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong style={{ color: 'var(--text)' }}>Account data (Clerk).</strong> When you sign in, Clerk processes identifiers such as your user ID,
            email, name or username, and profile image. We use this to authenticate you and show your account in the app.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Generation history (Supabase).</strong> We store the data needed to run the product: for example
            prompts, genre, tempo, layer data for MIDI you generate, timestamps, and sharing settings when you save or share a generation.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Usage and performance (Vercel).</strong> We collect aggregated analytics and technical metrics to
            understand traffic, errors, and performance. That helps us keep the service fast and reliable.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Support and chat (Crisp, when loaded).</strong> If you use in-app chat, Crisp may process messages and
            technical metadata needed to deliver that feature.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Billing (Stripe).</strong> For paid plans, Stripe processes payment details. We receive billing status
            and limited customer references from Stripe—not your full card number.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Rate limiting (Upstash).</strong> We may store short-lived technical data (for example IP or request
            fingerprints) to enforce fair use and protect the API from abuse.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          We use cookies and similar technologies where needed for the product to work. Clerk sets session cookies so you stay signed in. We may store
          preferences (such as theme) in your browser. Analytics cookies or identifiers may be set by our hosting/analytics providers as described in their
          policies. You can control cookies through your browser; disabling some cookies may limit sign-in or personalization.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>We rely on processors we trust to run pulp. They only receive what they need to perform their role:</p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong style={{ color: 'var(--text)' }}>Clerk</strong> — authentication and session management.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Supabase</strong> — database storage for generations, credits, and related app data.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Stripe</strong> — payments and subscription status for paid plans.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Upstash</strong> — rate limiting and abuse protection.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Vercel</strong> — hosting, analytics, and performance insights.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Crisp</strong> — optional customer chat when enabled in the app.
          </li>
        </ul>
        <p className="pt-2">
          Each provider has its own privacy policy. We choose configurations that minimize data collection for our use case, but you should review their
          terms if you want full detail.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep data">
        <p>
          We keep account and generation data while your account is active and as needed to provide the service, comply with law, resolve disputes, and
          maintain security. If you delete your account, we work to remove or anonymize personal data within a reasonable period, subject to legal retention
          requirements.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Depending on where you live, you may have rights to:</p>
        <ul className="list-disc space-y-3 pl-5">
          <li>Access a copy of the personal data we hold about you.</li>
          <li>Correct inaccurate information.</li>
          <li>Request deletion of your account and associated data, where applicable.</li>
          <li>Object to or restrict certain processing, where the law allows.</li>
        </ul>
        <p className="pt-2">
          To exercise these rights, email us at{' '}
          <a href="mailto:privacy@bypapaya.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            privacy@bypapaya.com
          </a>
          . We may need to verify your identity before fulfilling a request.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use industry-standard practices (encryption in transit, access controls, and secure infrastructure) appropriate to the nature of the service. No
          online service is risk-free; we continuously work to reduce risk and respond to issues responsibly.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this policy:{' '}
          <a href="mailto:privacy@bypapaya.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            privacy@bypapaya.com
          </a>
        </p>
      </LegalSection>
    </LegalDocShell>
  );
}
