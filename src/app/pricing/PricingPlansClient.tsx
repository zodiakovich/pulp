'use client';

import Link from 'next/link';
import { useState } from 'react';

const BG = '#09090B';
const CARD = '#111118';
const BORDER = '#1A1A2E';
const ACCENT = '#FF6D3F';
const ACTIVE = '#00B894';
const INACTIVE = '#1A1A2E';
const CTA_TEXT = '#09090B';
const STUDIO_BG = '#14120F';

const ANNUAL_DISCOUNT = 0.2;

const PRO_MONTHLY = 7;
const STUDIO_MONTHLY = 19;

type Billing = 'monthly' | 'annual';

function formatMoney(n: number) {
  const s = n.toFixed(2);
  return s.endsWith('.00') ? `$${Math.round(n)}` : `$${s}`;
}

function effectiveMonthly(base: number, billing: Billing) {
  if (billing === 'monthly') return base;
  return base * (1 - ANNUAL_DISCOUNT);
}

/** Pro / Studio price display: annual = stacked strikethrough + active + /month; monthly = inline row. */
function PaidPlanPriceBlock({ baseMonthly, billing }: { baseMonthly: number; billing: Billing }) {
  const display = effectiveMonthly(baseMonthly, billing);

  if (billing === 'monthly') {
    return (
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(2.75rem, 6vw, 3.5rem)',
            lineHeight: 1,
            color: '#F0F0FF',
          }}
        >
          {formatMoney(display)}
        </span>
        <span className="pb-2 text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.9)' }}>
          /month
        </span>
      </div>
    );
  }

  return (
    <div className="mb-2 flex flex-col items-start gap-1">
      <span
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          fontWeight: 400,
          color: '#4A4A5A',
          textDecoration: 'line-through',
          lineHeight: 1.2,
        }}
      >
        {formatMoney(baseMonthly)}
      </span>
      <span
        className="text-[40px] leading-none sm:text-[48px]"
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          color: '#F5F5F5',
        }}
      >
        {formatMoney(display)}
      </span>
      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#8A8A9A', lineHeight: 1.2 }}>/month</span>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: active ? ACTIVE : INACTIVE }}
      aria-hidden
    />
  );
}

