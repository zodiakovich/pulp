import Link from 'next/link';
import type { Metadata } from 'next';
import { UpgradeButton } from './UpgradeButton';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Pricing — Pulp',
  description: 'Simple, transparent pricing for AI MIDI generation.',
};

const FREE_FEATURES = [
  '10 generations per month',
  'All 20 genres',
  'All 15 style tags',
  '.mid export',
  'Basic prompt parsing',
];

const PRO_FEATURES = [
  'Unlimited generations',
  'Claude AI smart prompt (Haiku)',
  'Generation history saved forever',
  'Priority generation',
  'Commercial license',
];

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="pricing" />

      {/* Hero */}
      <section className="pt-36 pb-16 px-8 text-center">
        <h1
          className="font-extrabold mb-4 text-gradient"
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(36px, 5vw, 56px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Simple pricing.
        </h1>
        <p style={{ fontSize: 16, color: 'var(--foreground-muted)', maxWidth: 480, margin: '0 auto' }}>
          Start free, upgrade when you need more.
        </p>
      </section>

      {/* Cards */}
      <section className="pb-24 px-8">
        <div className="max-w-[800px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* FREE */}
          <div
            className="rounded-2xl p-8 flex flex-col"
            style={{ background: '#111118', border: '1px solid #1A1A2E' }}
          >
            <div className="mb-6">
              <p
                className="text-xs uppercase tracking-widest mb-3"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}
              >
                Free
              </p>
              <div className="flex items-end gap-1 mb-2">
                <span
                  className="font-extrabold"
                  style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, lineHeight: 1, color: '#F0F0FF' }}
                >
                  $0
                </span>
                <span style={{ color: '#8A8A9A', fontSize: 14, marginBottom: 8 }}>/month</span>
              </div>
              <p style={{ fontSize: 14, color: '#8A8A9A' }}>No credit card required.</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(240,240,255,0.8)' }}>
                  <span style={{ color: '#00B894', fontSize: 16 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/"
              className="w-full text-center py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                display: 'block',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#F0F0FF',
                textDecoration: 'none',
              }}
            >
              Get started free
            </Link>
          </div>

          {/* PRO */}
          <div
            className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
            style={{ background: '#111118', border: '2px solid #FF6D3F' }}
          >
            <div className="mb-6">
              <p
                className="text-xs uppercase tracking-widest mb-3"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: '#FF6D3F' }}
              >
                Pro
              </p>
              <div className="flex items-end gap-1 mb-2">
                <span
                  className="font-extrabold"
                  style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, lineHeight: 1, color: '#F0F0FF' }}
                >
                  $7
                </span>
                <span style={{ color: '#8A8A9A', fontSize: 14, marginBottom: 8 }}>/month</span>
              </div>
              <p style={{ fontSize: 14, color: '#8A8A9A' }}>Unlimited creative power.</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(240,240,255,0.8)' }}>
                  <span style={{ color: '#FF6D3F', fontSize: 16 }}>✦</span>
                  {f}
                </li>
              ))}
            </ul>
            <UpgradeButton />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-10 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center justify-center gap-4 mb-3 text-xs"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}>
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
