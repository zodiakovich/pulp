'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS: { href: string; label: string }[] = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/getting-started', label: 'Getting Started' },
  { href: '/docs/daw-setup', label: 'DAW Setup' },
  { href: '/docs/piano-roll', label: 'Piano Roll' },
  { href: '/docs/mix-engine', label: 'Mix Engine' },
];

function linkStyles(active: boolean) {
  return {
    fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--text)' : 'var(--muted)',
    textDecoration: 'none',
    display: 'block',
    padding: '10px 12px',
    borderRadius: 8,
    background: active ? 'rgba(255,109,63,0.10)' : 'transparent',
    border: active ? '1px solid rgba(255,109,63,0.22)' : '1px solid transparent',
  } as const;
}

export function DocsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const NavList = (
    <ul className="flex flex-col gap-1">
      {LINKS.map((l) => {
        const active =
          l.href === '/docs' ? pathname === '/docs' : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <li key={l.href}>
            <Link href={l.href} style={linkStyles(active)} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="w-full shrink-0 md:w-[220px] md:max-w-[220px]">
      <div
        className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:hidden"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.08em', color: 'var(--muted)' }}>
          DOCUMENTATION
        </span>
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity duration-200 hover:opacity-90"
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
          }}
          aria-expanded={open}
          aria-controls="docs-nav-panel"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Close documentation menu"
          className="fixed inset-0 z-20 bg-black/55 md:hidden"
          style={{ top: 0 }}
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="docs-nav-panel"
        className={[
          'z-40 md:sticky md:top-24 md:block md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:border-0 md:py-8 md:pr-4',
          open
            ? 'fixed left-0 top-20 max-h-[calc(100dvh-5rem)] w-[min(100%,280px)] overflow-y-auto border-r px-4 py-6 md:relative md:top-0 md:max-h-none md:w-full'
            : 'hidden md:block',
        ].join(' ')}
        style={{
          background: 'var(--bg)',
          borderColor: 'var(--border)',
        }}
      >
        <p
          className="mb-4 hidden md:block"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--muted)',
          }}
        >
          DOCUMENTATION
        </p>
        {NavList}
        <Link
          href="/"
          className="mt-8 inline-block text-sm transition-opacity duration-200 hover:opacity-90 md:mt-10"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', textDecoration: 'none' }}
          onClick={() => setOpen(false)}
        >
          ← Back to pulp
        </Link>
      </aside>
    </div>
  );
}
