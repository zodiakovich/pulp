'use client';

import { useState } from 'react';

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button
      className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
      style={{
        background: '#FF6D3F',
        border: '1px solid rgba(255,109,63,0.45)',
        color: '#FFFFFF',
      }}
      disabled={loading}
      onClick={async () => {
        if (loading) return;
        setLoading(true);
        try {
          const res = await fetch('/api/stripe/checkout', { method: 'POST' });
          if (res.status === 401) {
            window.location.href = '/sign-in';
            return;
          }
          if (!res.ok) throw new Error('checkout failed');
          const data = (await res.json()) as { url?: string };
          if (!data.url) throw new Error('missing session url');
          window.location.href = data.url;
        } catch {
          // noop (pricing page is marketing; avoid noisy errors)
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? 'Redirecting…' : 'Upgrade to Pro'}
    </button>
  );
}

