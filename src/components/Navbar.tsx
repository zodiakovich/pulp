'use client';

import Link from 'next/link';
import { useAuth, UserButton } from '@clerk/nextjs';
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

        <div className="flex items-center gap-2">
          {isLoaded && isSignedIn ? (
            <>
              {/* signed-in order: ⌘K → v1.0 → What's new → theme → avatar */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('pulp:open-command-bar'))}
                className="h-9 px-3 rounded-lg flex items-center justify-center transition-all"
                style={{
                  border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                  background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
                  color: 'var(--text)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
                aria-label="Open command bar"
                title="Command bar (⌘K)"
              >
                ⌘K
              </button>

              <span
                className="hidden lg:inline-flex h-9 items-center px-3 rounded-lg"
                style={{
                  border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                  background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
                  color: 'var(--muted)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
                aria-label="Version"
                title="Version"
              >
                v1.0
              </span>

              <div className="hidden lg:block">
                <WhatsNew />
              </div>

              <ThemeToggle />

              <div className="flex-shrink-0">
                <UserButton />
              </div>
            </>
          ) : (
            <>
              {/* logged-out order: What's new → theme → Sign in */}
              <WhatsNew />
              <ThemeToggle />
              <Link
                href="/sign-in"
                className="text-sm h-9 px-4 rounded-lg transition-all flex items-center"
                style={{
                  border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                  color: 'var(--text)',
                  background: 'transparent',
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                }}
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

