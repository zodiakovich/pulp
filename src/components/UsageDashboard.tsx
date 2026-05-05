'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type PlanType = 'free' | 'pro' | 'studio';

type UsageResponse = {
  daily_cost: number;
  daily_limit: number;
  monthly_cost: number;
  monthly_limit: number;
  daily_pct: number;
  monthly_pct: number;
  plan_type: PlanType;
  blocked_by: 'daily' | 'monthly' | null;
  allowed: boolean;
};

function barColor(percent: number) {
  if (percent >= 86) return '#E94560';
  if (percent >= 61) return '#F59E0B';
  return '#FF6D3F';
}

function pctLabel(value: number) {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

function UsageBar({
  label,
  percent,
  blocked,
}: {
  label: 'Today' | 'This month';
  percent: number;
  blocked: boolean;
}) {
  const color = barColor(percent);
  return (
    <div
      style={{
        border: '1px solid #1A1A2E',
        background: '#111118',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
            {label}
          </span>
          {blocked && (
            <span
              style={{
                border: '1px solid rgba(233,69,96,0.35)',
                background: 'rgba(233,69,96,0.12)',
                color: '#E94560',
                borderRadius: 999,
                padding: '2px 7px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                lineHeight: 1.4,
              }}
            >
              Limit reached
            </span>
          )}
        </div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
          {pctLabel(percent)}
        </span>
      </div>

      <div style={{ height: 10, borderRadius: 999, background: `${color}22`, overflow: 'hidden' }}>
        <div
          style={{
            width: pctLabel(percent),
            height: '100%',
            background: color,
            borderRadius: 999,
            transition: 'width 240ms ease',
          }}
        />
      </div>

      <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13, color: '#8A8A9A', marginTop: 10 }}>
        {pctLabel(percent)} of {label === 'Today' ? 'daily' : 'monthly'} limit used
      </p>
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
            border: '1px solid #1A1A2E',
            background: '#111118',
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
      <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13, color: '#8A8A9A', marginBottom: 14 }}>
        Daily limits reset every 24h · Monthly limits reset every 30 days
      </p>

      <div className="space-y-3">
        <UsageBar label="Today" percent={usage.daily_pct} blocked={usage.blocked_by === 'daily'} />
        <UsageBar label="This month" percent={usage.monthly_pct} blocked={usage.blocked_by === 'monthly'} />
      </div>

      {usage.plan_type === 'free' && (
        <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 14, color: '#8A8A9A', marginTop: 16 }}>
          <Link href="/pricing" style={{ color: '#FF6D3F', textDecoration: 'none', fontWeight: 700 }}>
            Upgrade to Pro for higher limits →
          </Link>
        </p>
      )}
    </div>
  );
}
