import Link from 'next/link';
import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { PricingFAQ } from './PricingFAQ';
import { PricingPlansClient } from './PricingPlansClient';

export const metadata: Metadata = {
  title: 'Pricing — Pulp',
  description: 'Free, Pro, and Studio plans for AI MIDI generation.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#09090B' }}>
      <Navbar active="pricing" />

      <PricingPlansClient />

      <section className="px-4 sm:px-8 pb-32" style={{ background: '#09090B' }}>
        <h2
          className="mb-14 text-center"
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
            letterSpacing: '-0.02em',
            color: '#F0F0FF',
          }}
        >
          FAQ
        </h2>
        <PricingFAQ />
      </section>

      <section className="w-full px-4 sm:px-8 py-24" style={{ background: '#111118', borderTop: '1px solid #1A1A2E' }}>
        <div className="mx-auto flex max-w-[720px] flex-col items-center gap-8 text-center">
          <p
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(1.25rem, 3vw, 1.625rem)',
              color: '#F0F0FF',
              lineHeight: 1.35,
            }}
          >
            Try Pulp on the home page — no card required.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-[56px] items-center justify-center rounded-xl px-8 py-4 text-base font-semibold transition-all"
            style={{ background: '#FF6D3F', color: '#09090B', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}
          >
            Start generating
          </Link>
        </div>
      </section>

      <footer className="px-4 sm:px-8 py-14 text-center" style={{ borderTop: '1px solid #1A1A2E', background: '#09090B' }}>
        <div
          className="mb-3 flex flex-wrap items-center justify-center gap-4 text-xs"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}
        >
          <Link href="/legal/terms" className="footer-link">
            Terms
          </Link>
          <Link href="/legal/privacy" className="footer-link">
            Privacy
          </Link>
          <Link href="/legal/license" className="footer-link">
            License
          </Link>
        </div>
        <span
          className="text-xs"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.4)' }}
        >
          © 2026 PULP. MADE BY PAPAYA.
        </span>
      </footer>
    </div>
  );
}
