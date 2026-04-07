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
    <>
      <style>{`
        @keyframes not-found-noise-opacity {
          0%, 100% { opacity: 0.035; }
          50% { opacity: 0.065; }
        }
        .not-found-noise-layer {
          animation: not-found-noise-opacity 8s ease-in-out infinite;
        }
      `}</style>
      <div
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-8"
        style={{ background: '#09090B' }}
      >
        <div
          className="not-found-noise-layer pointer-events-none absolute inset-0 z-0 mix-blend-overlay"
          aria-hidden
        >
          <svg
            className="h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="errorNoise" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.78"
                  numOctaves="4"
                  stitchTiles="stitch"
                  seed="2"
                  result="grain"
                >
                  <animate
                    attributeName="seed"
                    dur="14s"
                    values="2;22;9;31;17;2"
                    repeatCount="indefinite"
                  />
                </feTurbulence>
                <feColorMatrix type="saturate" values="0" in="grain" result="mono" />
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="#F0F0FF" filter="url(#errorNoise)" opacity="0.5" />
          </svg>
        </div>

        <div className="relative z-10 flex max-w-[520px] flex-col items-center text-center">
          <h1
            className="font-extrabold leading-tight"
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 'clamp(32px, 6vw, 56px)',
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
            }}
          >
            Something went wrong.
          </h1>
          <p
            className="mt-6 text-base leading-relaxed"
            style={{ fontFamily: 'DM Sans, sans-serif', color: '#8A8A9A' }}
          >
            {error.message?.trim()
              ? error.message
              : 'An unexpected error occurred. You can try again or return to the homepage.'}
          </p>
          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <button type="button" className="btn-primary" onClick={() => reset()}>
              Try again
            </button>
            <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Go home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
