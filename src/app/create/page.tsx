import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Create',
  description:
    'A dedicated create hub for pulp workflows is under construction. Use the home page to generate MIDI and explore public examples in the meantime.',
  path: '/create',
});

export default function CreatePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />
      <div className="flex flex-col items-center justify-center text-center px-8" style={{ minHeight: 'calc(100vh - 200px)', paddingTop: 96 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
          Coming soon
        </p>
        <h1 style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 'clamp(28px, 5vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--text)', marginBottom: 16, maxWidth: 560 }}>
          Create hub
        </h1>
        <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 16, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 480, marginBottom: 32 }}>
          Templates, starting points, and curated workflows — coming to pulp soon. The generator is already live in the meantime.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            style={{
              display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px',
              borderRadius: 10, background: 'var(--accent)', color: 'var(--on-accent)',
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Open generator →
          </Link>
          <Link
            href="/explore"
            style={{
              display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px',
              borderRadius: 10, background: 'transparent', color: 'var(--muted)',
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, fontSize: 14,
              textDecoration: 'none', border: '1px solid var(--border)',
            }}
          >
            Explore
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
