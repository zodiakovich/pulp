import Link from 'next/link';
import { pageMeta } from '@/lib/seo-metadata';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata = pageMeta({
  title: 'GitHub',
  description:
    'Open-source repositories and examples related to pulp will be linked from this page. Follow papaya on GitHub for releases and issue tracking.',
  path: '/github',
});

export default function GitHubPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />
      <div className="relative flex items-center justify-center overflow-hidden px-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.025,
            backgroundImage:
              'linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            pointerEvents: 'none',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -52%)',
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(86px, 12vw, 140px)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: 'color-mix(in srgb, var(--text) 14%, transparent)',
            userSelect: 'none',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Coming soon
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <h1 className="sr-only">GitHub</h1>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 400, fontSize: 16, color: 'var(--text)' }}>
            GitHub link is coming soon.
          </div>
          <Link
            href="/"
            style={{
              marginTop: 14,
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              color: 'var(--muted)',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
          >
            Back to pulp
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
