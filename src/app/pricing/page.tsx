import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { PricingFAQ } from './PricingFAQ';
import { PricingPlansClient } from './PricingPlansClient';
import { SiteFooter } from '@/components/SiteFooter';
import { PricingJsonLd } from './PricingJsonLd';
import { pageMeta } from '@/lib/seo-metadata';

export const dynamic = 'force-static';

export const metadata = pageMeta({
  title: 'Pricing',
  description:
    'pulp pricing: Free, Pro ($7/mo), and Studio ($19/mo) with monthly MIDI generation limits, Stripe billing, and commercial license on paid plans.',
  path: '/pricing',
});

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <PricingJsonLd />
      <Navbar active="pricing" />

      <PricingPlansClient />

      <section className="px-4 sm:px-8 pb-32" style={{ background: 'var(--bg)' }}>
        <h2
          className="mb-14 text-center"
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            lineHeight: 1.2,
          }}
        >
          FAQ
        </h2>
        <PricingFAQ />
      </section>

      <section className="w-full px-4 sm:px-8 py-24" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div className="mx-auto flex max-w-[720px] flex-col items-center gap-8 text-center">
          <p
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(1.25rem, 3vw, 1.625rem)',
              color: 'var(--text)',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            Start on the home page.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-[56px] items-center justify-center rounded-xl px-8 py-4 text-base font-semibold transition-all"
            style={{ background: 'var(--accent)', color: 'var(--bg)', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}
          >
            Start generating
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
