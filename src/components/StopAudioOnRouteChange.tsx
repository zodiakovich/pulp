'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { stopAllAppAudio } from '@/lib/audio-control';

export function StopAudioOnRouteChange() {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevPathnameRef.current !== null && prevPathnameRef.current !== pathname) {
      stopAllAppAudio();
    }
    prevPathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const stop = () => stopAllAppAudio();
    window.addEventListener('pagehide', stop);
    return () => window.removeEventListener('pagehide', stop);
  }, []);

  return null;
}
