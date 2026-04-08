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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          ← Back to pulp
        </Link>

        <h1 className="mt-6" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em' }}>
          Privacy Policy
        </h1>
        <p className="mt-3" style={{ color: 'var(--muted)' }}>
          This policy explains what data we collect, how we use it, and the choices you have.
        </p>

        <Section title="Data we collect">
          <ul style={{ paddingLeft: 18 }}>
            <li className="mt-2">
              <strong style={{ color: 'var(--text)' }}>Clerk authentication data</strong> (e.g. user ID, email, username, avatar) to sign you in.
            </li>
            <li className="mt-2">
              <strong style={{ color: 'var(--text)' }}>Generation history via Supabase</strong> (e.g. prompts, genre, BPM, generated MIDI layers, timestamps).
            </li>
            <li className="mt-2">
              <strong style={{ color: 'var(--text)' }}>Usage analytics via Vercel</strong> (events and performance metrics).
            </li>
          </ul>
        </Section>

        <Section title="How we use data">
          <ul style={{ paddingLeft: 18 }}>
            <li className="mt-2">Provide and operate the Service (generation, saving history, credits and plans).</li>
            <li className="mt-2">Improve reliability and product experience (debugging, performance, feature usage).</li>
            <li className="mt-2">Prevent abuse and maintain security.</li>
          </ul>
        </Section>

        <Section title="Third party services">
          <p>
            pulp relies on the following third parties:
          </p>
          <ul style={{ paddingLeft: 18 }}>
            <li className="mt-2"><strong style={{ color: 'var(--text)' }}>Clerk</strong> for authentication.</li>
            <li className="mt-2"><strong style={{ color: 'var(--text)' }}>Supabase</strong> for database storage (generations, credits).</li>
            <li className="mt-2"><strong style={{ color: 'var(--text)' }}>Vercel</strong> for analytics and performance insights.</li>
            <li className="mt-2"><strong style={{ color: 'var(--text)' }}>Anthropic API</strong> for prompt parsing / inspiration features (when enabled).</li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>
            We retain account and generation history data for as long as your account is active or as needed to provide the Service.
            You can request deletion at any time (see User rights).
          </p>
        </Section>

        <Section title="User rights (delete account, export data)">
          <p>
            You can request to delete your account and associated data, or export your generation history. We’ll make reasonable
            efforts to honor requests subject to legal and security obligations.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use cookies and local storage for authentication (via Clerk), preferences (like theme), and analytics (via Vercel).
            You can control cookies via your browser settings, but some functionality may not work without them.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests? Contact{' '}
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

