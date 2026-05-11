import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-8"
      style={{ background: 'var(--bg)' }}
    >
      {/* Subtle grid depth */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.025,
          backgroundImage:
            'linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          pointerEvents: 'none',
        }}
      />

      {/* Large 404 watermark */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -52%)',
          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(150px, 26vw, 220px)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: 'color-mix(in srgb, var(--text) 14%, transparent)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        404
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <div
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 400,
            fontSize: 16,
            color: 'var(--text)',
          }}
        >
          This page doesn&apos;t exist
        </div>
        <Link
          href="/"
          className="footer-link"
          style={{
            marginTop: 14,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            color: 'var(--muted)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          Back to pulp
        </Link>
      </div>
    </div>
  );
}
