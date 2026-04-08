import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ProfileClient } from './ProfileClient';

function formatMemberSince(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const username =
    user.username ||
    user.firstName ||
    (user.emailAddresses?.[0]?.emailAddress?.split('@')[0] ?? 'Member');
  const avatar = user.imageUrl;
  const memberSince = formatMemberSince(user.createdAt ? new Date(user.createdAt) : null);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
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
          <div className="flex items-center gap-8 text-sm">
            <Link href="/" className="nav-link">
              Create
            </Link>
            <Link href="/explore" className="nav-link">
              Explore
            </Link>
            <Link href="/build" className="nav-link">
              Build
            </Link>
            <Link href="/pricing" className="nav-link">
              Pricing
            </Link>
            <Link href="/profile" className="nav-link nav-link--active">
              Profile
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="rounded-2xl p-6 flex items-center gap-4 flex-wrap"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <img
              src={avatar}
              alt={`${username} avatar`}
              width={64}
              height={64}
              style={{ borderRadius: 999, border: '1px solid var(--border)' }}
            />
            <div className="min-w-0">
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26 }}>
                {username}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                Member since {memberSince}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProfileClient userId={user.id} />
    </div>
  );
}

