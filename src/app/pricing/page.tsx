import Link from 'next/link';
import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { PricingFAQ } from './PricingFAQ';
import { PricingPlanCards } from './PricingPlanCards';
import { PricingComparisonTable, type CompareRow } from './PricingComparisonTable';

export const metadata: Metadata = {
  title: 'Pricing — Pulp',
  description: 'Simple, transparent pricing for AI MIDI generation.',
};

const FREE_FEATURES_VISIBLE = [
  '10 generations per month',
  'Full genre & style-tag library',
  '.mid export for any DAW',
  'Four independent MIDI layers',
] as const;

const FREE_FEATURES_MORE = ['Basic prompt parsing'] as const;

const PRO_FEATURES_VISIBLE = [
  'Unlimited generations',
  'Claude (Haiku) smart prompts',
  'Generation history kept forever',
  'Commercial license for your music',
] as const;

const PRO_FEATURES_MORE = ['Priority generation queue', 'Early access to new tools'] as const;

const FEATURE_ROWS: CompareRow[] = [
  { name: 'Generations per month', free: '10', pro: 'Unlimited' },
  { name: 'Generation history', free: 'Last 3', pro: 'Forever' },
  { name: 'Smart prompt suggestions', free: '✗', pro: '✓' },
  { name: 'Commercial license', free: '✗', pro: '✓' },
  { name: 'Priority generation speed', free: '✗', pro: '✓' },
  { name: 'Genres available', free: '20', pro: '20' },
  { name: 'Style tags', free: '15', pro: '15' },
  { name: '4 independent MIDI layers', free: '✓', pro: '✓' },
  { name: 'Download .mid files', free: '✓', pro: '✓' },
  { name: 'Piano roll editor', free: '✓', pro: '✓' },
  { name: 'Export to Ableton', free: '✓', pro: '✓' },
  { name: 'Drag to DAW', free: '✓', pro: '✓' },
  { name: 'Early access to new tools', free: '✗', pro: '✓' },
];

const COMPARISON_TOP = FEATURE_ROWS.slice(0, 5);
const COMPARISON_REST = FEATURE_ROWS.slice(5);

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="pricing" />

      <section className="pt-40 pb-28 px-4 sm:px-8 text-center">
        <h1
          className="font-extrabold mb-6 text-gradient"
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(36px, 5vw, 56px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Start free. Go pro when you&apos;re ready.
        </h1>
        <p
          className="mx-auto"
          style={{ fontSize: 16, color: 'var(--foreground-muted)', maxWidth: 480, lineHeight: 1.6 }}
        >
          10 free generations every month. No credit card required.
        </p>
      </section>

      <section className="pb-32 px-4 sm:px-8">
        <PricingPlanCards
          freeVisible={FREE_FEATURES_VISIBLE}
          freeMore={FREE_FEATURES_MORE}
          proVisible={PRO_FEATURES_VISIBLE}
          proMore={PRO_FEATURES_MORE}
        />
      </section>

      <section className="pb-32 px-4 sm:px-8">
        <div className="max-w-[800px] mx-auto">
          <h2
            className="font-extrabold text-center mb-12"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--foreground)' }}
          >
            Compare plans
          </h2>
          <PricingComparisonTable topRows={COMPARISON_TOP} restRows={COMPARISON_REST} />
        </div>
      </section>

      <section className="pb-32 px-4 sm:px-8">
        <h2
          className="font-extrabold text-center mb-14"
          style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--foreground)' }}
        >
          FAQ
        </h2>
        <PricingFAQ />
      </section>

      <section
        className="w-full px-4 sm:px-8 py-24"
        style={{ background: '#111118', borderTop: '1px solid var(--border)' }}
      >
        <div className="max-w-[720px] mx-auto flex flex-col items-center gap-8 text-center">
          <p
            className="font-extrabold"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(20px, 4vw, 26px)', color: 'var(--foreground)', lineHeight: 1.35 }}
          >
            Try Pulp on the home page — no card required.
          </p>
          <Link href="/" className="btn-primary inline-flex items-center justify-center" style={{ textDecoration: 'none' }}>
            Start generating
          </Link>
        </div>
      </section>

      <footer className="px-4 sm:px-8 py-14 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className="flex items-center justify-center gap-4 mb-3 text-xs"
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
