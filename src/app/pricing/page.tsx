import Link from 'next/link';
import type { Metadata } from 'next';
import { UpgradeButton } from './UpgradeButton';
import { Navbar } from '@/components/Navbar';
import { PricingFAQ } from './PricingFAQ';

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

const FEATURES = [
  { name: 'Generations per month', free: '10', pro: 'Unlimited' },
  { name: 'Genres available', free: '20', pro: '20' },
  { name: 'Style tags', free: '15', pro: '15' },
  { name: '4 independent MIDI layers', free: '✓', pro: '✓' },
  { name: 'Download .mid files', free: '✓', pro: '✓' },
  { name: 'Piano roll editor', free: '✓', pro: '✓' },
  { name: 'Export to Ableton', free: '✓', pro: '✓' },
  { name: 'Drag to DAW', free: '✓', pro: '✓' },
  { name: 'Generation history', free: 'Last 3', pro: 'Forever' },
  { name: 'Smart prompt suggestions', free: '✗', pro: '✓' },
  { name: 'Priority generation speed', free: '✗', pro: '✓' },
  { name: 'Commercial license', free: '✗', pro: '✓' },
  { name: 'Early access to new tools', free: '✗', pro: '✓' },
];

function TableCell({
  value,
  proColumn,
}: {
  value: string;
  proColumn?: boolean;
}) {
  if (value === '✓') {
    return (
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00B894' }}>✓</span>
    );
  }
  if (value === '✗') {
    return (
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--foreground-muted)' }}>✗</span>
    );
  }
  return (
    <span
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: proColumn ? 700 : 400,
        color: proColumn ? 'var(--foreground)' : 'var(--foreground-muted)',
      }}
    >
      {value}
    </span>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="pricing" />

      {/* SECTION 1 — Header */}
      <section className="pt-36 pb-16 px-4 sm:px-8 text-center">
        <h1
          className="font-extrabold mb-4 text-gradient"
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(36px, 5vw, 56px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Start free. Go pro when you&apos;re ready.
        </h1>
        <p style={{ fontSize: 16, color: 'var(--foreground-muted)', maxWidth: 520, margin: '0 auto' }}>
          10 free generations every month. No credit card required. Upgrade anytime.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="pb-16 px-4 sm:px-8">
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

      {/* SECTION 2 — Feature comparison */}
      <section className="pb-20 px-4 sm:px-8">
        <div className="max-w-[800px] mx-auto">
          <h2
            className="font-extrabold text-center mb-8"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--foreground)' }}
          >
            Compare plans
          </h2>
          <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr style={{ background: 'var(--surface)' }}>
                  <th
                    className="px-4 py-4"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}
                  >
                    Feature
                  </th>
                  <th
                    className="px-4 py-4 text-center"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}
                  >
                    Free
                  </th>
                  <th
                    className="px-4 py-4 text-center"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}
                  >
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((row, i) => (
                  <tr
                    key={row.name}
                    style={{
                      background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
                    }}
                  >
                    <td
                      className="px-4 py-3 align-middle"
                      style={{ color: 'var(--foreground-muted)', fontSize: 14 }}
                    >
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <TableCell value={row.free} />
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <TableCell value={row.pro} proColumn />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 3 — FAQ */}
      <section className="pb-20 px-4 sm:px-8">
        <h2
          className="font-extrabold text-center mb-10"
          style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--foreground)' }}
        >
          FAQ
        </h2>
        <PricingFAQ />
      </section>

      {/* SECTION 4 — CTA */}
      <section className="pb-24 px-4 sm:px-8 text-center">
        <p
          className="mb-6"
          style={{ fontSize: 18, color: 'var(--foreground-muted)', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}
        >
          Still not sure? Try it free — no account needed.
        </p>
        <Link
          href="/"
          className="btn-primary inline-flex items-center justify-center"
          style={{ height: 48, padding: '0 24px', fontSize: 15, textDecoration: 'none' }}
        >
          Generate your first MIDI →
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-8 py-10 text-center" style={{ borderTop: '1px solid var(--border)' }}>
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
