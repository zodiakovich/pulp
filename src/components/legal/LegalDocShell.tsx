import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

type Props = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

/**
 * Minimal dark legal / info layout: DM Sans body, 720px column, comfortable vertical rhythm.
 */
export function LegalDocShell({ title, lastUpdated, children }: Props) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="create" />
      <div className="mx-auto px-6 pb-24 pt-24 sm:px-8 sm:pt-28" style={{ maxWidth: 720 }}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: 'var(--accent)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            letterSpacing: '0.04em',
          }}
        >
          ← Back to pulp
        </Link>

        <p
          className="mt-10"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            color: 'var(--muted)',
            letterSpacing: '0.02em',
          }}
        >
          Last updated: {lastUpdated}
        </p>

        <h1
          className="mt-4"
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: 'var(--text)',
          }}
        >
          {title}
        </h1>

        <div className="mt-10 space-y-10" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 16, lineHeight: 1.75, color: 'var(--muted)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        style={{
          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: '-0.02em',
          lineHeight: 1.25,
          color: 'var(--text)',
          marginBottom: 16,
        }}
      >
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
