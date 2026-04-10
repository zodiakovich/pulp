export default function Loading() {
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
