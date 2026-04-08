'use client';

import Link from 'next/link';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';

export function Navbar({
  active,
  onHistory,
  historyCount,
}: {
  active?: 'create' | 'explore' | 'build' | 'pricing' | 'profile' | 'blog';
  onHistory?: () => void;
  historyCount?: number;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  const linkStyle = (isActive: boolean) => ({
    textDecoration: 'none',
    color: isActive ? 'var(--text)' : 'var(--muted)',
  });

  const loggedOutLinks = (
    <>
      <Link href="/" className="transition-colors hover:text-white" style={linkStyle(active === 'create')}>
        Create
      </Link>
      <Link href="/explore" className="transition-colors hover:text-white" style={linkStyle(active === 'explore')}>
        Explore
      </Link>
      <Link href="/pricing" className="transition-colors hover:text-white" style={linkStyle(active === 'pricing')}>
        Pricing
      </Link>
    </>
  );

  const loggedInLinks = (
    <>
      <Link href="/" className="transition-colors hover:text-white" style={linkStyle(active === 'create')}>
        Create
      </Link>
      <Link href="/explore" className="transition-colors hover:text-white" style={linkStyle(active === 'explore')}>
        Explore
      </Link>
      <Link href="/build" className="transition-colors hover:text-white" style={linkStyle(active === 'build')}>
        Build
      </Link>

      {onHistory ? (
        <button
          type="button"
          onClick={onHistory}
          className="transition-colors hover:text-white flex items-center gap-2"
          style={{ color: 'var(--muted)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          History
          {(historyCount ?? 0) > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,109,63,0.15)', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}
            >
              {historyCount}
            </span>
          )}
        </button>
      ) : (
        <Link href="/?history=1" className="transition-colors hover:text-white" style={linkStyle(false)}>
          History
        </Link>
      )}

      <Link href="/profile" className="transition-colors hover:text-white" style={linkStyle(active === 'profile')}>
        Profile
      </Link>
      <Link href="/pricing" className="transition-colors hover:text-white" style={linkStyle(active === 'pricing')}>
        Pricing
      </Link>
    </>
  );

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-8 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-gradient font-extrabold text-xl"
          style={{ fontFamily: 'Syne, sans-serif', textDecoration: 'none' }}
        >
          pulp
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: 'var(--muted)' }}>
          {isLoaded && isSignedIn ? loggedInLinks : loggedOutLinks}
        </div>

        {isLoaded && (
          isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button
                className="text-sm h-9 px-4 rounded-lg transition-all"
                style={{
                  border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                  color: 'var(--text)',
                  background: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 6%, transparent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Sign in
              </button>
            </SignInButton>
          )
        )}
      </div>
    </nav>
  );
}

