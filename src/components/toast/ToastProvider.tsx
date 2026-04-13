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

      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map(t => {
            const s = toneStyles(t.tone);
            return (
              <motion.div
                key={t.id}
                role="status"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
                style={{
                  width: 320,
                  background: 'rgba(17,17,24,0.78)',
                  borderRadius: 12,
                  border: `1px solid rgba(255,255,255,0.06)`,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 12px',
                    background: s.bg,
                    borderBottom: `1px solid rgba(255,255,255,0.06)`,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s.accent, boxShadow: `0 0 0 4px ${s.accent}22` }} />
                  <span style={{ fontFamily: 'var(--font-inter), Inter, system-ui, Segoe UI, sans-serif', fontSize: 13, color: '#F0F0FF' }}>
                    {t.title}
                  </span>
                  <button
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss toast"
                    style={{
                      marginLeft: 'auto',
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: `1px solid ${s.border}`,
                      background: 'transparent',
                      color: s.accent,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'transform 140ms ease-out, background 180ms ease-out',
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

