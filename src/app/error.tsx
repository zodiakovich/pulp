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
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.5)', letterSpacing: '0.1em', marginBottom: 16 }}>
        ERROR
      </p>
      <h1 className="font-extrabold mb-4" style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, color: '#E94560' }}>
        Something broke.
      </h1>
      <p className="mb-8" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)', maxWidth: 400 }}>
        An unexpected error occurred. Your generations are safe — try refreshing or go back home.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="btn-primary"
          style={{ height: 44, padding: '0 20px', fontSize: 13 }}
        >
          Try again
        </button>
        <Link href="/" className="btn-secondary" style={{ height: 44, padding: '0 20px', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          Go home
        </Link>
      </div>
    </div>
  );
}
