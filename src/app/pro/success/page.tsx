'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 40 }, (_, i) => i), []);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translate3d(var(--x), -20px, 0) rotate(0deg); opacity: 0; }
        10% { opacity: 1; }
        100% { transform: translate3d(calc(var(--x) + var(--drift)), 520px, 0) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const colors = ['#FF6D3F', '#00B894', '#E94560', '#A78BFA', '#FFFFFF'];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(i => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const dur = 1.4 + Math.random() * 0.8;
        const drift = (Math.random() * 120 - 60).toFixed(0) + 'px';
        const color = colors[i % colors.length]!;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: 0,
              width: 10,
              height: 10,
              borderRadius: 2,
              background: color,
              opacity: 0,
              animation: `confetti-fall ${dur}s ease-out ${delay}s forwards`,
              // CSS vars used inside keyframes
              ...( { ['--x' as any]: '0px', ['--drift' as any]: drift } as any ),
              boxShadow: `0 10px 40px ${color}22`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function ProSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-8" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="relative w-full max-w-[720px] rounded-2xl p-8 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}
      >
        <Confetti />
        <p style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', letterSpacing: '0.08em', fontSize: 12 }}>
          PRO ACTIVATED
        </p>
        <h1 className="mt-3" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 44, letterSpacing: '-0.02em' }}>
          You&apos;re now Pro!
        </h1>
        <p className="mt-3" style={{ color: 'var(--muted)' }}>
          Unlimited generations and full commercial rights unlocked.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/" className="btn-primary btn-sm" style={{ textDecoration: 'none', background: 'var(--accent)' }}>
            Back to pulp
          </Link>
          <Link href="/pricing" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            View pricing
          </Link>
        </div>
      </div>
    </div>
  );
}

