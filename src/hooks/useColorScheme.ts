'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange: () => void) {
  const el = document.documentElement;
  const mo = new MutationObserver(onStoreChange);
  mo.observe(el, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
}

function getSnapshot(): 'dark' | 'light' {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

function getServerSnapshot(): 'dark' {
  return 'dark';
}

/** Tracks `html.light` vs `html.dark` (set by inline head script + Navbar). */
export function useColorScheme(): 'dark' | 'light' {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
