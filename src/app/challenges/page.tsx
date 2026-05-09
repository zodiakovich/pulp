import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Challenges',
  description:
    'Community challenges for pulp—prompt jams, genre weeks, and remix rounds—will land here. Check back or follow the blog for the first event.',
  path: '/challenges',
});

export default function ChallengesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />
      <div className="flex flex-col items-center justify-center text-center px-8" style={{ minHeight: 'calc(100vh - 200px)', paddingTop: 96 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
          Coming soon
        </p>
        <h1 style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 'clamp(28px, 5vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--text)', marginBottom: 16, maxWidth: 560 }}>
          Community challenges
        </h1>
        <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 16, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 480, marginBottom: 32 }}>
          Prompt jams, genre weeks, and remix rounds. We&apos;ll announce the first challenge on the blog when it&apos;s ready.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/blog"
            style={{
              display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px',
              borderRadius: 10, background: 'var(--accent)', color: 'var(--on-accent)',
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Follow the blog →
          </Link>
          <Link
            href="/"
            style={{
              display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px',
              borderRadius: 10, background: 'transparent', color: 'var(--muted)',
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, fontSize: 14,
              textDecoration: 'none', border: '1px solid var(--border)',
            }}
          >
            Back to generator
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
