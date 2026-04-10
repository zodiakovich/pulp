import Link from 'next/link';

export default function NotFound() {
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
        {/* Subtle animated grain (SVG turbulence + seed drift + opacity pulse) */}
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
              <filter id="notFoundNoise" x="-10%" y="-10%" width="120%" height="120%">
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
            <rect width="100%" height="100%" fill="#F0F0FF" filter="url(#notFoundNoise)" opacity="0.5" />
          </svg>
        </div>

        <div className="relative z-10 flex max-w-[520px] flex-col items-center text-center">
          <h1
            className="text-gradient font-extrabold leading-none"
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 'clamp(96px, 22vw, 200px)',
              letterSpacing: '-0.04em',
            }}
          >
            404
          </h1>
          <p
            className="mt-8 text-lg"
            style={{ fontFamily: 'DM Sans, sans-serif', color: 'rgba(240,240,255,0.72)' }}
          >
            This page doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="btn-primary mt-10"
            style={{ textDecoration: 'none' }}
          >
            Go back home
          </Link>

          <div className="mt-8 flex flex-col items-center gap-3">
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.4)', letterSpacing: '0.06em' }}>
              OR TRY ONE OF THESE
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <a href="/explore" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#FF6D3F', textDecoration: 'none' }}>→ Explore generations</a>
              <a href="/blog" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#FF6D3F', textDecoration: 'none' }}>→ Read the blog</a>
              <a href="/pricing" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#FF6D3F', textDecoration: 'none' }}>→ See pricing</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
