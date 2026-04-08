'use client';

import Link from 'next/link';
import { useAuth, SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WhatsNew } from '@/components/WhatsNew';

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

  const navClass = (isActive: boolean) =>
    `nav-link ${isActive ? 'nav-link--active' : ''}`;

  const loggedOutLinks = (
    <>
      <Link href="/" className={navClass(active === 'create')}>
        Create
      </Link>
      <Link href="/explore" className={navClass(active === 'explore')}>
        Explore
      </Link>
      <Link href="/pricing" className={navClass(active === 'pricing')}>
        Pricing
      </Link>
    </>
  );

  const loggedInLinks = (
    <>
      <Link href="/" className={navClass(active === 'create')}>
        Create
      </Link>
      <Link href="/explore" className={navClass(active === 'explore')}>
        Explore
      </Link>
      <Link href="/build" className={navClass(active === 'build')}>
        Build
      </Link>

      {onHistory ? (
        <button
          type="button"
          onClick={onHistory}
          className="nav-link flex items-center gap-2"
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
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
        <Link href="/?history=1" className={navClass(false)}>
          History
        </Link>
      )}

      <Link href="/profile" className={navClass(active === 'profile')}>
        Profile
      </Link>
      <Link href="/pricing" className={navClass(active === 'pricing')}>
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
          className="font-extrabold text-xl"
          style={{ fontFamily: 'Syne, sans-serif', textDecoration: 'none', color: 'var(--accent)' }}
        >
          pulp
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {isLoaded && isSignedIn ? loggedInLinks : loggedOutLinks}
        </div>

        <div className="flex items-center gap-2">
          <WhatsNew />
          <ThemeToggle />
          <SignedIn>
            <div className="flex-shrink-0">
              <UserButton />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="text-sm h-9 px-4 rounded-lg transition-all flex items-center"
                style={{
                  border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                  color: 'var(--button-text)',
                  background: 'transparent',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--foreground) 6%, transparent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}
