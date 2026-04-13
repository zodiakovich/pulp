'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg)' }}>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-micro)', letterSpacing: '0.1em', marginBottom: 16 }}>
        ERROR
      </p>
      <h1 className="font-extrabold mb-4" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--text)' }}>
        Something went wrong.
      </h1>
      <p className="mb-8" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)', maxWidth: 400 }}>
        The app hit an error. Refresh the page or go back home.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="btn-primary"
          style={{ height: 44, padding: '0 20px', fontSize: 13 }}
        >
          Retry
        </button>
        <Link href="/" className="btn-secondary" style={{ height: 44, padding: '0 20px', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          Go home
        </Link>
      </div>
    </div>
  );
}
