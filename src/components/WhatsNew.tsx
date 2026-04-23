'use client';

import { useEffect, useState } from 'react';
import { CHANGELOG } from '@/lib/changelog';

function seenKey(version: string) {
  return `pulp_whats_new_seen_v${version}`;
}

export function WhatsNew() {
  const latest = CHANGELOG[0];
  const [open, setOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(true);

  useEffect(() => {
    if (!latest) return;
    const alreadySeen = localStorage.getItem(seenKey(latest.version)) === '1';
    setHasSeen(alreadySeen);
    if (!alreadySeen) setOpen(true);
  }, [latest?.version]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function markSeen() {
    if (!latest) return;
    try { localStorage.setItem(seenKey(latest.version), '1'); } catch { /* ignore */ }
    setHasSeen(true);
  }

  function handleClose() {
    markSeen();
    setOpen(false);
  }

  function handleStartCreating() {
    handleClose();
    window.setTimeout(() => {
      document.getElementById('main-prompt')?.focus();
    }, 50);
  }

  if (!latest) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="What's new"
        className="h-9 px-3 rounded-lg flex items-center gap-2 transition-all duration-200 ease-ui text-sm"
        style={{ background: 'rgba(255,109,63,0.1)', color: 'var(--accent)', position: 'relative', zIndex: 45 }}
      >
        What&apos;s new
        {!hasSeen && (
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--accent)',
              position: 'absolute',
              top: 6,
              right: 6,
            }}
          />
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
            onClick={handleClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="What's new"
            className="fixed rounded-2xl"
            style={{
              zIndex: 9999,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(560px, calc(100vw - 32px))',
              background: '#0A0A0B',
              border: '1px solid rgba(255,255,255,0.08)',
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto',
              padding: '32px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4" style={{ marginBottom: 24 }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    color: 'var(--accent)',
                    border: '1px solid rgba(255,109,63,0.35)',
                    background: 'rgba(255,109,63,0.1)',
                    padding: '3px 9px',
                    borderRadius: 20,
                    marginBottom: 10,
                    letterSpacing: '0.04em',
                  }}
                >
                  v{latest.version}
                </span>
                <h2
                  style={{
                    fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                    fontWeight: 700,
                    fontSize: 24,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    color: 'var(--text)',
                    margin: 0,
                  }}
                >
                  {latest.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'var(--muted)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {latest.changes.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'rgba(255,109,63,0.12)',
                      border: '1px solid rgba(255,109,63,0.30)',
                      color: 'var(--accent)',
                      fontSize: 9,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    ✦
                  </span>
                  <span
                    style={{
                      fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                      fontSize: 15,
                      color: 'var(--text)',
                      lineHeight: 1.55,
                    }}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleStartCreating}
                className="btn-primary"
              >
                Start creating →
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
