import Link from 'next/link';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
        {title}
      </h2>
      <div className="mt-3" style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          ← Back to pulp
        </Link>

        <h1 className="mt-6" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em' }}>
          Terms of Service
        </h1>
        <p className="mt-3" style={{ color: 'var(--muted)' }}>
          These Terms govern your use of pulp (the “Service”). By using the Service, you agree to these Terms.
        </p>

        <Section title="Acceptance of terms">
          <p>
            By accessing or using pulp, you agree to be bound by these Terms. If you do not agree, do not use the Service.
          </p>
        </Section>

        <Section title="Description of service (AI MIDI generator, no audio generation)">
          <p>
            pulp generates MIDI data (notes, timing, velocity) from prompts and settings. pulp does not generate audio files
            and does not provide mastered audio output.
          </p>
        </Section>

        <Section title="Free vs Pro plan usage rights">
          <p>
            pulp may offer a Free plan and a Pro plan with different limits and features. Your usage rights for generated
            MIDI depend on your plan at the time the MIDI is generated.
          </p>
        </Section>

        <Section title="Commercial license">
          <p>
            <strong style={{ color: 'var(--text)' }}>Free users</strong> can use generated MIDI for personal and non-commercial projects.
          </p>
          <p className="mt-3">
            <strong style={{ color: 'var(--text)' }}>Pro users</strong> get full commercial rights to all generated MIDI files.
          </p>
        </Section>

        <Section title="Prohibited uses">
          <p>
            You agree not to misuse the Service, including by attempting to disrupt, reverse engineer, or bypass limits,
            or by using the Service for unlawful, harmful, or abusive purposes.
          </p>
        </Section>

        <Section title="Intellectual property (user owns the MIDI they generate)">
          <p>
            You own the MIDI you generate with pulp, subject to these Terms and your plan’s license scope.
          </p>
        </Section>

        <Section title="Disclaimer of warranties">
          <p>
            The Service is provided “as is” and “as available” without warranties of any kind, whether express or implied.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, pulp and its affiliates will not be liable for any indirect, incidental,
            special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.
          </p>
        </Section>

        <Section title="Changes to terms">
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes become effective means you accept the updated Terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions? Contact us at{' '}
            <a href="mailto:legal@pulp.studio" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              legal@pulp.studio
            </a>
            .
          </p>
        </Section>

        <div className="mt-12 pt-6" style={{ borderTop: '1px solid var(--border)', color: 'color-mix(in srgb, var(--muted) 75%, transparent)' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            Last updated: 2026-04-08
          </p>
        </div>
      </div>
    </div>
  );
}

