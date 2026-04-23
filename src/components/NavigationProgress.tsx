'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevRouteRef = useRef('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const initialMount = useRef(true);

  function clearTimers() {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  }

  // Complete bar when pathname changes
  useEffect(() => {
    const route = `${pathname}${searchParams.toString()}`;
    if (initialMount.current) {
      initialMount.current = false;
      prevRouteRef.current = route;
      return;
    }
    if (prevRouteRef.current === route) return;
    prevRouteRef.current = route;
    clearTimers();
    setProgress(100);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 500);
    timersRef.current.push(t);
  }, [pathname, searchParams]);

  // Start bar on internal link clicks
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/') || href.startsWith('//')) return;
      const [destPath] = href.split('?');
      if (destPath === pathname) return;
      clearTimers();
      setVisible(true);
      setProgress(18);
      const t1 = setTimeout(() => setProgress(45), 250);
      const t2 = setTimeout(() => setProgress(70), 700);
      const t3 = setTimeout(() => setProgress(85), 1400);
      timersRef.current.push(t1, t2, t3);
    }
    document.addEventListener('click', onLinkClick);
    return () => {
      document.removeEventListener('click', onLinkClick);
      clearTimers();
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 2,
        zIndex: 10000,
        pointerEvents: 'none',
        background: '#FF6D3F',
        boxShadow: '0 0 8px rgba(255,109,63,0.55)',
        width: `${progress}%`,
        opacity: progress >= 100 ? 0 : 1,
        transition:
          progress >= 100
            ? 'width 0.25s ease, opacity 0.3s 0.2s'
            : 'width 0.5s ease',
      }}
    />
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
