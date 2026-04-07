'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GENRES, STYLE_TAGS } from '@/lib/music-engine';

type CollabState = {
  genre: string;
  bpm: number;
  styleTag: string | null;
  updatedAt: number;
};

const DEFAULT_STATE: CollabState = {
  genre: 'techno',
  bpm: 128,
  styleTag: null,
  updatedAt: 0,
};

function safeClampBpm(n: number) {
  return Math.max(60, Math.min(200, Math.round(n)));
}

export default function CollabSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAuth();

  const myPresenceKey = useMemo(() => userId ?? `anon-${Math.random().toString(16).slice(2)}`, [userId]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [state, setState] = useState<CollabState>(DEFAULT_STATE);

  const genreList = useMemo(() => Object.entries(GENRES).map(([key, g]) => ({ key, name: g.name })), []);
  const styleTags = useMemo(() => Object.keys(STYLE_TAGS), []);

  // Load initial state (best-effort) from DB, then join realtime room.
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const { data } = await supabase
          .from('collab_sessions')
          .select('state')
          .eq('id', id)
          .single();
        if (!cancelled && data?.state) setState(data.state as CollabState);
      } catch {
        // Ignore: table may not exist or row missing.
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase.channel(`collab:${id}`, {
      config: {
        presence: { key: myPresenceKey },
        broadcast: { self: false },
      },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).length;
        setOnlineCount(Math.max(1, count));
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        const incoming = payload as CollabState | undefined;
        if (!incoming) return;
        setState(prev => (incoming.updatedAt > prev.updatedAt ? incoming : prev));
      })
      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          void channel.track({ joinedAt: Date.now() });
          // Ask others for current state (if any)
          void channel.send({ type: 'broadcast', event: 'state_request', payload: { t: Date.now() } });
        }
      });

    channel.on('broadcast', { event: 'state_request' }, () => {
      // Respond with our latest known state
      void channel.send({ type: 'broadcast', event: 'state', payload: state });
    });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, myPresenceKey]);

  // Keep state_request responder updated with latest `state`
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    // When our local state changes, persist and broadcast.
    // (This effect is only triggered by our explicit setters below.)
  }, [state]);

  const publish = async (next: Omit<CollabState, 'updatedAt'>) => {
    const updated: CollabState = { ...next, updatedAt: Date.now() };
    setState(updated);

    const channel = channelRef.current;
    if (channel) {
      void channel.send({ type: 'broadcast', event: 'state', payload: updated });
    }

    try {
      await supabase
        .from('collab_sessions')
        .upsert({ id, state: updated, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    } catch {
      // Ignore persistence failures
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0F' }}>
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{ borderBottom: '1px solid #1A1A2E', background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-[1280px] mx-auto px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-gradient font-extrabold text-xl"
            style={{ fontFamily: 'Syne, sans-serif', textDecoration: 'none' }}
          >
            pulp
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg" style={{ border: '1px solid #1A1A2E', background: '#111118' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: connected ? '#00B894' : 'rgba(138,138,154,0.45)' }} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8A8A9A' }}>
                {onlineCount} online
              </span>
            </div>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.45)' }}>
              /collab/{id}
            </span>
          </div>
        </div>
      </nav>

      <section className="pt-28 pb-16 px-8">
        <div className="max-w-[860px] mx-auto">
          <h1
            className="font-extrabold mb-3 text-gradient"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(34px, 4.6vw, 54px)', letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            Shared session
          </h1>
          <p style={{ color: '#8A8A9A', fontSize: 14, lineHeight: 1.7, maxWidth: 700 }}>
            Changes to <span style={{ color: '#F0F0FF' }}>genre</span>, <span style={{ color: '#F0F0FF' }}>BPM</span>, and{' '}
            <span style={{ color: '#F0F0FF' }}>style tag</span> sync instantly for everyone on this link.
          </p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl p-5" style={{ background: '#111118', border: '1px solid #1A1A2E' }}>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}>
                Genre
              </p>
              <select
                value={state.genre}
                onChange={e => void publish({ genre: e.target.value, bpm: state.bpm, styleTag: state.styleTag })}
                className="w-full h-11 rounded-xl px-3 text-sm"
                style={{ background: '#0D0D12', border: '1px solid #1A1A2E', color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}
              >
                {genreList.map(g => (
                  <option key={g.key} value={g.key}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl p-5" style={{ background: '#111118', border: '1px solid #1A1A2E' }}>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}>
                BPM
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={60}
                  max={200}
                  value={state.bpm}
                  onChange={e => void publish({ genre: state.genre, bpm: safeClampBpm(parseInt(e.target.value)), styleTag: state.styleTag })}
                  className="w-full"
                />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#FF6D3F', fontSize: 12, minWidth: 44, textAlign: 'right' }}>
                  {state.bpm}
                </span>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ background: '#111118', border: '1px solid #1A1A2E' }}>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}>
                Style tag
              </p>
              <select
                value={state.styleTag ?? ''}
                onChange={e => void publish({ genre: state.genre, bpm: state.bpm, styleTag: e.target.value || null })}
                className="w-full h-11 rounded-xl px-3 text-sm"
                style={{ background: '#0D0D12', border: '1px solid #1A1A2E', color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}
              >
                <option value="">None</option>
                {styleTags.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-2xl p-6" style={{ background: '#0D0D12', border: '1px solid #1A1A2E' }}>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}>
              Current shared state
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-md text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A', background: '#111118', border: '1px solid #1A1A2E' }}>
                {GENRES[state.genre]?.name ?? state.genre}
              </span>
              <span className="px-2 py-1 rounded-md text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A', background: '#111118', border: '1px solid #1A1A2E' }}>
                {state.bpm} BPM
              </span>
              {state.styleTag && (
                <span className="px-2 py-1 rounded-md text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#FF6D3F', background: 'rgba(255,109,63,0.10)', border: '1px solid rgba(255,109,63,0.25)' }}>
                  {state.styleTag}
                </span>
              )}
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-semibold transition-all"
              style={{
                textDecoration: 'none',
                background: 'rgba(255,109,63,0.12)',
                border: '1px solid rgba(255,109,63,0.35)',
                color: '#FF6D3F',
              }}
            >
              Back to generator →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

