'use client';

import dynamic from 'next/dynamic';

/** Deferred so Clerk modal UI is not in the initial JS payload. */
export const SignInButtonDeferred = dynamic(
  () => import('@clerk/nextjs').then((m) => m.SignInButton),
  {
    ssr: false,
    loading: () => <div className="h-9 min-w-[96px] shrink-0 rounded-lg bg-[var(--surface)] border border-[var(--border)]" aria-hidden />,
  },
);

export const UserButtonDeferred = dynamic(
  () => import('@clerk/nextjs').then((m) => m.UserButton),
  {
    ssr: false,
    loading: () => <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--surface)] border border-[var(--border)]" aria-hidden />,
  },
);
