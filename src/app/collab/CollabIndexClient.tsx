'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { EmptyState } from '@/components/EmptyState';

function newSessionId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

export default function CollabIndexClient() {
  const router = useRouter();
  const id = useMemo(() => newSessionId(), []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />
      <main className="pt-24 px-4 sm:px-8">
        <div className="mx-auto max-w-[1200px]" style={{ minHeight: 'calc(100vh - 120px)' }}>
          <EmptyState
            title="No active sessions"
            actionLabel="Start a session"
            onAction={() => router.push(`/collab/${id}`)}
          />
        </div>
      </main>
    </div>
  );
}
