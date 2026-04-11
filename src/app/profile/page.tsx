import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { checkCreditsAllowed } from '@/lib/credits';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ProfileAccountClient } from './ProfileAccountClient';

const db = supabaseAdmin ?? supabase;

function formatMemberSince(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function mostFrequentGenre(rows: { genre: string | null }[] | null): string | null {
  if (!rows?.length) return null;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const g = r.genre?.trim();
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = -1;
  for (const [k, n] of counts.entries()) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

function formatGenreLabel(key: string) {
  if (!key) return '—';
  return key
    .split(/[-_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return 'just now';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-6" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <p
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: 'var(--muted)',
          marginBottom: 8,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <p className="font-extrabold" style={{ fontFamily: 'Syne, sans-serif', fontSize: 36, color: 'var(--foreground)' }}>
        {value}
      </p>
    </div>
  );
}

function CreditsStatWithUpgrade({ value, isPro }: { value: string; isPro: boolean }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 h-full"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      <div>
        <p
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--muted)',
            marginBottom: 8,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Credits remaining
        </p>
        <p className="font-extrabold" style={{ fontFamily: 'Syne, sans-serif', fontSize: 36, color: 'var(--foreground)' }}>
          {value}
        </p>
      </div>
      {!isPro && (
        <Link
          href="/pricing"
          className="btn-primary inline-flex items-center justify-center w-full text-center mt-auto"
          style={{ textDecoration: 'none' }}
        >
          Upgrade to Pro
        </Link>
      )}
    </div>
  );
}

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const userId = user.id;
  const email = user.emailAddresses?.[0]?.emailAddress ?? '';
  const displayName = user.username || user.firstName || email.split('@')[0] || 'Member';
  const memberSince = formatMemberSince(user.createdAt ? new Date(user.createdAt) : null);
  const avatarUrl = user.imageUrl;
  const initial = (email.split('@')[0]?.[0] || displayName[0] || '?').toUpperCase();

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  let totalGenerations = 0;
  let thisMonth = 0;
  let favoriteGenreData: { genre: string | null }[] | null = null;
  let creditsUsed = 0;
  let creditLimit = 10;
  let isPro = false;
  let recentGenerations: {
    id: string;
    prompt: string | null;
    genre: string;
    bpm: number;
    created_at: string;
  }[] = [];

  try {
    const [totalRes, monthRes, genreRes, recentRes, creditSnap] = await Promise.all([
      db.from('generations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      db
        .from('generations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart),
      db.from('generations').select('genre').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      db
        .from('generations')
        .select('id, prompt, genre, bpm, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      checkCreditsAllowed(userId).catch(() => ({
        credits_used: 0,
        is_pro: false,
        limit: 10,
        allowed: true,
      })),
    ]);

    totalGenerations = totalRes.count ?? 0;
    thisMonth = monthRes.count ?? 0;
    favoriteGenreData = genreRes.data;
    creditsUsed = creditSnap.credits_used;
    creditLimit = creditSnap.limit;
    isPro = creditSnap.is_pro;
    recentGenerations = (recentRes.data as typeof recentGenerations) ?? [];
  } catch {
    // keep defaults
  }

  const favoriteGenre = mostFrequentGenre(favoriteGenreData);
  const favoriteGenreDisplay = favoriteGenre ? formatGenreLabel(favoriteGenre) : '—';

  const creditsRemainingDisplay = String(Math.max(0, creditLimit - creditsUsed));

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="profile" />

      <main className="pt-24 pb-16 px-4 sm:px-8">
        <div className="max-w-[1280px] mx-auto space-y-8">
          {/* SECTION 1 — User header */}
          <section
            className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-6 flex-wrap"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex items-center gap-4 min-w-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  width={72}
                  height={72}
                  className="rounded-full flex-shrink-0"
                  style={{ border: '1px solid var(--border)', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-full flex-shrink-0 font-extrabold text-2xl"
                  style={{
                    width: 72,
                    height: 72,
                    border: '1px solid var(--border)',
                    background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                    color: 'var(--accent)',
                    fontFamily: 'Syne, sans-serif',
                  }}
                  aria-hidden
                >
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="truncate" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: 'var(--foreground)' }}>
                  {displayName}
                </h1>
                {email ? (
                  <p
                    className="truncate mt-1"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}
                  >
                    {email}
                  </p>
                ) : null}
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  Member since {memberSince}
                </p>
              </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  border: '1px solid var(--border)',
                  color: isPro ? '#00B894' : 'var(--foreground-muted)',
                  background: isPro ? 'rgba(0, 184, 148, 0.12)' : 'transparent',
                }}
              >
                {isPro ? 'Pro' : 'Free'}
              </span>
            </div>
          </section>

          {/* SECTION 2 — Stats */}
          <section>
            <h2 className="sr-only">Statistics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard label="Total generations" value={String(totalGenerations)} />
              <StatCard label="This month" value={String(thisMonth)} />
              <StatCard label="Favorite genre" value={favoriteGenreDisplay} />
              <CreditsStatWithUpgrade value={creditsRemainingDisplay} isPro={isPro} />
            </div>
          </section>

          {/* SECTION 3 — Recent generations */}
          <section>
            <p
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Recent generations
            </p>
            <div className="space-y-3">
              {recentGenerations.length === 0 ? (
                <div className="rounded-2xl p-6" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--foreground)' }}>
                    No generations yet
                  </p>
                  <p className="mt-2" style={{ color: 'var(--muted)', fontSize: 14 }}>
                    Create something on the home page — it will show up here.
                  </p>
                  <Link
                    href="/"
                    className="btn-primary inline-flex items-center justify-center mt-4"
                    style={{ height: 40, padding: '0 16px', fontSize: 13, textDecoration: 'none' }}
                  >
                    Go to Create
                  </Link>
                </div>
              ) : (
                recentGenerations.map(row => {
                  const promptText = (row.prompt ?? '').trim() || 'Untitled prompt';
                  const q = encodeURIComponent(promptText);
                  return (
                    <div
                      key={row.id}
                      className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="font-extrabold line-clamp-2"
                          style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, color: 'var(--foreground)' }}
                        >
                          {promptText}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className="px-2 py-1 rounded-md text-xs"
                            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', border: '1px solid var(--border)' }}
                          >
                            {formatGenreLabel(row.genre)}
                          </span>
                          <span
                            className="px-2 py-1 rounded-md text-xs"
                            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', border: '1px solid var(--border)' }}
                          >
                            {row.bpm} BPM
                          </span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--foreground-muted)' }}>
                            {timeAgo(row.created_at)}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/?prompt=${q}`}
                        className="btn-secondary inline-flex items-center justify-center flex-shrink-0 whitespace-nowrap"
                        style={{ height: 40, padding: '0 16px', fontSize: 13, textDecoration: 'none' }}
                      >
                        Load this →
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* SECTION 4 — Account */}
          <section>
            <ProfileAccountClient isPro={isPro} />
          </section>
        </div>
      </main>
    </div>
  );
}
