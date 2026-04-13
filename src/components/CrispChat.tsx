'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

export default function CrispChat() {
  useEffect(() => {
    const load = () => {
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = 'a52220fb-f0ea-4a02-b3a4-637ea180f899';
      window.$crisp.push(['do', 'chat:hide']);
      const s = document.createElement('script');
      s.src = 'https://client.crisp.chat/l.js';
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(load, { timeout: 5000 });
    } else {
      setTimeout(load, 3000);
    }
  }, []);
  return null;
}

