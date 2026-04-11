'use client';

import { useState } from 'react';

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="btn-primary w-full justify-center rounded-xl py-4 px-8 text-base font-semibold shadow-[0_0_20px_rgba(255,109,63,0.3)] transition-all min-h-[56px]"
        disabled={loading}
        onClick={async () => {
          if (loading) return;
          setError(null);
          setLoading(true);
          try {
            const res = await fetch('/api/stripe/checkout', { method: 'POST' });
            if (res.status === 401) {
              window.location.href = '/sign-in';
              return;
            }
            const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
            if (!res.ok) throw new Error(data.error || `checkout failed (${res.status})`);
            if (!data.url) throw new Error('missing session url');
            window.location.href = data.url;
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Checkout failed');
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? 'Redirecting…' : 'Upgrade to Pro'}
      </button>
      {error && (
        <div className="mt-3 text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(233,69,96,0.9)' }}>
          {error}
        </div>
      )}
    </div>
  );
}

