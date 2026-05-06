'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type PlanType = 'free' | 'pro' | 'studio';

type UsageResponse = {
  daily_pct: number;
  monthly_pct: number;
  plan_type: PlanType;
};

function barColor(percent: number) {
  if (percent >= 86) return '#E94560';
  if (percent >= 61) return '#F59E0B';
  return '#FF6D3F';
}

function pctLabel(value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  if (clamped === 0) return '0%';
  if (clamped < 1) return `${clamped.toFixed(1)}%`;
  return `${Math.round(clamped)}%`;
}

function UsageBar({
  label,
  percent,
}: {
  label: 'Today' | 'This month';
  percent: number;
}) {
  const color = barColor(percent);
  const width = Math.max(0, Math.min(100, percent));

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        background: 'var(--surface-strong)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
          {pctLabel(percent)}
        </span>
      </div>

      <div style={{ height: 10, borderRadius: 999, background: `${color}22`, overflow: 'hidden' }}>
        <div
          style={{
            width: `${width}%`,
            minWidth: width > 0 ? 3 : 0,
            height: '100%',
            background: color,
            borderRadius: 999,
            transition: 'width 240ms ease',
          }}
        />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((item) => (
        <div
          key={item}
          style={{
            border: '1px solid var(--border)',
            background: 'var(--surface-strong)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div className="mb-4 h-5 w-32 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="h-10 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
      ))}
    </div>
  );
}

export function UsageDashboard() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/usage', { cache: 'no-store' });
        if (!res.ok) throw new Error('usage_unavailable');
        const data = await res.json() as UsageResponse;
        if (!cancelled) setUsage(data);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton />;
  if (failed || !usage) return null;

  return (
    <div>
      <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        Daily limits reset every 24h {'\u00b7'} Monthly limits reset every 30 days
      </p>

      <div className="space-y-3">
        <UsageBar label="Today" percent={usage.daily_pct} />
        <UsageBar label="This month" percent={usage.monthly_pct} />
      </div>

      {usage.plan_type === 'free' && (
        <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 14, color: 'var(--muted)', marginTop: 16 }}>
          <Link href="/pricing" style={{ color: '#FF6D3F', textDecoration: 'none', fontWeight: 700 }}>
            Upgrade to Pro for higher limits
          </Link>
        </p>
      )}
    </div>
  );
}
