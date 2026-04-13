'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const run = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch {
        // ignore
      }
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => void run(), { timeout: 8000 });
    } else {
      setTimeout(() => void run(), 4000);
    }
  }, []);

  return null;
}

