'use client';

import Link from 'next/link';
import { useState } from 'react';
import { UpgradeButton } from './UpgradeButton';

type PlanCardsProps = {
  freeVisible: readonly string[];
  freeMore: readonly string[];
  proVisible: readonly string[];
  proMore: readonly string[];
};

export function PricingPlanCards({ freeVisible, freeMore, proVisible, proMore }: PlanCardsProps) {
  const [showFreeMore, setShowFreeMore] = useState(false);
  const [showProMore, setShowProMore] = useState(false);

  return (
    <div className="max-w-[800px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
      <div
        className="rounded-2xl p-10 flex flex-col"
        style={{ background: '#111118', border: '1px solid #1A1A2E' }}
      >
        <div className="mb-8">
          <p
            className="text-xs uppercase tracking-widest mb-4"
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

        <ul className={`space-y-4 flex-1 ${freeMore.length ? 'mb-6' : 'mb-8'}`}>
          {freeVisible.map(f => (
            <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(240,240,255,0.85)' }}>
              <span style={{ color: '#00B894', fontSize: 16 }}>✓</span>
              {f}
            </li>
          ))}
          {showFreeMore &&
            freeMore.map(f => (
              <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(240,240,255,0.75)' }}>
                <span style={{ color: '#00B894', fontSize: 16 }}>✓</span>
                {f}
              </li>
            ))}
        </ul>

        {freeMore.length > 0 && (
          <button
            type="button"
            className="mb-8 text-left text-sm font-medium transition-colors w-full py-2"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: '#FF6D3F' }}
            onClick={() => setShowFreeMore(v => !v)}
            aria-expanded={showFreeMore}
          >
            {showFreeMore ? 'Hide extra features' : 'See all features'}
          </button>
        )}

        <Link
          href="/"
          className="w-full text-center py-3 px-6 rounded-xl text-sm font-medium transition-all mt-auto"
          style={{
            display: 'block',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#F0F0FF',
            textDecoration: 'none',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.2) inset',
          }}
        >
          Get started free
        </Link>
      </div>

      <div
        className="rounded-2xl p-10 flex flex-col relative overflow-hidden"
        style={{ background: '#111118', border: '2px solid #FF6D3F' }}
      >
        <div className="mb-8">
          <p
            className="text-xs uppercase tracking-widest mb-4"
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

        <ul className={`space-y-4 flex-1 ${proMore.length ? 'mb-6' : 'mb-8'}`}>
          {proVisible.map(f => (
            <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(240,240,255,0.85)' }}>
              <span style={{ color: '#FF6D3F', fontSize: 16 }}>✦</span>
              {f}
            </li>
          ))}
          {showProMore &&
            proMore.map(f => (
              <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(240,240,255,0.75)' }}>
                <span style={{ color: '#FF6D3F', fontSize: 16 }}>✦</span>
                {f}
              </li>
            ))}
        </ul>

        {proMore.length > 0 && (
          <button
            type="button"
            className="mb-8 text-left text-sm font-medium transition-colors w-full py-2"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: '#FF6D3F' }}
            onClick={() => setShowProMore(v => !v)}
            aria-expanded={showProMore}
          >
            {showProMore ? 'Hide extra features' : 'See all features'}
          </button>
        )}

        <UpgradeButton />
      </div>
    </div>
  );
}
