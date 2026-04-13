'use client';

import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pulp_install_dismissed_until';
const DAYS_7 = 7 * 24 * 60 * 60 * 1000;

function nowMs() {
  return Date.now();
}

export function InstallPromptBanner() {
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  const dismissedUntil = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (dismissedUntil && dismissedUntil > nowMs()) return;

    const onBeforeInstallPrompt = (e: Event) => {
      const ev = e as BeforeInstallPromptEvent;
      // Required to show a custom UI.
      e.preventDefault?.();
      setBipEvent(ev);
      setHidden(false);
    };

    const onAppInstalled = () => {
      setHidden(true);
      setBipEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [dismissedUntil]);

  if (hidden || !bipEvent) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4"
      style={{ paddingBottom: `max(16px, env(safe-area-inset-bottom))` }}
    >
      <div
        className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3 rounded-2xl px-4 py-3 glass-elevated"
        style={{
          background: 'rgba(17,17,24,0.78)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="min-w-0">
          <div
            className="text-sm"
            style={{
              fontFamily: 'DM Sans, sans-serif',
              color: 'rgba(240,240,255,0.92)',
              lineHeight: 1.35,
            }}
          >
            Use pulp as a desktop app
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg px-3 text-sm font-semibold transition-[transform,opacity,background] duration-200 ease-ui active:scale-[0.98]"
            style={{
              minHeight: 44,
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(240,240,255,0.88)',
            }}
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, String(nowMs() + DAYS_7));
              setHidden(true);
            }}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            style={{ minHeight: 44 }}
            onClick={async () => {
              try {
                await bipEvent.prompt();
                await bipEvent.userChoice.catch(() => null);
              } finally {
                setHidden(true);
                setBipEvent(null);
              }
            }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

