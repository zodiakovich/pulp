'use client';

import { useEffect, useState } from 'react';

const LOADING_TIMEOUT_MS = 10000;

export default function Loading() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
        <div
          className="w-full max-w-[460px]"
          style={{
            border: '1px solid var(--border)',
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            borderRadius: 18,
            padding: 28,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              color: 'var(--text-micro)',
              marginBottom: 10,
            }}
          >
            STILL CONNECTING
          </div>
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Pulp is taking longer than usual to load.
          </h1>
          <p
            style={{
              marginTop: 12,
              marginBottom: 20,
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontSize: 15,
              lineHeight: 1.65,
              color: 'var(--muted)',
            }}
          >
            The app may still be waiting on Clerk, a network request, or a slow first bundle. Reloading usually brings it back immediately.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.location.reload()}
            style={{ height: 44, padding: '0 18px' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
      <div
        style={{
          width: 40,
          height: 40,
          border: '2px solid rgba(255,109,63,0.2)',
          borderTopColor: '#FF6D3F',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.5)', letterSpacing: '0.08em' }}>
        LOADING
      </p>
    </div>
  );
}
