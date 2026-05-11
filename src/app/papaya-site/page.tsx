import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const PULP_URL = 'https://pulp.bypapaya.com';

const PRODUCTS: {
  name: string;
  slug: string;
  description: string;
  status: 'live' | 'soon' | 'planned';
}[] = [
  { name: 'pulp', slug: 'pulp', description: 'AI MIDI Generator', status: 'live' },
  { name: 'seed', slug: 'seed', description: 'AI Preset Generator', status: 'soon' },
  { name: 'grove', slug: 'grove', description: 'AI Arrangement Assistant', status: 'planned' },
  { name: 'blend', slug: 'blend', description: 'AI Mix Feedback', status: 'planned' },
  { name: 'press', slug: 'press', description: 'AI Mastering', status: 'planned' },
];

const BG = '#0A0A0B';
const MUTED = 'rgba(255,255,255,0.48)';
const MICRO = 'rgba(255,255,255,0.32)';
const BORDER = 'rgba(255,255,255,0.09)';
const SURFACE = 'rgba(255,255,255,0.04)';

function StatusBadge({ status }: { status: (typeof PRODUCTS)[number]['status'] }) {
  if (status === 'live') {
    return (
      <span
        className="inline-flex items-center gap-2"
        style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 12, color: MUTED, letterSpacing: '0.02em' }}
      >
        <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, background: '#00B894' }} aria-hidden />
        Live
      </span>
    );
  }
  if (status === 'soon') {
    return (
      <span
        className="inline-flex items-center gap-2"
        style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 12, color: MUTED, letterSpacing: '0.02em' }}
      >
        <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, background: '#D4A017' }} aria-hidden />
        Coming soon
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 12, color: MICRO, letterSpacing: '0.02em' }}
    >
      <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, background: 'rgba(255,255,255,0.28)' }} aria-hidden />
      Planned
    </span>
  );
}

function ProductCard(props: (typeof PRODUCTS)[number]) {
  const { name, description, status } = props;
  const isLive = status === 'live';

  const inner = (
    <>
      <h2
        className="text-xl tracking-tight"
        style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'rgba(255,255,255,0.94)', margin: '0 0 8px 0' }}
      >
        {name}
      </h2>
      <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 15, lineHeight: 1.5, color: MUTED, margin: '0 0 16px 0' }}>
        {description}
      </p>
      <StatusBadge status={status} />
    </>
  );

  const cardStyle: CSSProperties = {
    borderRadius: 16,
    border: `1px solid ${BORDER}`,
    background: SURFACE,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    padding: 24,
    boxShadow: '0 1px 2px rgba(255,255,255,0.03), 0 12px 40px rgba(0,0,0,0.35)',
  };

  if (isLive) {
    return (
      <Link
        href={PULP_URL}
        className="block transition-opacity hover:opacity-[0.92] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,109,63,0.5)]"
        style={{ textDecoration: 'none', borderRadius: 16 }}
        rel="noopener noreferrer"
      >
        <article style={cardStyle}>{inner}</article>
      </Link>
    );
  }

  return (
    <article style={{ ...cardStyle, opacity: 0.92 }} aria-current={false}>
      {inner}
    </article>
  );
}

export default function PapayaHoldingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, color: 'rgba(255,255,255,0.92)' }}>
      <header className="flex flex-col items-center text-center px-8 pt-24 pb-16 md:pt-32 md:pb-24">
        <h1
          className="m-0 text-[clamp(2.75rem,10vw,4.5rem)] leading-none tracking-[-0.03em]"
          style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'rgba(255,255,255,0.96)' }}
        >
          papaya.
        </h1>
        <p
          className="mt-6 max-w-md m-0"
          style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 17, fontWeight: 400, color: MUTED, letterSpacing: '0.01em' }}
        >
          AI-powered music production tools
        </p>
      </header>

      <main className="flex-1 px-8 pb-24">
        <div className="mx-auto grid max-w-[720px] gap-4 sm:grid-cols-2">
          {PRODUCTS.map(p => (
            <ProductCard key={p.slug} {...p} />
          ))}
        </div>
      </main>

      <footer className="px-8 py-12 mt-auto" style={{ borderTop: `1px solid ${BORDER}` }}>
        <p
          className="text-center m-0 mb-6"
          style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13, color: MICRO }}
        >
          © 2026 papaya.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-8" aria-label="Footer">
          <a
            href="https://x.com/bypapaya"
            className="transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,109,63,0.45)]"
            style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 14, color: MUTED, textDecoration: 'none' }}
            rel="noopener noreferrer"
            target="_blank"
          >
            X (Twitter)
          </a>
          <a
            href="mailto:hello@bypapaya.com"
            className="transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,109,63,0.45)]"
            style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 14, color: MUTED, textDecoration: 'none' }}
          >
            Contact
          </a>
        </nav>
      </footer>
    </div>
  );
}
