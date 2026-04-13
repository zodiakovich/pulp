/** Shared doc body styles: DM Sans, readable line length feel inside parent max-width. */
export function DocLead({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-10"
      style={{
        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        fontSize: 17,
        lineHeight: 1.7,
        color: 'var(--muted)',
      }}
    >
      {children}
    </p>
  );
}

export function DocH2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-4 mt-12 first:mt-0"
      style={{
        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: '-0.02em',
        lineHeight: 1.25,
        color: 'var(--text)',
      }}
    >
      {children}
    </h2>
  );
}

export function DocH3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mb-3 mt-8"
      style={{
        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        fontWeight: 600,
        fontSize: 17,
        letterSpacing: '-0.01em',
        color: 'var(--text)',
      }}
    >
      {children}
    </h3>
  );
}

export function DocP({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-4"
      style={{
        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        fontSize: 16,
        lineHeight: 1.75,
        color: 'var(--muted)',
      }}
    >
      {children}
    </p>
  );
}

export function DocOl({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mb-6 list-decimal space-y-3 pl-5" style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.75 }}>
      {children}
    </ol>
  );
}

export function DocUl({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mb-6 list-disc space-y-3 pl-5" style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.75 }}>
      {children}
    </ul>
  );
}

export function DocCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 13,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--border)',
        padding: '2px 6px',
        borderRadius: 6,
        color: 'rgba(240,240,255,0.88)',
      }}
    >
      {children}
    </code>
  );
}
