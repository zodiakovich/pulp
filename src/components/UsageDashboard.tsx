'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type FeatureType = 'build' | 'midi' | 'audio';
type PlanType = 'free' | 'pro' | 'studio';

type WindowCheckResult = {
  allowed: boolean;
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
  blocked_by: 'daily' | 'monthly' | null;
};

type UsageResponse = Record<FeatureType, WindowCheckResult> & {
  plan_type: PlanType;
};

const FEATURES: Array<{ key: FeatureType; name: string; color: string }> = [
  { key: 'build', name: 'Build a Track', color: '#FF6D3F' },
  { key: 'midi', name: 'MIDI Generator', color: '#00B894' },
  { key: 'audio', name: 'Audio to MIDI', color: '#E94560' },
];

function barColor(percent: number) {
  if (percent >= 86) return '#E94560';
  if (percent >= 61) return '#F59E0B';
  return '#FF6D3F';
}

function UsageRow({
  label,
  used,
  limit,
  blocked,
}: {
  label: 'Daily' | 'Monthly';
  used: number;
  limit: number;
  blocked: boolean;
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = barColor(percent);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
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
          {used} / {limit}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: `${color}22`, overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 240ms ease' }} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          style={{
            border: '1px solid #1A1A2E',
            background: '#111118',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div className="mb-5 h-5 w-40 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="mb-4 h-8 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="h-8 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
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
        {FEATURES.map((feature) => {
          const data = usage[feature.key];
          return (
            <div
              key={feature.key}
              style={{
                border: '1px solid #1A1A2E',
                background: '#111118',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div className="mb-5 flex items-center gap-3">
                <div
                  aria-hidden
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: feature.color,
                    boxShadow: `0 0 18px ${feature.color}55`,
                    flex: '0 0 auto',
                  }}
                />
                <h3 style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
                  {feature.name}
                </h3>
              </div>
              <div className="space-y-4">
                <UsageRow label="Daily" used={data.daily_used} limit={data.daily_limit} blocked={data.blocked_by === 'daily'} />
                <UsageRow label="Monthly" used={data.monthly_used} limit={data.monthly_limit} blocked={data.blocked_by === 'monthly'} />
              </div>
            </div>
          );
        })}
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
