'use client';

import Link from 'next/link';
import { useState } from 'react';
import { posthog } from '@/components/PostHogProvider';
import { motion } from 'framer-motion';
import { ButtonLoadingDots } from '@/components/ButtonLoadingDots';

const BG = 'var(--bg)';
const CARD = 'var(--surface)';
const BORDER = 'var(--border)';
const ACCENT = '#FF6D3F';
const CHECK_ON = ACCENT;
const INACTIVE = 'var(--surface-weak)';
const CTA_TEXT = 'var(--on-accent)';
const STUDIO_BG = 'var(--surface-strong)';

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

  // Guard: free plans should never show "annual discount" strikethrough UI.
  if (baseMonthly === 0) {
    return (
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 400,
            fontSize: 'clamp(2.75rem, 6vw, 3.5rem)',
            lineHeight: 1,
            color: 'var(--text)',
            letterSpacing: '0.02em',
          }}
        >
          {formatMoney(0)}
        </span>
        <span className="pb-2 text-sm" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', color: 'var(--muted)', fontWeight: 400 }}>
          /month
        </span>
      </div>
    );
  }

  if (billing === 'monthly') {
    return (
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 400,
            fontSize: 'clamp(2.75rem, 6vw, 3.5rem)',
            lineHeight: 1,
            color: 'var(--text)',
            letterSpacing: '0.02em',
          }}
        >
          {formatMoney(display)}
        </span>
        <span className="pb-2 text-sm" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', color: 'var(--muted)', fontWeight: 400 }}>
          /month
        </span>
      </div>
    );
  }

  return (
    <div className="mb-2 flex flex-col items-start gap-1">
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 14,
          fontWeight: 400,
          color: 'var(--text-micro)',
          textDecoration: 'line-through',
          lineHeight: 1.2,
          letterSpacing: '0.02em',
        }}
      >
        {formatMoney(baseMonthly)}
      </span>
      <span
        className="text-[40px] leading-none sm:text-[48px]"
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 400,
          color: 'var(--text)',
          letterSpacing: '0.02em',
        }}
      >
        {formatMoney(display)}
      </span>
      <span style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, fontWeight: 400 }}>/month</span>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: active ? CHECK_ON : INACTIVE }}
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
        className="w-full rounded-lg px-8 py-4 text-base font-semibold transition-[transform,opacity] duration-200 ease-ui min-h-[56px] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
        style={{ background: ACCENT, color: CTA_TEXT }}
        disabled={loading}
        onClick={async () => {
          if (loading) return;
          setError(null);
          setLoading(true);
          posthog.capture('plan_upgrade_clicked', { plan, billing });
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
        {loading ? <ButtonLoadingDots label="Redirecting" /> : label}
      </button>
      {error && (
        <p className="mt-3 text-center text-xs" style={{ color: 'var(--muted)', fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const FREE_FEATURES = ['Starter usage windows', 'Multi-track MIDI export', '5 core genres', 'Generation history'] as const;

const PRO_EXTRA = ['Higher usage windows', 'All visible genres', 'Find Similar variations', 'Public/private sharing', 'WAV and Ableton export'] as const;

const STUDIO_EXTRA = ['Studio usage windows', 'Upload MIDI & continue', 'Audio to MIDI workspace', 'Advanced mix controls'] as const;

const COMPARE_ROWS: { label: string; free: boolean; pro: boolean; studio: boolean }[] = [
  { label: 'MIDI export', free: true, pro: true, studio: true },
  { label: 'Usage windows', free: true, pro: true, studio: true },
  { label: 'Genre library', free: true, pro: true, studio: true },
  { label: 'Piano roll editor', free: true, pro: true, studio: true },
  { label: 'Generation history', free: true, pro: true, studio: true },
  { label: 'Find Similar variations', free: false, pro: true, studio: true },
  { label: 'Public/private sharing', free: false, pro: true, studio: true },
  { label: 'WAV and Ableton export', free: false, pro: true, studio: true },
  { label: 'Upload MIDI & continue', free: false, pro: false, studio: true },
  { label: 'Audio to MIDI workspace', free: false, pro: false, studio: true },
  { label: 'Advanced mix controls', free: false, pro: false, studio: true },
];

export function PricingPlansClient() {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <div style={{ background: BG, color: 'var(--text)' }}>
      <section className="px-4 sm:px-8 pt-32 pb-14 text-center">
        <p
          className="mb-4 text-xs uppercase tracking-[0.14em]"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}
        >
          Pricing
        </p>
        <h1
          className="mx-auto max-w-[720px] mb-8"
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(2rem, 5vw, 2.5rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.08,
            color: 'var(--text)',
          }}
        >
          Start free. Upgrade when it clicks.
        </h1>
        <p
          className="mx-auto max-w-[520px] mb-12 text-base leading-relaxed"
          style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', color: 'var(--muted)' }}
        >
          Every plan gives you real MIDI — melody, chords, bass, drums — ready for your DAW. No credit card required to start.
        </p>

        <div
          className="relative inline-flex rounded-xl p-1 gap-0"
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            transition: 'background-color 200ms cubic-bezier(0.23, 1, 0.32, 1), border-color 200ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
          role="group"
          aria-label="Billing period"
        >
          <motion.div
            aria-hidden
            layout
            transition={{ type: 'tween', duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: billing === 'monthly' ? 4 : '50%',
              width: 'calc(50% - 4px)',
              borderRadius: 12,
              background: 'var(--surface-weak)',
              border: '1px solid var(--border-weak)',
              transition: 'background-color 200ms cubic-bezier(0.23, 1, 0.32, 1), border-color 200ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          />
          <button
            type="button"
            className="relative z-10 rounded-xl px-8 py-3 text-sm font-medium min-h-[48px]"
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              color: billing === 'monthly' ? 'var(--text)' : 'var(--muted)',
              transition: 'color 200ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className="relative z-10 rounded-xl px-8 py-3 text-sm font-medium min-h-[48px]"
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              color: billing === 'annual' ? 'var(--text)' : 'var(--muted)',
              transition: 'color 200ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
            onClick={() => setBilling('annual')}
          >
            Annual{' '}
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                fontWeight: 700,
                color: billing === 'annual' ? ACCENT : 'rgba(255,109,63,0.65)',
                background: billing === 'annual' ? 'rgba(255,109,63,0.12)' : 'rgba(255,109,63,0.07)',
                borderRadius: 6,
                padding: '2px 7px',
                letterSpacing: '0.02em',
              }}
            >
              Save 20%
            </span>
          </button>
        </div>
        <div className="mx-auto mt-8 grid max-w-[760px] grid-cols-1 gap-2 sm:grid-cols-3">
          {['Standard MIDI exports', 'Cancel anytime', 'Built for any DAW'].map(item => (
            <div
              key={item}
              className="rounded-lg px-4 py-3 text-xs"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--muted)',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.02em',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-8 pb-24">
        <div className="mx-auto grid max-w-[1160px] grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          {/* Free */}
          <div className="flex flex-col rounded-xl p-8 glass-elevated card-tilt-hover">
            <div className="mb-8">
              <p
                className="mb-3 text-xs uppercase tracking-[0.12em]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}
              >
                Free
              </p>
              <p className="mb-6 text-sm leading-relaxed" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', color: 'var(--muted)' }}>
                Try the generator, hear what pulp sounds like, and export your first ideas — no card required.
              </p>
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 400,
                    fontSize: 'clamp(2.75rem, 6vw, 3.5rem)',
                    lineHeight: 1,
                    color: 'var(--text)',
                    letterSpacing: '0.02em',
                  }}
                >
                  $0
                </span>
                <span className="pb-2 text-sm" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400, color: 'var(--muted)' }}>
                  /month
                </span>
              </div>
              <p className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}>
                Starter usage windows
              </p>
            </div>
            <ul className="mb-8 flex flex-1 flex-col gap-4">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400 }}>
                  <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ background: ACCENT }} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/"
              className="mt-auto block w-full rounded-lg border py-4 text-center text-base font-semibold transition-colors duration-200 ease-ui min-h-[56px] flex items-center justify-center active:scale-[0.98]"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 500,
              }}
            >
              Start free
            </Link>
          </div>

          {/* Pro — accent border only, same background as others */}
          <div
            className="flex flex-col rounded-xl p-8 glass-elevated card-tilt-hover"
            style={{ border: `1px solid ${ACCENT}` }}
          >
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-xs uppercase tracking-[0.12em]"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}
                >
                  Pro
                </p>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    fontWeight: 700,
                    color: ACCENT,
                    background: 'rgba(255,109,63,0.12)',
                    border: `1px solid rgba(255,109,63,0.30)`,
                    borderRadius: 6,
                    padding: '3px 8px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Most popular
                </span>
              </div>
              <p className="mb-6 text-sm leading-relaxed" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', color: 'var(--muted)' }}>
                Full genre library, WAV and Ableton exports, and enough generations to make pulp a real part of your workflow.
              </p>
              <PaidPlanPriceBlock baseMonthly={PRO_MONTHLY} billing={billing} />
              <p className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}>
                Higher usage windows
                {billing === 'annual' ? ' - billed annually' : ''}
              </p>
            </div>
            <ul className="mb-8 flex flex-1 flex-col gap-4">
              {[...FREE_FEATURES, ...PRO_EXTRA].map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400 }}>
                  <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ background: ACCENT }} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <CheckoutCta plan="pro" billing={billing} label="Upgrade to Pro" />
          </div>

          {/* Studio */}
          <div className="flex flex-col rounded-xl p-8 glass-elevated card-tilt-hover">
            <div className="mb-8">
              <p
                className="mb-3 text-xs uppercase tracking-[0.12em]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}
              >
                Studio
              </p>
              <p className="mb-6 text-sm leading-relaxed" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', color: 'var(--muted)' }}>
                For heavier writing, editing, and conversion workflows.
              </p>
              <PaidPlanPriceBlock baseMonthly={STUDIO_MONTHLY} billing={billing} />
              <p className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}>
                Studio usage windows
                {billing === 'annual' ? ' - billed annually' : ''}
              </p>
            </div>
            <ul className="mb-8 flex flex-1 flex-col gap-4">
              {[...FREE_FEATURES, ...PRO_EXTRA, ...STUDIO_EXTRA].map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400 }}>
                  <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ background: ACCENT }} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <CheckoutCta plan="studio" billing={billing} label="Upgrade to Studio" />
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-8 pb-32">
        <div className="mx-auto max-w-[1000px]">
          <h2
            className="mb-12 text-center"
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
              letterSpacing: '-0.02em',
              color: 'var(--text)',
            }}
          >
            Compare at a glance
          </h2>
          <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr style={{ background: CARD }}>
                  <th className="px-6 py-5 text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, color: 'var(--muted)' }}>
                    Feature
                  </th>
                  <th className="px-4 py-5 text-center text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, color: 'var(--muted)' }}>
                    Free
                  </th>
                  <th className="px-4 py-5 text-center text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, color: 'var(--muted)' }}>
                    Pro
                  </th>
                  <th className="px-4 py-5 text-center text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, color: ACCENT }}>
                    Studio
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.label} style={{ background: i % 2 === 0 ? CARD : 'transparent' }}>
                    <td className="px-6 py-4 align-middle text-sm" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400, color: 'var(--text)' }}>
                      {row.label}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      {row.label === 'Usage windows' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          Starter
                        </span>
                      ) : row.label === 'Genre library' ? (
                        <span className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          5 genres
                        </span>
                      ) : row.label === 'Piano roll editor' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400, color: 'var(--text)' }}>
                          Basic
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <StatusDot active={row.free} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      {row.label === 'Usage windows' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          Higher
                        </span>
                      ) : row.label === 'Genre library' ? (
                        <span className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          All + artists
                        </span>
                      ) : row.label === 'Piano roll editor' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400, color: 'var(--text)' }}>
                          Full
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <StatusDot active={row.pro} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      {row.label === 'Usage windows' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          Studio
                        </span>
                      ) : row.label === 'Genre library' ? (
                        <span className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          All + artists
                        </span>
                      ) : row.label === 'Piano roll editor' ? (
                        <span className="text-sm" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400, color: 'var(--text)' }}>
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
