import Link from 'next/link';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'API docs',
  description:
    'HTTP API reference for pulp integrations—generate, credits, and webhooks—will be published here. Use the app for MIDI generation today.',
  path: '/api-docs',
});

export default function ApiDocsPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-8" style={{ background: 'var(--bg)' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.025,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
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
          color: 'rgba(240,240,255,0.12)',
          userSelect: 'none',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Coming soon
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <h1 className="sr-only">API docs</h1>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 400, fontSize: 16, color: 'var(--text)' }}>
          API docs are coming soon.
        </div>
        <Link
          href="/"
          className="footer-link"
          style={{
            marginTop: 14,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            color: 'rgba(240,240,255,0.55)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          Back to pulp
        </Link>
      </div>
    </div>
  );
}

