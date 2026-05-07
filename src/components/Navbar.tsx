'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History as HistoryIcon, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';
import { useAuth, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { SignInButtonDeferred } from '@/components/ClerkAuthDeferred';
import { WhatsNew } from '@/components/WhatsNew';

const STORAGE_KEY = 'pulp_theme';

function syncThemeColorMeta(isLight: boolean) {
  const meta = document.getElementById('theme-color');
  if (meta) meta.setAttribute('content', isLight ? '#FAFAFA' : '#0A0A0B');
}

function beginThemeTransition() {
  const html = document.documentElement;
  html.classList.add('theme-is-transitioning');
  window.setTimeout(() => html.classList.remove('theme-is-transitioning'), 320);
}

export function Navbar({
  active,
}: {
  active?: 'create' | 'midi' | 'transcribe' | 'explore' | 'build' | 'pricing' | 'profile' | 'blog' | 'changelog' | 'settings';
  onHistory?: () => void;
  historyCount?: number;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const scrollToGenerator = () => {
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const resolved = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    setTheme(resolved);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navClass = (isActive: boolean) =>
    `nav-link ${isActive ? 'nav-link--active' : ''}`;

  const loggedOutLinks = (
    <>
      <Link href="/" className={navClass(active === 'create')}>
        Create
      </Link>
      <Link href="/midi" className={navClass(active === 'midi')}>
        MIDI
      </Link>
      <Link href="/transcribe" className={navClass(active === 'transcribe')}>
        Transcribe
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
      <Link href="/midi" className={navClass(active === 'midi')}>
        MIDI
      </Link>
      <Link href="/transcribe" className={navClass(active === 'transcribe')}>
        Transcribe
      </Link>
      <Link href="/explore" className={navClass(active === 'explore')}>
        Explore
      </Link>
      <Link href="/pricing" className={navClass(active === 'pricing')}>
        Pricing
      </Link>
      <Link href="/profile" className={navClass(active === 'profile')}>
        Profile
      </Link>
    </>
  );

  return (
    <nav
      className="sticky top-0 left-0 right-0 z-50"
      style={{
        background: 'color-mix(in srgb, var(--bg) 94%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-weak)',
        boxShadow: scrolled ? '0 4px 24px -4px color-mix(in srgb, var(--accent) 10%, transparent)' : 'none',
        transition: 'box-shadow 300ms ease, background 300ms ease, border-color 300ms ease',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 h-14 flex items-center justify-between gap-3 sm:gap-4">
        <Link
          href="/"
          className="font-extrabold text-xl flex items-center gap-2"
          style={{ fontFamily: 'Syne, sans-serif', textDecoration: 'none', color: 'var(--accent)' }}
        >
          pulp
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              background: 'var(--surface)',
              borderRadius: 20,
              padding: '2px 7px',
              lineHeight: 1.5,
            }}
          >
            Beta
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {isLoaded && isSignedIn ? loggedInLinks : loggedOutLinks}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 relative z-[55]" style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <div className="hidden sm:block">
            <WhatsNew />
          </div>
          <button
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="hidden min-[380px]:flex h-9 w-9 rounded-lg items-center justify-center transition-opacity hover:opacity-90"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)', background: 'var(--surface-weak)' }}
            onClick={() => {
              const html = document.documentElement;
              const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
              beginThemeTransition();
              html.classList.remove('dark', 'light');
              html.classList.add(next);
              setTheme(next);
              syncThemeColorMeta(next === 'light');
              try {
                localStorage.setItem(STORAGE_KEY, next);
              } catch {
                // ignore
              }
            }}
          >
            {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} aria-hidden /> : <Moon size={16} strokeWidth={1.75} aria-hidden />}
          </button>
          <SignedIn>
            {pathname === '/' ? (
              <div className="hidden sm:block">
                <button type="button" className="btn-primary btn-sm" onClick={() => scrollToGenerator()}>
                  Generate
                </button>
              </div>
            ) : (
              <div className="hidden sm:block">
                <Link href="/#generator" className="btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  Generate
                </Link>
              </div>
            )}
            <UserButton
              appearance={{
                elements: {
                  userButtonPopoverActionButton: {
                    color: '#FAFAFA !important',
                  },
                  userButtonPopoverActionButton__manageAccount: {
                    color: '#FAFAFA !important',
                  },
                  userButtonPopoverActionButton__signOut: {
                    color: '#FAFAFA !important',
                  },
                  userButtonPopoverActionButtonText: {
                    color: '#FAFAFA !important',
                  },
                  userButtonPopoverActionButtonIcon: {
                    color: '#FAFAFA !important',
                  },
                },
              }}
            >
              <UserButton.MenuItems>
                <UserButton.Link
                  label="History"
                  href="/?history=1"
                  labelIcon={<HistoryIcon size={14} aria-hidden />}
                />
                <UserButton.Link
                  label="Settings"
                  href="/settings"
                  labelIcon={<SettingsIcon size={14} aria-hidden />}
                />
              </UserButton.MenuItems>
            </UserButton>
          </SignedIn>
          <SignedOut>
            <div className="hidden sm:block">
              <SignInButtonDeferred mode="modal">
                <button type="button" className="btn-primary btn-sm">
                  Start generating
                </button>
              </SignInButtonDeferred>
            </div>
          </SignedOut>
          <button
            type="button"
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg transition-all"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
            style={{ color: 'var(--muted)' }}
          >
            <span style={{ display: 'block', width: 20, height: 1.5, background: 'currentColor', borderRadius: 1, transition: 'transform 0.2s', transform: mobileMenuOpen ? 'translateY(5px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: 20, height: 1.5, background: 'currentColor', borderRadius: 1, opacity: mobileMenuOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
            <span style={{ display: 'block', width: 20, height: 1.5, background: 'currentColor', borderRadius: 1, transition: 'transform 0.2s', transform: mobileMenuOpen ? 'translateY(-5px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="md:hidden px-6 pb-4 flex flex-col gap-1"
          style={{ borderTop: '1px solid var(--border-weak)', background: 'color-mix(in srgb, var(--bg) 97%, transparent)' }}
        >
          <SignedOut>
            <SignInButtonDeferred mode="modal">
              <button
                type="button"
                className="btn-primary btn-sm mt-3 mb-2 w-full"
                onClick={() => setMobileMenuOpen(false)}
              >
                Start generating
              </button>
            </SignInButtonDeferred>
          </SignedOut>
          {isLoaded && isSignedIn ? (
            <>
              <a href="/" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Create</a>
              <a href="/midi" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>MIDI</a>
              <a href="/transcribe" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Transcribe</a>
              <a href="/explore" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Explore</a>
              <a href="/profile" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Profile</a>
              <a href="/blog" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Blog</a>
              <a href="/about" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>About</a>
            </>
          ) : (
            <>
              <a href="/" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Create</a>
              <a href="/midi" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>MIDI</a>
              <a href="/transcribe" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Transcribe</a>
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
