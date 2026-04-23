'use client';

import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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

function toneStyles(tone: ToastTone): { accent: string } {
  switch (tone) {
    case 'success':
      return { accent: '#00B894' };
    case 'danger':
      return { accent: '#FF6D3F' };
    case 'info':
    default:
      return { accent: '#FF6D3F' };
  }
}

function ToneIcon({ tone }: { tone: ToastTone }) {
  const style: React.CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
  };

  if (tone === 'success') {
    return (
      <span aria-hidden style={{ ...style, background: 'rgba(0,184,148,0.18)', color: '#00B894', border: '1px solid rgba(0,184,148,0.35)' }}>
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (tone === 'danger') {
    return (
      <span aria-hidden style={{ ...style, background: 'rgba(255,109,63,0.18)', color: '#FF6D3F', border: '1px solid rgba(255,109,63,0.35)' }}>
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M2 2L7 7M7 2L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden style={{ ...style, background: 'rgba(255,109,63,0.18)', color: '#FF6D3F', border: '1px solid rgba(255,109,63,0.35)' }}>
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
        <path d="M4.5 2V2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4.5 6V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function uid(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `t_${Math.random().toString(16).slice(2)}_${Date.now()}`);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<ToastId, number>>(new Map());
  const TTL_MS = 3000;

  const dismiss = useCallback((id: ToastId) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, visible: false } : t)));
    const t = timersRef.current.get(id);
    if (typeof t === 'number') window.clearTimeout(t);
    timersRef.current.delete(id);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 150);
  }, []);

  const push = useCallback((title: string, tone: ToastTone = 'info') => {
    const id = uid();
    const item: ToastItem = { id, title, tone, createdAt: Date.now(), visible: false };
    setToasts(prev => [item, ...prev].slice(0, 5));

    window.setTimeout(() => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, visible: true } : t)));
    }, 10);

    const timer = window.setTimeout(() => dismiss(id), TTL_MS);
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

      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="fixed bottom-6 right-6 z-[120] flex flex-col-reverse gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map(t => {
            const s = toneStyles(t.tone);
            const createdAgo = Math.max(0, Date.now() - t.createdAt);
            const remaining = Math.max(0, TTL_MS - createdAgo);
            return (
              <motion.div
                key={t.id}
                role="status"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: 12,
                  scale: 0.97,
                  transition: { duration: 0.2, ease: [0.55, 0, 1, 0.45] },
                }}
                transition={{ type: 'tween', duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                className="glass-elevated overflow-hidden rounded-xl"
                style={{ width: 320 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 12px',
                    background: 'transparent',
                  }}
                >
                  <ToneIcon tone={t.tone} />
                  <span style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 13, color: 'var(--text)', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
                    {t.title}
                  </span>
                  <button
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss toast"
                    style={{
                      marginLeft: 4,
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: `1px solid var(--border)`,
                      background: 'transparent',
                      color: 'var(--foreground-muted)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'opacity 140ms var(--ease-ui)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
                    onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    ×
                  </button>
                </div>

                <motion.div
                  aria-hidden
                  initial={false}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: remaining / 1000, ease: 'linear' }}
                  style={{
                    height: 2,
                    background: s.accent,
                    opacity: 0.55,
                    transformOrigin: 'left',
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
