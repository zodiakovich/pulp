import { LegalDocShell, LegalSection } from '@/components/legal/LegalDocShell';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Terms of Service',
  description:
    'Terms of use for pulp by papaya: accounts, acceptable use, ownership of your MIDI, billing with Stripe, availability, liability, and termination.',
  path: '/terms',
});

const LAST = 'April 13, 2026';

export default function TermsOfServicePage() {
  return (
    <LegalDocShell title="Terms of Service" lastUpdated={LAST}>
      <p style={{ color: 'var(--muted)' }}>
        These Terms govern your use of <strong style={{ color: 'var(--text)' }}>pulp</strong>, an AI MIDI generator offered by{' '}
        <strong style={{ color: 'var(--text)' }}>papaya</strong> (“we”, “us”). By using pulp, you agree to these Terms. If you do not agree, do not use the
        service.
      </p>

      <LegalSection title="The service">
        <p>
          pulp generates MIDI (and related audio previews where available) from text prompts and controls you provide. Features, limits, and availability
          may change over time. We describe plans on the{' '}
          <a href="/pricing" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Pricing
          </a>{' '}
          page.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You may need an account (via Clerk) to use certain features. You are responsible for your credentials and for activity under your account. Provide
          accurate information and notify us if you suspect unauthorized access.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to misuse pulp. For example, you must not:</p>
        <ul className="list-disc space-y-3 pl-5">
          <li>Attempt to break, overload, or circumvent security, rate limits, or billing.</li>
          <li>Use the service to violate law or third-party rights.</li>
          <li>Scrape, resell, or redistribute the service in a way that competes with or harms papaya without permission.</li>
          <li>Upload unlawful, harmful, or deceptive content through any upload features.</li>
        </ul>
        <p className="pt-2">We may suspend or terminate access for violations or risk to the platform or other users.</p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          Subject to your plan and these Terms, <strong style={{ color: 'var(--text)' }}>you retain ownership of MIDI and exports you generate</strong> for
          your creative use. papaya does not claim copyright in your generated MIDI output. The pulp software, brand, UI, and documentation remain our
          property.
        </p>
        <p className="pt-2">
          Commercial use may depend on your plan—see our{' '}
          <a href="/legal/license" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            license summary
          </a>{' '}
          and Pricing page for details.
        </p>
      </LegalSection>

      <LegalSection title="Payments (Stripe)">
        <p>
          Paid plans are billed through Stripe. By subscribing, you authorize Stripe and us to charge your payment method on the agreed schedule. Prices and
          taxes are shown at checkout where applicable.
        </p>
        <p className="pt-2">
          <strong style={{ color: 'var(--text)' }}>Refunds.</strong> Unless required by law or stated otherwise at purchase, fees are generally non-refundable.
          If you believe a charge is in error, contact us and we will review in good faith.
        </p>
      </LegalSection>

      <LegalSection title="Service availability">
        <p>
          We strive for high uptime but do not guarantee uninterrupted access. Maintenance, outages, or third-party failures may affect the service. We may
          modify or discontinue features with reasonable notice when practicable.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer and limitation of liability">
        <p>
          pulp is provided “as is” to the fullest extent permitted by law. We disclaim implied warranties such as merchantability or fitness for a particular
          purpose where allowed.
        </p>
        <p className="pt-2">
          To the maximum extent permitted by law, papaya will not be liable for indirect, incidental, special, consequential, or punitive damages, or loss of
          profits, data, or goodwill. Our aggregate liability for claims relating to the service is limited to the greater of (a) the amount you paid us for
          pulp in the twelve months before the claim or (b) fifty US dollars (USD $50), except where liability cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          You may stop using pulp at any time. We may suspend or terminate access for breach of these Terms, risk, or legal requirements. Provisions that by
          their nature should survive (for example, ownership, liability limits where enforceable) will survive termination.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these Terms. We will post the new version here and update the “Last updated” date. Continued use after changes constitutes acceptance
          of the revised Terms where permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Legal questions:{' '}
          <a href="mailto:legal@bypapaya.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            legal@bypapaya.com
          </a>
        </p>
      </LegalSection>
    </LegalDocShell>
  );
}
