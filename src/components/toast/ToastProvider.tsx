'use client';

import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ToastTone = 'success' | 'info' | 'danger';

export type ToastId = string;

export type ToastItem = {
  id: ToastId;
  title: string;
  tone: ToastTone;
  createdAt: number;
  visible: boolean;
};

export type ToastAPI = {
  toast: (title: string, tone?: ToastTone) => void;
  generationComplete: () => void;
  copiedToClipboard: () => void;
  downloadStarted: () => void;
  creditLimitReached: () => void;
  collabSessionStarted: () => void;
  dismiss: (id: ToastId) => void;
};

export const ToastContext = createContext<ToastAPI | null>(null);

function toneStyles(tone: ToastTone): { accent: string; bg: string; border: string } {
  switch (tone) {
    case 'success':
      return { accent: '#00B894', bg: 'rgba(0,184,148,0.10)', border: 'rgba(0,184,148,0.30)' };
    case 'danger':
      return { accent: '#E94560', bg: 'rgba(233,69,96,0.10)', border: 'rgba(233,69,96,0.28)' };
    case 'info':
    default:
      return { accent: '#FF6D3F', bg: 'rgba(255,109,63,0.10)', border: 'rgba(255,109,63,0.28)' };
  }
}

function uid(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `t_${Math.random().toString(16).slice(2)}_${Date.now()}`);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<ToastId, number>>(new Map());

  const dismiss = useCallback((id: ToastId) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, visible: false } : t)));
    const t = timersRef.current.get(id);
    if (typeof t === 'number') window.clearTimeout(t);
    timersRef.current.delete(id);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 220);
  }, []);

  const push = useCallback((title: string, tone: ToastTone = 'info') => {
    const id = uid();
    const item: ToastItem = { id, title, tone, createdAt: Date.now(), visible: false };
    setToasts(prev => [item, ...prev].slice(0, 5));

    // next tick to allow CSS transition
    window.setTimeout(() => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, visible: true } : t)));
    }, 10);

    const timer = window.setTimeout(() => dismiss(id), 3000);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  const api = useMemo<ToastAPI>(() => ({
    toast: (title: string, tone: ToastTone = 'info') => push(title, tone),
    generationComplete: () => push('Generation complete', 'success'),
    copiedToClipboard: () => push('Copied to clipboard', 'info'),
    downloadStarted: () => push('Download started', 'info'),
    creditLimitReached: () => push('Credit limit reached', 'danger'),
    collabSessionStarted: () => push('Collab session started', 'success'),
    dismiss,
  }), [dismiss, push]);

  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) window.clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Minimal CSS-only motion (no external libs) */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .pulp-toast { transition: none !important; }
        }
      `}</style>

      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2"
      >
        {toasts.map(t => {
          const s = toneStyles(t.tone);
          return (
            <div
              key={t.id}
              className="pulp-toast"
              role="status"
              style={{
                width: 320,
                background: '#111118',
                borderRadius: 14,
                border: `1px solid #1A1A2E`,
                boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                overflow: 'hidden',
                transform: t.visible ? 'translateX(0px)' : 'translateX(18px)',
                opacity: t.visible ? 1 : 0,
                transition: 'transform 200ms ease-out, opacity 200ms ease-out',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 12px',
                  background: s.bg,
                  borderBottom: `1px solid rgba(26,26,46,0.7)`,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.accent, boxShadow: `0 0 0 4px ${s.accent}22` }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#F0F0FF' }}>
                  {t.title}
                </span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss toast"
                  style={{
                    marginLeft: 'auto',
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    border: `1px solid ${s.border}`,
                    background: 'transparent',
                    color: s.accent,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

