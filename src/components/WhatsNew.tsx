'use client';

import { useEffect, useMemo, useState } from 'react';
import { CHANGELOG } from '@/lib/changelog';

const STORAGE_KEY = 'pulp_seen_version';

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function WhatsNew() {
  const latest = CHANGELOG[0]?.version ?? '0.0';
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(STORAGE_KEY));
    } catch {
      setSeen(null);
    }
  }, []);

  const hasNew = useMemo(() => {
    if (!seen) return true;
    return seen !== latest;
  }, [seen, latest]);

  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, latest);
    } catch {
      // ignore
    }
    setSeen(latest);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 px-3 rounded-lg flex items-center gap-2 transition-all"
        style={{
          border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
          background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
          color: 'var(--text)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          position: 'relative',
        }}
        title="What's new"
        aria-label="What's new"
      >
        What’s new
        {hasNew && (
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--hot)',
              position: 'absolute',
              top: 6,
              right: 6,
              boxShadow: '0 0 0 4px rgba(233,69,96,0.16)',
            }}
          />
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[71] w-[min(980px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
            role="dialog"
            aria-modal="true"
            aria-label="What's new"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 32px 100px rgba(0,0,0,0.65)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)' }}>
                  What’s new
                </div>
                <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                  Latest: <span style={{ color: 'var(--accent)' }}>v{latest}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 px-3 rounded-lg transition-all"
                style={{
                  border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                  color: 'var(--text)',
                  fontFamily: 'JetBrains Mono, monospace',
                  background: 'transparent',
                  fontSize: 12,
                }}
              >
                Esc
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {CHANGELOG.map((e) => (
                <div
                  key={e.version}
                  className="rounded-2xl p-5"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 12,
                        color: 'var(--purple)',
                        border: '1px solid rgba(167,139,250,0.35)',
                        background: 'rgba(167,139,250,0.10)',
                        padding: '4px 8px',
                        borderRadius: 8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      v{e.version}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                      {formatDate(e.date)}
                    </span>
                  </div>
                  <div className="mt-3" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
                    {e.title}
                  </div>
                  <div className="mt-2" style={{ color: 'var(--muted)' }}>
                    {e.description}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary btn-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  markSeen();
                  setOpen(false);
                }}
                className="btn-primary btn-sm"
                style={{ background: 'var(--accent)' }}
              >
                Got it
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

