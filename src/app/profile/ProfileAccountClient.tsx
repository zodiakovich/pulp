'use client';

import { useClerk } from '@clerk/nextjs';

export function ProfileAccountClient({ isPro }: { isPro: boolean }) {
  const { signOut } = useClerk();

  return (
    <div
      className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 flex-wrap"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex flex-col gap-3 min-w-0">
        <p
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Account
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              border: '1px solid var(--border)',
              color: isPro ? '#00B894' : 'var(--foreground-muted)',
              background: isPro ? 'rgba(0, 184, 148, 0.12)' : 'transparent',
            }}
          >
            {isPro ? 'Pro' : 'Free'}
          </span>
          {isPro ? (
            <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>Manage subscription in your billing portal.</span>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
              Running low on credits? Upgrade from the credits card above.
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => void signOut({ redirectUrl: '/' })}
      >
        Sign out
      </button>
    </div>
  );
}
