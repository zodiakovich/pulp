'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useSupabaseWithClerk } from '@/lib/supabase-clerk-browser';
import { GENRES, STYLE_TAGS, generateTrack, getDefaultParams, type GenerationParams, type GenerationResult, type NoteEvent } from '@/lib/music-engine';
import { Navbar } from '@/components/Navbar';
import { playNotesWithMix as playNotes } from '@/lib/mix-engine';
import { stopAllAppAudio } from '@/lib/audio-control';
import { useToast } from '@/components/toast/useToast';
import { AnimatePresence, motion } from 'framer-motion';
import { LAYER_VIZ_COLORS } from '@/lib/design-system';
import { SiteFooter } from '@/components/SiteFooter';

const PianoRollEditor = dynamic(
  () => import('@/components/PianoRollEditor').then(m => ({ default: m.PianoRollEditor })),
  { ssr: false },
);

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

type ChatMessage = {
  id: string;
  from: string;
  text: string;
  time: string;
  color: string;
};

type PresenceMeta = {
  joinedAt: number;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
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
  const { user } = useUser();
  const supabase = useSupabaseWithClerk();
  const toast = useToast();

  const sessionCode = useMemo(() => (id ? String(id).slice(-8) : ''), [id]);
  const [fullUrl, setFullUrl] = useState('');

  const myPresenceKey = useMemo(() => userId ?? `anon-${Math.random().toString(16).slice(2)}`, [userId]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [connStatus, setConnStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('reconnecting');
  const [onlineCount, setOnlineCount] = useState(1);
  const prevPresenceCountRef = useRef(0);
  const [state, setState] = useState<CollabState>(DEFAULT_STATE);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [hostKey, setHostKey] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [footerCopy, setFooterCopy] = useState<'idle' | 'ok'>('idle');
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const [result, setResult] = useState<GenerationResult | null>(null);
  const [params, setParams] = useState<GenerationParams>(() => ({
    ...getDefaultParams(),
    genre: DEFAULT_STATE.genre,
    bpm: DEFAULT_STATE.bpm,
  }));
  const [editorLayer, setEditorLayer] = useState<'melody' | 'chords' | 'bass' | 'drums'>('melody');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const myName = useMemo(() => {
    const email = user?.primaryEmailAddress?.emailAddress;
    return (user?.username || user?.firstName || (email ? email.split('@')[0] : null) || 'Producer').slice(0, 24);
  }, [user]);

  const myColor = useMemo(() => {
    const key = myPresenceKey;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const palette = [
      '#FF6D3F',
      'rgba(255,255,255,0.55)',
      'rgba(255,255,255,0.45)',
      'rgba(255,255,255,0.35)',
      'rgba(255,255,255,0.28)',
      'rgba(255,255,255,0.22)',
      'rgba(255,255,255,0.18)',
      'rgba(255,255,255,0.12)',
    ];
    return palette[h % palette.length]!;
  }, [myPresenceKey]);

  const presenceMapRef = useRef<Record<string, PresenceMeta>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceMeta>>({});

  const editorWrapRef = useRef<HTMLDivElement>(null);
  const cursorThrottleRef = useRef<number>(0);

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

  const updatePresenceFromChannel = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    const ps = ch.presenceState() as Record<string, PresenceMeta[]>;
    const next: Record<string, PresenceMeta> = {};
    for (const [k, metas] of Object.entries(ps)) {
      const m = metas?.[0];
      if (m) next[k] = m;
    }
    presenceMapRef.current = next;
    setPresenceMap(next);

    // Host = earliest joinedAt
    const host = Object.entries(next)
      .sort((a, b) => (a[1].joinedAt ?? 0) - (b[1].joinedAt ?? 0))[0]?.[0] ?? null;
    setHostKey(host);
  }, []);

  const notifyJoinLeave = useCallback((prevKeys: string[], nextKeys: string[]) => {
    const prev = new Set(prevKeys);
    const next = new Set(nextKeys);
    for (const k of nextKeys) {
      if (!prev.has(k)) {
        const name = presenceMapRef.current[k]?.name ?? 'Producer';
        toast.toast(`${name} joined`, 'success');
      }
    }
    for (const k of prevKeys) {
      if (!next.has(k)) {
        const name = presenceMapRef.current[k]?.name ?? 'Producer';
        toast.toast(`${name} left`, 'info');
      }
    }
  }, [toast]);

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
        const prevKeys = Object.keys(presenceMapRef.current);
        updatePresenceFromChannel();
        const presenceState = channel.presenceState() as Record<string, unknown>;
        const count = Object.keys(presenceState).length;
        const n = Math.max(1, count);
        setOnlineCount(n);
        if (prevPresenceCountRef.current > 0 && n > prevPresenceCountRef.current) {
          pushActivity('Producer joined');
        }
        const nextKeys = Object.keys(channel.presenceState() as Record<string, unknown>);
        if (prevPresenceCountRef.current > 0 && nextKeys.length !== prevKeys.length) {
          notifyJoinLeave(prevKeys, nextKeys);
        }
        prevPresenceCountRef.current = n;
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        const incoming = payload as CollabState | undefined;
        if (!incoming) return;
        setState(prev => (incoming.updatedAt > prev.updatedAt ? incoming : prev));
      })
      .on('broadcast', { event: 'gen' }, ({ payload }) => {
        const incoming = payload as { result: GenerationResult; params: GenerationParams; at: number } | undefined;
        if (!incoming?.result) return;
        setResult(incoming.result);
        setParams(incoming.params);
        pushActivity('Pattern updated');
      })
      .on('broadcast', { event: 'notes' }, ({ payload }) => {
        const incoming = payload as { layer: string; notes: NoteEvent[]; at: number } | undefined;
        if (!incoming?.notes || !incoming.layer) return;
        setResult(prev => {
          if (!prev) return prev;
          const layer = incoming.layer as 'melody' | 'chords' | 'bass' | 'drums';
          if (!(['melody', 'chords', 'bass', 'drums'] as const).includes(layer)) return prev;
          return { ...prev, [layer]: incoming.notes } as GenerationResult;
        });
      })
      .on('broadcast', { event: 'activity' }, ({ payload }) => {
        const ev = payload as ActivityEvent | undefined;
        if (!ev?.text) return;
        setEvents(prev => [{ ...ev, id: ev.id || `${Date.now()}` }, ...prev].slice(0, 100));
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        const m = payload as ChatMessage | undefined;
        if (!m?.text) return;
        setMessages(prev => [m, ...prev].slice(0, 200));
      })
      .on('broadcast', { event: 'state_request' }, () => {
        void channel.send({ type: 'broadcast', event: 'state', payload: stateRef.current });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setConnStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') setConnStatus('disconnected');
        else setConnStatus('reconnecting');
        if (status === 'SUBSCRIBED') {
          void channel.track({ joinedAt: Date.now(), name: myName, color: myColor } satisfies PresenceMeta);
          updatePresenceFromChannel();
          void channel.send({ type: 'broadcast', event: 'state_request', payload: { t: Date.now() } });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [id, myPresenceKey, pushActivity, supabase, myName, myColor, updatePresenceFromChannel, notifyJoinLeave]);

  const publish = async (next: Omit<CollabState, 'updatedAt'>) => {
    const updated: CollabState = { ...next, updatedAt: Date.now() };
    setState(updated);
    setParams(p => ({ ...p, genre: updated.genre, bpm: updated.bpm }));

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

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatText('');
    const m: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      from: myName,
      text: text.slice(0, 280),
      time: formatEventTime(),
      color: myColor,
    };
    setMessages(prev => [m, ...prev].slice(0, 200));
    const ch = channelRef.current;
    if (ch) void ch.send({ type: 'broadcast', event: 'chat', payload: m });
  };

  const handleGenerate = async () => {
    const next = generateTrack(params);
    setResult(next);
    pushActivity(`New pattern: ${GENRES[params.genre]?.name ?? params.genre} ${params.bpm}bpm`);
    const ch = channelRef.current;
    if (ch) void ch.send({ type: 'broadcast', event: 'gen', payload: { result: next, params, at: Date.now() } });
  };

  const handlePlayToggle = () => {
    if (!result) return;
    // Simple toggle: stop then play
    stopAllAppAudio();
    playNotes({
      melody: result.melody,
      chords: result.chords,
      bass: result.bass,
      drums: result.drums,
      bpm: params.bpm,
      genre: params.genre,
      onComplete: () => {},
    });
  };

  const notesDebounceRef = useRef<Record<string, number | null>>({});
  const latestNotesRef = useRef<Record<string, NoteEvent[]>>({});

  const publishNotes = useCallback((layer: 'melody' | 'chords' | 'bass' | 'drums', notes: NoteEvent[]) => {
    setResult(prev => (prev ? ({ ...prev, [layer]: notes } as GenerationResult) : prev));
    latestNotesRef.current[layer] = notes;
    const prevT = notesDebounceRef.current[layer];
    if (prevT) window.clearTimeout(prevT);
    notesDebounceRef.current[layer] = window.setTimeout(() => {
      const ch = channelRef.current;
      if (!ch) return;
      const payload = { layer, notes: latestNotesRef.current[layer] ?? notes, at: Date.now() };
      void ch.send({ type: 'broadcast', event: 'notes', payload });
    }, 120);
  }, []);

  const cursorFromEvent = (ev: ReactMouseEvent) => {
    const el = editorWrapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (ev.clientX - r.left) / Math.max(1, r.width);
    const y = (ev.clientY - r.top) / Math.max(1, r.height);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const onEditorMouseMove = (ev: ReactMouseEvent) => {
    const cur = cursorFromEvent(ev);
    if (!cur) return;
    const t = Date.now();
    if (t - cursorThrottleRef.current < 50) return; // ~20fps
    cursorThrottleRef.current = t;
    const ch = channelRef.current;
    if (!ch) return;
    void ch.track({ joinedAt: presenceMapRef.current[myPresenceKey]?.joinedAt ?? t, name: myName, color: myColor, cursor: cur } satisfies PresenceMeta);
    presenceMapRef.current = {
      ...presenceMapRef.current,
      [myPresenceKey]: { ...(presenceMapRef.current[myPresenceKey] ?? { joinedAt: t, name: myName, color: myColor }), cursor: cur },
    };
    setPresenceMap(presenceMapRef.current);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
      if (e.key.toLowerCase() === 'f') setIsFullscreen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const chordOverlayNotes = useMemo(() => {
    if (!result) return [];
    return [...result.melody, ...result.chords, ...result.bass, ...result.drums];
  }, [result]);

  const usersSorted = useMemo(() => {
    return Object.entries(presenceMap).sort((a, b) => (a[1].joinedAt ?? 0) - (b[1].joinedAt ?? 0));
  }, [presenceMap]);

  const dotColor =
    connStatus === 'connected'
      ? '#00B894'
      : connStatus === 'reconnecting'
        ? '#FF6D3F'
        : 'rgba(255,255,255,0.32)';
  const dotLabel =
    connStatus === 'connected' ? 'Connected' : connStatus === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  const dotAnimClass =
    connStatus === 'connected' ? 'conn-dot--connected' : connStatus === 'reconnecting' ? 'conn-dot--reconnecting' : '';

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
                color: 'var(--text)',
              }}
            >
              {sessionCode}
            </code>
            {copyState === 'err' ? (
              <span className="inline-flex items-center rounded-lg border px-3 text-xs" style={{ height: 36, borderColor: 'var(--border)', color: 'var(--muted)' }}>
                Copy failed
              </span>
            ) : (
              <button
                type="button"
                className="btn-secondary copy-label-stack"
                data-copied={copyState === 'ok' ? 'true' : 'false'}
                style={{ height: 36, padding: '0 12px', fontSize: 12 }}
                onClick={() => void copySessionLink()}
              >
                <span className="copy-label-stack__a">Copy invite link</span>
                <span className="copy-label-stack__b">Copied</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full flex-shrink-0 ${dotAnimClass}`}
                style={{
                  width: 8,
                  height: 8,
                  background: dotColor,
                }}
              />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
                {dotLabel} · {onlineCount} {onlineCount === 1 ? 'producer' : 'producers'}
              </span>
            </div>
            <div className="flex items-center -space-x-2">
              {usersSorted.slice(0, 5).map(([k, meta]) => {
                const initial = (meta.name || 'P')[0]?.toUpperCase() ?? 'P';
                return (
                  <div
                    key={k}
                    title={`${meta.name}${k === hostKey ? ' (Host)' : ''}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                    style={{
                      background: meta.color,
                      color: 'var(--bg)',
                      border: '2px solid var(--bg)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {initial}
                  </div>
                );
              })}
              {usersSorted.length > 5 ? (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '2px solid var(--bg)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  title="More producers"
                >
                  +{usersSorted.length - 5}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 36, padding: '0 14px', fontSize: 13 }}
              onClick={() => setChatOpen(v => !v)}
            >
              {chatOpen ? 'Close chat' : 'Chat'}
            </button>
            {leaveConfirm ? (
              <div className="flex flex-wrap items-center gap-3">
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--muted)' }}>Are you sure?</span>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                  onClick={() => {
                    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                    leaveTimerRef.current = null;
                    setLeaveConfirm(false);
                    router.push('/');
                  }}
                >
                  Leave
                </button>
                <button
                  type="button"
                  style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  onClick={() => {
                    setLeaveConfirm(false);
                    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                    leaveTimerRef.current = null;
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                onClick={() => {
                  setLeaveConfirm(true);
                  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                  leaveTimerRef.current = setTimeout(() => setLeaveConfirm(false), 5000);
                }}
              >
                Leave session
              </button>
            )}
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
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" className="btn-primary btn-sm" onClick={() => void handleGenerate()}>
                  Generate
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={handlePlayToggle} disabled={!result}>
                  ▶ Play
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setIsFullscreen(v => !v)}
                  title="Fullscreen (F), exit (Esc)"
                >
                  {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </button>
                <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                  {hostKey === myPresenceKey ? 'Host' : hostKey ? 'Guest' : ''}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {(['melody', 'chords', 'bass', 'drums'] as const).map(l => (
                  <button
                    key={l}
                    type="button"
                    className="btn-secondary btn-sm"
                    style={{
                      height: 30,
                      opacity: editorLayer === l ? 1 : 0.7,
                      borderColor: editorLayer === l ? 'color-mix(in srgb, var(--accent) 70%, var(--border))' : 'var(--border)',
                    }}
                    onClick={() => setEditorLayer(l)}
                  >
                    {l[0]!.toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div
                  style={{
                    position: isFullscreen ? 'fixed' : 'relative',
                    inset: isFullscreen ? 0 : undefined,
                    zIndex: isFullscreen ? 90 : 1,
                    padding: isFullscreen ? 16 : 0,
                    background: isFullscreen ? 'color-mix(in srgb, var(--bg) 92%, transparent)' : 'transparent',
                  }}
                >
                  {isFullscreen ? (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      style={{ position: 'fixed', top: 84, right: 24, height: 34, zIndex: 95 }}
                      onClick={() => setIsFullscreen(false)}
                      title="Exit fullscreen (Esc)"
                    >
                      ✕
                    </button>
                  ) : null}
                  <div
                    ref={editorWrapRef}
                    className={isFullscreen ? 'overflow-hidden' : 'rounded-2xl overflow-hidden'}
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      position: 'relative',
                      borderRadius: isFullscreen ? 16 : undefined,
                      height: isFullscreen ? 'calc(100vh - 32px)' : undefined,
                    }}
                    onMouseMove={onEditorMouseMove}
                  >
                    <div style={{ position: 'relative', zIndex: 1 }}>
                    <PianoRollEditor
                      notes={(result?.[editorLayer] ?? []) as NoteEvent[]}
                      color={LAYER_VIZ_COLORS[editorLayer] ?? LAYER_VIZ_COLORS.melody}
                      bars={16}
                      layerName={editorLayer}
                      chordOverlayNotes={chordOverlayNotes}
                      onNotesChange={(notes) => publishNotes(editorLayer, notes)}
                      gridHeightPx={isFullscreen ? 520 : 260}
                      velocityHeightPx={isFullscreen ? 120 : 80}
                    />
                    </div>

                    {/* Remote cursors */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
                    {usersSorted
                      .filter(([k, m]) => k !== myPresenceKey && m.cursor)
                      .map(([k, m]) => {
                        const cur = m.cursor!;
                        return (
                          <div
                            key={k}
                            style={{
                              position: 'absolute',
                              left: `${cur.x * 100}%`,
                              top: `${cur.y * 100}%`,
                              transform: 'translate(6px, 6px)',
                            }}
                          >
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: m.color,
                                border: '2px solid rgba(10,10,11,0.95)',
                              }}
                            />
                            <div
                              style={{
                                marginTop: 6,
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 8,
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                color: 'var(--text)',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 11,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ color: m.color }}>{m.name}</span>
                              {k === hostKey ? <span style={{ marginLeft: 6, color: 'var(--muted)' }}>Host</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </div>
              </div>
            </div>

            </div>

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
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Session events will appear here.</p>
              ) : (
                events.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text)' }}>{ev.text}</p>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>{ev.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat drawer */}
      <AnimatePresence>
        {chatOpen ? (
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed',
              top: 72,
              right: 0,
              bottom: 0,
              width: 360,
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              zIndex: 80,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>Session chat</div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                style={{ marginLeft: 'auto', height: 30 }}
                onClick={() => setChatOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>No messages yet.</div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-weak)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: m.color }}>{m.from}</div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>{m.time}</div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text)' }}>{m.text}</div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendChat();
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Message…"
                  className="input-field flex-1"
                  style={{ height: 40 }}
                  maxLength={280}
                />
                <button type="submit" className="btn-primary btn-sm" style={{ height: 40 }}>
                  Send
                </button>
              </form>
              <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>
                {usersSorted.length} users · {hostKey ? `host: ${presenceMap[hostKey]?.name ?? '—'}` : 'host: —'}
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* Invite link */}
      <section className="px-4 sm:px-8 py-12 mt-auto" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto text-center space-y-4">
          <p style={{ fontSize: 14, color: 'var(--muted)', fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif' }}>
            Share this link to invite producers
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-2xl mx-auto">
            <code
              className="block flex-1 text-left px-4 py-3 rounded-xl text-xs sm:text-sm break-all cursor-pointer select-all"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              onClick={() => void copyFooterUrl()}
              title="Click to copy"
            >
              {fullUrl || '…'}
            </code>
            <button
              type="button"
              className="btn-secondary flex-shrink-0 copy-label-stack"
              data-copied={footerCopy === 'ok' ? 'true' : 'false'}
              style={{ height: 44, padding: '0 16px' }}
              onClick={() => void copyFooterUrl()}
            >
              <span className="copy-label-stack__a">Copy</span>
              <span className="copy-label-stack__b">Copied</span>
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 520, margin: '0 auto', fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif' }}>
            Sessions are temporary — generate and download before leaving
          </p>
          <Link href="/" className="nav-link inline-block text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            ← Back to pulp
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