function CheckoutCta({
  plan,
  billing,
  label,
}: {
  plan: 'pro' | 'studio';
  billing: Billing;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-full">
      <button
        type="button"
        className="w-full rounded-xl px-8 py-4 text-base font-semibold transition-all min-h-[56px] disabled:opacity-45"
        style={{ background: ACCENT, color: CTA_TEXT }}
        disabled={loading}
        onClick={async () => {
          if (loading) return;
          setError(null);
          setLoading(true);
          try {
            const res = await fetch('/api/stripe/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan, billing }),
            });
            if (res.status === 401) {
              window.location.href = '/sign-in';
              return;
            }
            const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
            if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`);
            if (!data.url) throw new Error('Missing checkout URL');
            window.location.href = data.url;
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Checkout failed');
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? 'Redirecting…' : label}
      </button>
      {error && (
        <p className="mt-3 text-center text-xs" style={{ color: 'rgba(233,69,96,0.95)', fontFamily: 'DM Sans, sans-serif' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const FREE_FEATURES = ['MIDI export', '5 genres', 'Basic piano roll', 'Generation history'] as const;

const PRO_EXTRA = ['All genres & artists', 'Full piano roll', 'Priority generation', 'Public gallery'] as const;

const STUDIO_EXTRA = ['Upload MIDI & continue', 'Advanced mix engine'] as const;

const COMPARE_ROWS: { label: string; free: boolean; pro: boolean; studio: boolean }[] = [
  { label: 'MIDI export', free: true, pro: true, studio: true },
  { label: 'Monthly generations', free: true, pro: true, studio: true },
  { label: 'Genre library (5 → all)', free: true, pro: true, studio: true },
  { label: 'Piano roll depth', free: true, pro: true, studio: true },
  { label: 'Generation history', free: true, pro: true, studio: true },
  { label: 'Priority generation', free: false, pro: true, studio: true },
  { label: 'Public gallery', free: false, pro: true, studio: true },
  { label: 'Upload MIDI & continue', free: false, pro: false, studio: true },
  { label: 'Advanced mix engine', free: false, pro: false, studio: true },
];

export function PricingPlansClient() {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <div style={{ background: BG, color: 'rgba(240,240,255,0.92)' }}>
      <section className="px-4 sm:px-8 pt-32 pb-16 text-center">
        <p
          className="mb-4 text-xs uppercase tracking-[0.14em]"
          style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.9)' }}
        >
          Pricing
        </p>
        <h1
          className="mx-auto max-w-[720px] mb-8"
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.08,
            color: '#F0F0FF',
          }}
        >
          Simple plans. Serious output.
        </h1>
        <p
          className="mx-auto max-w-[520px] mb-12 text-base leading-relaxed"
          style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.95)' }}
        >
          Pick a monthly allowance that fits your workflow. Upgrade or downgrade anytime.
        </p>

        <div
          className="inline-flex rounded-full p-1 gap-0"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            className="rounded-full px-8 py-3 text-sm font-medium transition-colors min-h-[48px]"
            style={{
              fontFamily: 'DM Sans, sans-serif',
              background: billing === 'monthly' ? BORDER : 'transparent',
              color: billing === 'monthly' ? '#F0F0FF' : 'rgba(138,138,154,0.9)',
            }}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className="rounded-full px-8 py-3 text-sm font-medium transition-colors min-h-[48px]"
            style={{
              fontFamily: 'DM Sans, sans-serif',
              background: billing === 'annual' ? BORDER : 'transparent',
              color: billing === 'annual' ? '#F0F0FF' : 'rgba(138,138,154,0.9)',
            }}
            onClick={() => setBilling('annual')}
          >
            Annual <span style={{ color: ACTIVE }}>(−20%)</span>
          </button>
        </div>
      </section>

      <section className="px-4 sm:px-8 pb-24">
        <div className="mx-auto max-w-[1200px] grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Free */}
          <div
            className="flex flex-col rounded-2xl p-10"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <div className="mb-10">
              <p
                className="mb-6 text-xs uppercase tracking-[0.12em]"
                style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.85)' }}
              >
                Free
              </p>
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <span
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 800,
                    fontSize: 'clamp(2.75rem, 6vw, 3.5rem)',
                    lineHeight: 1,
                    color: '#F0F0FF',
                  }}
                >
                  $0
                </span>
                <span className="pb-2 text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.9)' }}>
                  /month
                </span>
              </div>
              <p className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.85)' }}>
                10 generations / month
              </p>
            </div>
            <ul className="mb-10 flex flex-col gap-5 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <span
                    className="h-5 w-5 flex-shrink-0 rounded-full"
                    style={{ background: ACTIVE }}
                    aria-hidden
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className="mt-auto block w-full rounded-xl border py-4 text-center text-base font-semibold transition-colors min-h-[56px] flex items-center justify-center"
              style={{
                borderColor: 'rgba(255,255,255,0.14)',
                color: '#F0F0FF',
                textDecoration: 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Go to dashboard
            </Link>
          </div>

          {/* Pro */}
          <div
            className="flex flex-col rounded-2xl p-10"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <div className="mb-10">
              <p
                className="mb-6 text-xs uppercase tracking-[0.12em]"
                style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.85)' }}
              >
                Pro
              </p>
              <PaidPlanPriceBlock baseMonthly={PRO_MONTHLY} billing={billing} />
              <p className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.85)' }}>
                150 generations / month
                {billing === 'annual' ? ' · billed annually' : ''}
              </p>
            </div>
            <ul className="mb-10 flex flex-col gap-5 flex-1">
              {[...FREE_FEATURES, ...PRO_EXTRA].map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ background: ACTIVE }} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <CheckoutCta plan="pro" billing={billing} label="Subscribe to Pro" />
          </div>

          {/* Studio — featured */}
          <div className="flex flex-col rounded-2xl p-10" style={{ background: STUDIO_BG, border: `2px solid ${ACCENT}` }}>
            <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
              <div>
              <p
                className="mb-6 text-xs uppercase tracking-[0.12em]"
                style={{ fontFamily: 'DM Sans, sans-serif', color: ACCENT }}
              >
                Studio
              </p>
              <PaidPlanPriceBlock baseMonthly={STUDIO_MONTHLY} billing={billing} />
              <p className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.85)' }}>
                600 generations / month
                {billing === 'annual' ? ' · billed annually' : ''}
              </p>
              </div>
              <span
                className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{ background: ACCENT, color: CTA_TEXT, fontFamily: 'DM Sans, sans-serif' }}
              >
                Most popular
              </span>
            </div>
            <ul className="mb-10 flex flex-col gap-5 flex-1">
              {[...FREE_FEATURES, ...PRO_EXTRA, ...STUDIO_EXTRA].map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ background: ACTIVE }} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <CheckoutCta plan="studio" billing={billing} label="Subscribe to Studio" />
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-8 pb-32">
        <div className="mx-auto max-w-[1000px]">
          <h2
            className="mb-12 text-center"
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
              letterSpacing: '-0.02em',
              color: '#F0F0FF',
            }}
          >
            Compare at a glance
          </h2>
          <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr style={{ background: CARD }}>
                  <th className="px-6 py-5 text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.85)' }}>
                    Feature
                  </th>
                  <th className="px-4 py-5 text-center text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.85)' }}>
                    Free
                  </th>
                  <th className="px-4 py-5 text-center text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(138,138,154,0.85)' }}>
                    Pro
                  </th>
                  <th className="px-4 py-5 text-center text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'DM Sans, sans-serif', color: ACCENT }}>
                    Studio
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.label} style={{ background: i % 2 === 0 ? CARD : 'transparent' }}>
                    <td className="px-6 py-4 align-middle text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(240,240,255,0.88)' }}>
                      {row.label}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      {row.label === 'Monthly generations' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'DM Sans, sans-serif', color: '#F0F0FF' }}>
                          10
                        </span>
                      ) : row.label === 'Genre library (5 → all)' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(240,240,255,0.85)' }}>
                          5 genres
                        </span>
                      ) : row.label === 'Piano roll depth' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(240,240,255,0.85)' }}>
                          Basic
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <StatusDot active={row.free} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      {row.label === 'Monthly generations' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'DM Sans, sans-serif', color: '#F0F0FF' }}>
                          150
                        </span>
                      ) : row.label === 'Genre library (5 → all)' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(240,240,255,0.85)' }}>
                          All + artists
                        </span>
                      ) : row.label === 'Piano roll depth' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(240,240,255,0.85)' }}>
                          Full
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <StatusDot active={row.pro} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      {row.label === 'Monthly generations' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'DM Sans, sans-serif', color: '#F0F0FF' }}>
                          600
                        </span>
                      ) : row.label === 'Genre library (5 → all)' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(240,240,255,0.85)' }}>
                          All + artists
                        </span>
                      ) : row.label === 'Piano roll depth' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(240,240,255,0.85)' }}>
                          Full
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <StatusDot active={row.studio} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
