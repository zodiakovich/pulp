'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ButtonLoadingDots } from '@/components/ButtonLoadingDots';

const BG = 'var(--bg)';
const CARD = 'var(--surface)';
const BORDER = 'var(--border)';
const ACCENT = '#FF6D3F';
const CHECK_ON = ACCENT;
const INACTIVE = 'rgba(255,255,255,0.08)';
const CTA_TEXT = 'var(--bg)';
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

const FREE_FEATURES = ['MIDI export', '5 genres', 'Basic piano roll', 'Generation history'] as const;

const PRO_EXTRA = ['All genres + artists', 'Full piano roll', 'Priority generation', 'Public gallery'] as const;

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
  const prefersReducedMotion = useReducedMotion();

  // Subtle scroll-driven parallax for plan cards (depth).
  const plansRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: plansProgress } = useScroll({
    target: plansRef,
    offset: ['start 0.85', 'end 0.25'],
  });
  const plansP = useSpring(plansProgress, { stiffness: 140, damping: 34, mass: 0.55 });
  const sideY = useTransform(plansP, [0, 1], [10, -10]);
  const centerY = useTransform(plansP, [0, 1], [7, -7]);

  return (
    <div style={{ background: BG, color: 'var(--text)' }}>
      <section className="px-4 sm:px-8 pt-32 pb-16 text-center">
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
          Plans and limits
        </h1>
        <p
          className="mx-auto max-w-[520px] mb-12 text-base leading-relaxed"
          style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', color: 'var(--muted)' }}
        >
          Choose a monthly generation limit. You can change plans at any time.
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
              background: 'rgba(255,255,255,0.08)',
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
            Annual <span style={{ color: ACCENT, fontWeight: 600 }}>20% off</span>
          </button>
        </div>
      </section>

      <section className="px-4 sm:px-8 pb-24">
        <div ref={plansRef} className="mx-auto max-w-[1200px] grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Free */}
          <motion.div className="flex flex-col rounded-2xl p-10 glass-elevated card-tilt-hover" style={{ y: prefersReducedMotion ? 0 : sideY }}>
            <div className="mb-10">
              <p
                className="mb-6 text-xs uppercase tracking-[0.12em]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}
              >
                Free
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
                10 generations / month
              </p>
            </div>
            <ul className="mb-10 flex flex-col gap-5 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400 }}>
                  <span
                    className="h-5 w-5 flex-shrink-0 rounded-full"
                    style={{ background: ACCENT }}
                    aria-hidden
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/"
              className="mt-auto block w-full rounded-lg border py-4 text-center text-base font-semibold transition-colors duration-200 ease-ui min-h-[56px] flex items-center justify-center active:scale-[0.98]"
              style={{
                borderColor: 'rgba(255,255,255,0.14)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 500,
              }}
            >
              Start free
            </Link>
          </motion.div>

          {/* Pro */}
          <motion.div className="flex flex-col rounded-2xl p-10 glass-elevated card-tilt-hover" style={{ y: prefersReducedMotion ? 0 : centerY }}>
            <div className="mb-10">
              <p
                className="mb-6 text-xs uppercase tracking-[0.12em]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}
              >
                Pro
              </p>
              <PaidPlanPriceBlock baseMonthly={PRO_MONTHLY} billing={billing} />
              <p className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}>
                150 generations / month
                {billing === 'annual' ? ' · billed annually' : ''}
              </p>
            </div>
            <ul className="mb-10 flex flex-col gap-5 flex-1">
              {[...FREE_FEATURES, ...PRO_EXTRA].map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400 }}>
                  <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ background: ACCENT }} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <CheckoutCta plan="pro" billing={billing} label="Subscribe" />
          </motion.div>

          {/* Studio — featured */}
          <motion.div
            className="flex flex-col rounded-2xl p-10 glass-elevated card-tilt-hover"
            style={{
              background: STUDIO_BG,
              border: `2px solid ${ACCENT}`,
              boxShadow:
                '0 1px 2px rgba(255,255,255,0.03), 0 4px 8px rgba(255,255,255,0.02), 0 12px 24px rgba(0,0,0,0.4), 0 24px 48px rgba(0,0,0,0.2), 0 0 52px rgba(255,109,63,0.12)',
              y: prefersReducedMotion ? 0 : sideY,
            }}
          >
            <div className="mb-10 flex flex-wrap items-start gap-4">
              <div>
              <p
                className="mb-6 text-xs uppercase tracking-[0.12em]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: ACCENT }}
              >
                Studio
              </p>
              <PaidPlanPriceBlock baseMonthly={STUDIO_MONTHLY} billing={billing} />
              <p className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--muted)' }}>
                600 generations / month
                {billing === 'annual' ? ' · billed annually' : ''}
              </p>
              </div>
            </div>
            <ul className="mb-10 flex flex-col gap-5 flex-1">
              {[...FREE_FEATURES, ...PRO_EXTRA, ...STUDIO_EXTRA].map(f => (
                <li key={f} className="flex items-center gap-4 text-sm leading-snug" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400 }}>
                  <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ background: ACCENT }} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <CheckoutCta plan="studio" billing={billing} label="Subscribe" />
          </motion.div>
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
                      {row.label === 'Monthly generations' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          10
                        </span>
                      ) : row.label === 'Genre library (5 → all)' ? (
                        <span className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          5 genres
                        </span>
                      ) : row.label === 'Piano roll depth' ? (
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
                      {row.label === 'Monthly generations' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          150
                        </span>
                      ) : row.label === 'Genre library (5 → all)' ? (
                        <span className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          All + artists
                        </span>
                      ) : row.label === 'Piano roll depth' ? (
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
                      {row.label === 'Monthly generations' ? (
                        <span className="text-sm font-medium" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          600
                        </span>
                      ) : row.label === 'Genre library (5 → all)' ? (
                        <span className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, letterSpacing: '0.02em', color: 'var(--text)' }}>
                          All + artists
                        </span>
                      ) : row.label === 'Piano roll depth' ? (
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
