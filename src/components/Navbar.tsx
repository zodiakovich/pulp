'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { useAuth, SignedIn, SignedOut } from '@clerk/nextjs';
import { SignInButtonDeferred, UserButtonDeferred } from '@/components/ClerkAuthDeferred';
import { WhatsNew } from '@/components/WhatsNew';

type CreditsData = { credits_used: number; limit: number; is_pro: boolean; plan_type: string } | null;

function GenerationPill({ data, onClick }: { data: CreditsData; onClick: () => void }) {
  if (!data) return null;
  const remaining = Math.max(0, data.limit - data.credits_used);
  const pct = data.limit > 0 ? remaining / data.limit : 0;
  const color = pct > 0.5 ? '#00B894' : pct > 0.1 ? '#FF6D3F' : '#E94560';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color,
        border: `1px solid ${color}33`,
        background: `${color}14`,
        borderRadius: 20,
        padding: '3px 10px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        letterSpacing: '0.03em',
        lineHeight: 1.5,
      }}
      title={`${remaining} of ${data.limit} generations remaining`}
    >
      {remaining} / {data.limit}
    </button>
  );
}

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
  onHistory,
  historyCount,
}: {
  active?: 'create' | 'explore' | 'build' | 'pricing' | 'profile' | 'blog' | 'changelog' | 'settings';
  onHistory?: () => void;
  historyCount?: number;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [credits, setCredits] = useState<CreditsData>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits');
        if (res.ok) setCredits(await res.json() as CreditsData);
      } catch { /* silent */ }
    }
    void fetchCredits();

    function onGenerated() { void fetchCredits(); }
    window.addEventListener('pulp:generation-created', onGenerated);
    return () => window.removeEventListener('pulp:generation-created', onGenerated);
  }, [isLoaded, isSignedIn]);

  const scrollToGenerator = () => {
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const resolved = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    setTheme(resolved);
  }, []);

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
      <Link href="/settings" className={navClass(active === 'settings')}>
        Settings
      </Link>
      <Link href="/pricing" className={navClass(active === 'pricing')}>
        Pricing
      </Link>
    </>
  );

  return (
    <nav
      className="sticky top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(10,10,11,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: scrolled ? '0 4px 24px -4px rgba(255,109,63,0.10)' : 'none',
        transition: 'box-shadow 300ms ease',
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
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="h-9 w-9 rounded-lg flex items-center justify-center transition-opacity hover:opacity-90"
            style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border-weak)', background: 'var(--surface-weak)' }}
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
            <GenerationPill
              data={credits}
              onClick={() => router.push(credits?.is_pro ? '/profile' : '/pricing')}
            />
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
                Start generating
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
              <a href="/profile" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Profile</a>
              <a href="/settings" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>Settings</a>
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
