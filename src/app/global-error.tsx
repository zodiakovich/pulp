'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0A0A0B',
            color: '#FFFFFF',
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            padding: '32px',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
            We've been notified and are looking into it. Refreshing usually fixes the issue.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              background: '#FF6D3F',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              cursor: 'pointer',
            }}
          >
            Refresh the page
          </button>
        </div>
      </body>
    </html>
  );
}
