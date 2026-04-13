'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, SignedIn, SignedOut } from '@clerk/nextjs';
import { SignInButtonDeferred, UserButtonDeferred } from '@/components/ClerkAuthDeferred';
import { WhatsNew } from '@/components/WhatsNew';

const STORAGE_KEY = 'pulp_theme';

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 14.6A8.5 8.5 0 0 1 9.4 3a7 7 0 1 0 11.6 11.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Navbar({
  active,
  onHistory,
  historyCount,
}: {
  active?: 'create' | 'explore' | 'build' | 'pricing' | 'profile' | 'blog' | 'changelog';
  onHistory?: () => void;
  historyCount?: number;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToGenerator = () => {
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      const resolved: 'dark' | 'light' = t === 'light' ? 'light' : 'dark';
      setTheme(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    } catch {
      setTheme('dark');
    }
  }, []);

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
      <Link href="/changelog" className={navClass(active === 'changelog')}>
        Changelog
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
      <Link href="/changelog" className={navClass(active === 'changelog')}>
        Changelog
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
      <div className="max-w-[1280px] mx-auto px-8 h-14 flex items-center justify-between gap-4">
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

        <button
          type="button"
          className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg transition-all"
          onClick={() => setMobileMenuOpen(v => !v)}
          aria-label="Toggle menu"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <span style={{ display: 'block', width: 20, height: 1.5, background: 'currentColor', borderRadius: 1, transition: 'transform 0.2s', transform: mobileMenuOpen ? 'translateY(5px) rotate(45deg)' : 'none' }} />
          <span style={{ display: 'block', width: 20, height: 1.5, background: 'currentColor', borderRadius: 1, opacity: mobileMenuOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
          <span style={{ display: 'block', width: 20, height: 1.5, background: 'currentColor', borderRadius: 1, transition: 'transform 0.2s', transform: mobileMenuOpen ? 'translateY(-5px) rotate(-45deg)' : 'none' }} />
        </button>

        <div className="flex items-center gap-3 relative z-[55]" style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <WhatsNew />
          <button
            type="button"
            aria-label="Toggle theme"
            className="h-9 w-9 rounded-lg flex items-center justify-center transition-all text-foreground"
            onClick={() => {
              const html = document.documentElement;
              const nextIsDark = !html.classList.contains('dark');
              html.classList.toggle('dark', nextIsDark);
              const next: 'dark' | 'light' = nextIsDark ? 'dark' : 'light';
              setTheme(next);
              try {
                localStorage.setItem(STORAGE_KEY, next);
              } catch {
                // ignore
              }
            }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <SignedIn>
            {pathname === '/' ? (
              <button type="button" className="btn-primary btn-sm" onClick={() => scrollToGenerator()}>
                Generate
              </button>
            ) : (
              <Link href="/#generator" className="btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                Generate
              </Link>
            )}
            <UserButtonDeferred />
          </SignedIn>
          <SignedOut>
            <SignInButtonDeferred mode="modal">
              <button type="button" className="btn-primary btn-sm">
                Start free
              </button>
            </SignInButtonDeferred>
          </SignedOut>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="md:hidden px-6 pb-4 flex flex-col gap-1"
          style={{ borderTop: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg) 95%, transparent)' }}
        >
          {isLoaded && isSignedIn ? (
            <>
              <a href="/" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Create</a>
              <a href="/explore" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Explore</a>
              <a href="/build" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Build</a>
              <a href="/changelog" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Changelog</a>
              <a href="/profile" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Profile</a>
              <a href="/pricing" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="/blog" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Blog</a>
              <a href="/about" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>About</a>
            </>
          ) : (
            <>
              <a href="/" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Create</a>
              <a href="/explore" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Explore</a>
              <a href="/pricing" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="/blog" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Blog</a>
              <a href="/about" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>About</a>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
