'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSupabaseWithClerk } from '@/lib/supabase-clerk-browser';
import { GENRES, STYLE_TAGS } from '@/lib/music-engine';
import { Navbar } from '@/components/Navbar';
import { EmbedClient } from '@/app/embed/EmbedClient';

type CollabState = {
  genre: string;
  bpm: number;
  styleTag: string | null;
  updatedAt: number;
};

type ActivityEvent = {
  id: string;
  text: string;
  time: string;
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

function formatEventTime() {
  return new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function CollabSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const supabase = useSupabaseWithClerk();

  const sessionCode = useMemo(() => (id ? String(id).slice(-8) : ''), [id]);
  const [fullUrl, setFullUrl] = useState('');

  const myPresenceKey = useMemo(() => userId ?? `anon-${Math.random().toString(16).slice(2)}`, [userId]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const prevPresenceCountRef = useRef(0);
  const [state, setState] = useState<CollabState>(DEFAULT_STATE);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [footerCopy, setFooterCopy] = useState<'idle' | 'ok'>('idle');

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setFullUrl(window.location.href);
  }, []);

  const genreList = useMemo(() => Object.entries(GENRES).map(([key, g]) => ({ key, name: g.name })), []);
  const styleTags = useMemo(() => Object.keys(STYLE_TAGS), []);

  const pushActivity = useCallback(
    (text: string) => {
      const ev: ActivityEvent = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text,
        time: formatEventTime(),
      };
      setEvents(prev => [ev, ...prev].slice(0, 100));
      const ch = channelRef.current;
      if (ch) {
        void ch.send({ type: 'broadcast', event: 'activity', payload: ev });
      }
    },
    [],
  );

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
  }, [id, supabase]);

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
        const n = Math.max(1, count);
        setOnlineCount(n);
        if (prevPresenceCountRef.current > 0 && n > prevPresenceCountRef.current) {
          pushActivity('Producer joined');
        }
        prevPresenceCountRef.current = n;
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        const incoming = payload as CollabState | undefined;
        if (!incoming) return;
        setState(prev => (incoming.updatedAt > prev.updatedAt ? incoming : prev));
      })
      .on('broadcast', { event: 'activity' }, ({ payload }) => {
        const ev = payload as ActivityEvent | undefined;
        if (!ev?.text) return;
        setEvents(prev => [{ ...ev, id: ev.id || `${Date.now()}` }, ...prev].slice(0, 100));
      })
      .on('broadcast', { event: 'state_request' }, () => {
        void channel.send({ type: 'broadcast', event: 'state', payload: stateRef.current });
      })
      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          void channel.track({ joinedAt: Date.now() });
          void channel.send({ type: 'broadcast', event: 'state_request', payload: { t: Date.now() } });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [id, myPresenceKey, pushActivity, supabase]);

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

  const copySessionLink = async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(url);
      setCopyState('ok');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('err');
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  const copyFooterUrl = async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(url);
      setFooterCopy('ok');
      window.setTimeout(() => setFooterCopy('idle'), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />

      {/* SECTION 1 — Session header */}
      <header className="pt-20 pb-6 px-4 sm:px-8" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto flex flex-col lg:flex-row lg:items-center gap-4 lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>Session</span>
            <code
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            >
              {sessionCode}
            </code>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 36, padding: '0 12px', fontSize: 12 }}
              onClick={() => void copySessionLink()}
            >
              {copyState === 'ok' ? 'Copied!' : copyState === 'err' ? 'Copy failed' : 'Copy link'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full flex-shrink-0 ${connected ? 'animate-pulse' : ''}`}
                style={{
                  width: 8,
                  height: 8,
                  background: connected ? '#00B894' : 'rgba(138,138,154,0.45)',
                }}
              />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--foreground-muted)' }}>
                {onlineCount} {onlineCount === 1 ? 'producer' : 'producers'} in session
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 36, padding: '0 14px', fontSize: 13 }}
              onClick={() => router.push('/')}
            >
              Leave session
            </button>
          </div>
        </div>
      </header>

      {/* SECTION 2 — Two columns */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-0">
          {/* Left ~60% */}
          <div className="w-full lg:w-[60%] lg:pr-8 lg:border-r lg:min-h-[480px]" style={{ borderColor: 'var(--border)' }}>
            <p
              className="mb-4"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              Shared controls
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>
                  Genre
                </p>
                <select
                  value={state.genre}
                  onChange={e => void publish({ genre: e.target.value, bpm: state.bpm, styleTag: state.styleTag })}
                  className="w-full h-11 rounded-xl px-3 text-sm input-field"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {genreList.map(g => (
                    <option key={g.key} value={g.key}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>
                  BPM
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={60}
                    max={200}
                    value={state.bpm}
                    onChange={e => void publish({ genre: state.genre, bpm: safeClampBpm(parseInt(e.target.value, 10)), styleTag: state.styleTag })}
                    className="w-full"
                  />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', fontSize: 12, minWidth: 40, textAlign: 'right' }}>
                    {state.bpm}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl p-4 sm:col-span-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>
                  Style tag
                </p>
                <select
                  value={state.styleTag ?? ''}
                  onChange={e => void publish({ genre: state.genre, bpm: state.bpm, styleTag: e.target.value || null })}
                  className="w-full h-11 rounded-xl px-3 text-sm input-field"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
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

            <p
              className="mb-3"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              Generator
            </p>
            <EmbedClient
              initialGenre={state.genre}
              initialBpm={String(state.bpm)}
              initialKey={null}
              compact
              onParamsChange={({ genre, bpm }) => {
                void publish({ genre, bpm, styleTag: state.styleTag });
              }}
              onAfterGenerate={({ genre, bpm }) => {
                const name = GENRES[genre]?.name ?? genre;
                pushActivity(`New generation: ${name} ${bpm}bpm`);
              }}
              onDownloadMidi={() => {
                pushActivity('Layer downloaded');
              }}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>Variations</span>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ height: 32 }}
                  onClick={() => pushActivity(`Variation ${n} selected`)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Right ~40% */}
          <div className="w-full lg:w-[40%] lg:pl-8 flex flex-col min-h-[320px]">
            <p
              className="mb-3"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              Live activity
            </p>
            <div
              className="rounded-2xl p-4 flex-1 overflow-y-auto max-h-[min(70vh,560px)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {events.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Session events will appear here.</p>
              ) : (
                events.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#00B894',
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--foreground)' }}>{ev.text}</p>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>{ev.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4 — Footer */}
      <footer className="px-4 sm:px-8 py-10 mt-auto" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto text-center space-y-4">
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>Share this link to invite producers:</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-2xl mx-auto">
            <code
              className="block flex-1 text-left px-4 py-3 rounded-xl text-xs sm:text-sm break-all cursor-pointer select-all"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
              onClick={() => void copyFooterUrl()}
              title="Click to copy"
            >
              {fullUrl || '…'}
            </code>
            <button type="button" className="btn-secondary flex-shrink-0" style={{ height: 44, padding: '0 16px' }} onClick={() => void copyFooterUrl()}>
              {footerCopy === 'ok' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 520, margin: '0 auto' }}>
            Sessions are temporary — generate and download before leaving
          </p>
          <Link href="/" className="nav-link inline-block text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            ← Back to pulp
          </Link>
        </div>
      </footer>
    </div>
  );
}
