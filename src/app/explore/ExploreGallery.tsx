'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { ScrollReveal } from '@/components/ScrollReveal';
import { CustomSelect } from '@/components/CustomSelect';
import { supabase } from '@/lib/supabase';
import { playAll } from '@/lib/tone-lazy';
import { stopAllAppAudio, subscribeToAudioStop } from '@/lib/audio-control';
import type { GenerationResult } from '@/lib/music-engine';

type GalleryItem = {
  id: string;
  prompt: string | null;
  genreKey: string;
  genreLabel: string;
  bpm: number;
  style_tag: string | null;
  tags: string[] | null;
  created_at: string;
  timeAgo: string;
  isExample: boolean;
};

// ─── ICONS ────────────────────────────────────────────────────────

function MusicEmptyIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" role="presentation">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
      <path d="M2 1.5l8 4.5-8 4.5V1.5z" fill="#FF6D3F" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="3" height="9" rx="0.75" fill="#FF6D3F" />
      <rect x="6.5" y="1.5" width="3" height="9" rx="0.75" fill="#FF6D3F" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="rgba(255,109,63,0.25)" strokeWidth="2" />
      <path d="M7 2a5 5 0 015 5" stroke="#FF6D3F" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1 2.5h12M3 7h8M5 11.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="5" y="4" width="7" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 9H2.5A1.5 1.5 0 011 7.5v-5A1.5 1.5 0 012.5 1h5A1.5 1.5 0 019 2.5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── EXPLORE CARD ─────────────────────────────────────────────────

function ExploreCard({
  item,
  idx,
  isPlaying,
  onRequestPlay,
  onPlaybackEnd,
}: {
  item: GalleryItem;
  idx: number;
  isPlaying: boolean;
  onRequestPlay: (id: string) => void;
  onPlaybackEnd: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(16);
  const router = useRouter();

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setProgress(0);
      setLoading(false);
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handlePlayClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPlaying) {
      stopAllAppAudio();
      onPlaybackEnd(item.id);
      return;
    }

    stopAllAppAudio();
    onRequestPlay(item.id);
    setLoading(true);
    setProgress(0);

    try {
      const { data } = await supabase
        .from('generations')
        .select('layers')
        .eq('id', item.id)
        .single();

      if (!data) {
        setLoading(false);
        onPlaybackEnd(item.id);
        return;
      }

      const layers = data.layers as GenerationResult;
      const allNotes = [
        ...(layers.melody ?? []),
        ...(layers.chords ?? []),
        ...(layers.bass ?? []),
        ...(layers.drums ?? []),
      ];
      const maxBeat = allNotes.length > 0
        ? Math.max(...allNotes.map(n => n.startTime + n.duration))
        : 16;
      const secondsPerBeat = 60 / Math.max(60, Math.min(200, item.bpm));
      durationRef.current = maxBeat * secondsPerBeat + 0.3;
      startTimeRef.current = Date.now();
      setLoading(false);

      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setProgress(Math.min(elapsed / durationRef.current, 1));
      }, 50);

      void playAll(
        {
          melody: layers.melody ?? [],
          chords: layers.chords ?? [],
          bass: layers.bass ?? [],
          drums: layers.drums ?? [],
        },
        item.bpm,
        item.genreKey,
        () => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setProgress(0);
          onPlaybackEnd(item.id);
        },
      );
    } catch {
      setLoading(false);
      onPlaybackEnd(item.id);
    }
  };

  const prompt = (item.prompt ?? '').trim();
  const promptShort = prompt.length > 86 ? `${prompt.slice(0, 86).trimEnd()}...` : (prompt || 'Untitled generation');
  const href = `/g/${item.id}`;
  const detailUrl = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(detailUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ScrollReveal delay={Math.min(idx % 6, 5) * 60}>
      <article
        className="relative h-full rounded-xl"
        style={{
          background: 'color-mix(in srgb, var(--surface) 88%, var(--surface-strong))',
          border: isPlaying ? '1px solid #FF6D3F' : '1px solid var(--border)',
          transition: 'border-color 180ms, transform 180ms',
          overflow: 'hidden',
          boxShadow: '0 18px 48px rgba(0,0,0,0.10)',
        }}
        onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)'; }}
        onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        <Link
          href={href}
          className="block p-5"
          style={{ textDecoration: 'none', paddingBottom: 70, position: 'relative', zIndex: 1 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p
                className="text-base font-semibold mb-3"
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                  lineHeight: 1.28,
                }}
                title={prompt || undefined}
              >
                {promptShort}
              </p>
              <div className="flex flex-wrap gap-2">
                <span
                  className="px-2 py-1 rounded-md text-xs"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent)',
                    background: 'rgba(255,109,63,0.10)',
                    border: '1px solid rgba(255,109,63,0.25)',
                  }}
                >
                  {item.genreLabel}
                </span>
                <span
                  className="px-2 py-1 rounded-md text-xs"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--muted)',
                    background: 'var(--surface-weak)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {item.bpm} BPM
                </span>
                {item.style_tag && (
                  <span
                    className="px-2 py-1 rounded-md text-xs"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--accent)',
                      background: 'rgba(255,109,63,0.1)',
                      border: '1px solid rgba(255,109,63,0.25)',
                    }}
                  >
                    {item.style_tag}
                  </span>
                )}
                {item.tags && item.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-md text-xs"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#8A8A9A',
                      background: '#1A1A2E',
                      border: '1px solid #1A1A2E',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <span
              className="text-xs flex-shrink-0"
              style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-micro)' }}
            >
              {item.timeAgo}
            </span>
          </div>
        </Link>

        <div
          className="absolute bottom-4 right-4 flex items-center gap-2"
          style={{ zIndex: 3 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: prompt ? 'var(--accent)' : 'var(--muted)',
              background: 'rgba(255,109,63,0.08)',
              border: '1px solid rgba(255,109,63,0.22)',
              cursor: prompt ? 'pointer' : 'not-allowed',
            }}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (!prompt) return;
              router.push(`/?prompt=${encodeURIComponent(prompt)}`);
            }}
            disabled={!prompt}
          >
            Use prompt
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              color: copied ? '#00B894' : 'var(--muted)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            aria-label="Copy pattern link"
            title={copied ? 'Copied' : 'Copy link'}
            onClick={handleCopyLink}
          >
            <CopyIcon />
          </button>
        </div>

        <button
          type="button"
          onClick={handlePlayClick}
          aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: isPlaying ? 'rgba(255,109,63,0.22)' : 'rgba(255,109,63,0.15)',
            border: '1px solid rgba(255,109,63,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            outline: 'none',
            zIndex: 3,
            pointerEvents: 'auto',
            transition: 'background 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,109,63,0.28)')}
          onMouseLeave={e => (e.currentTarget.style.background = isPlaying ? 'rgba(255,109,63,0.22)' : 'rgba(255,109,63,0.15)')}
        >
          {loading ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: isPlaying ? 'rgba(255,109,63,0.12)' : 'transparent',
            transition: 'background 180ms',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: '#FF6D3F',
              transition: 'width 50ms linear',
            }}
          />
        </div>
      </article>
    </ScrollReveal>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────

function formatTimeAgo(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── ACTIVE FILTER PILL ───────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: 'var(--accent)',
        background: 'rgba(255,109,63,0.1)',
        border: '1px solid rgba(255,109,63,0.3)',
        borderRadius: 20,
        padding: '3px 8px',
        cursor: 'pointer',
        outline: 'none',
        transition: 'background 150ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,109,63,0.18)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,109,63,0.1)')}
    >
      {label}
      <XIcon />
    </button>
  );
}

// ─── EXPLORE GALLERY ──────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

export function ExploreGallery({
  items: initialItems,
  genres,
}: {
  items: GalleryItem[];
  genres: Array<{ key: string; name: string }>;
}) {
  const [items, setItems] = useState<GalleryItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('');
  const [bpmMin, setBpmMin] = useState('');
  const [bpmMax, setBpmMax] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [tagFilter, setTagFilter] = useState('');

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSearchRef = useRef(search);

  const genreOptions = [
    { value: '', label: 'All genres' },
    ...genres.map(g => ({ value: g.key, label: g.name })),
  ];

  // ─── FETCH ──────────────────────────────────────────────────────

  const fetchItems = useCallback(async (opts: {
    search: string;
    genre: string;
    bpmMin: string;
    bpmMax: string;
    sortBy: string;
    tagFilter: string;
  }) => {
    setLoading(true);
    try {
      let query = supabase
        .from('generations')
        .select('id, prompt, genre, bpm, style_tag, tags, created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: opts.sortBy === 'oldest' })
        .limit(100);

      if (opts.search.trim()) {
        query = query.ilike('prompt', `%${opts.search.trim()}%`);
      }
      if (opts.genre) {
        query = query.eq('genre', opts.genre);
      }
      if (opts.bpmMin !== '' && !isNaN(Number(opts.bpmMin))) {
        query = query.gte('bpm', Number(opts.bpmMin));
      }
      if (opts.bpmMax !== '' && !isNaN(Number(opts.bpmMax))) {
        query = query.lte('bpm', Number(opts.bpmMax));
      }
      if (opts.tagFilter) {
        query = query.contains('tags', [opts.tagFilter]);
      }

      const { data } = await query;
      const rows = data ?? [];
      setItems(rows.map(row => ({
        id: row.id as string,
        prompt: (row.prompt as string | null) ?? null,
        genreKey: (row.genre as string) ?? '—',
        genreLabel: genres.find(g => g.key === row.genre)?.name ?? ((row.genre as string) ?? '—'),
        bpm: (row.bpm as number) ?? 0,
        style_tag: (row.style_tag as string | null) ?? null,
        tags: (row.tags as string[] | null) ?? null,
        created_at: row.created_at as string,
        timeAgo: formatTimeAgo(row.created_at as string),
        isExample: false,
      })));
    } finally {
      setLoading(false);
    }
  }, [genres]);

  // Trigger fetch whenever non-search filters change immediately
  useEffect(() => {
    fetchItems({ search: pendingSearchRef.current, genre, bpmMin, bpmMax, sortBy, tagFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, bpmMin, bpmMax, sortBy, tagFilter]);

  // Debounce search separately
  const handleSearchChange = (value: string) => {
    setSearch(value);
    pendingSearchRef.current = value;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchItems({ search: value, genre, bpmMin, bpmMax, sortBy, tagFilter });
    }, 320);
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  useEffect(() => subscribeToAudioStop(() => setPlayingId(null)), []);

  // ─── PLAYBACK ───────────────────────────────────────────────────

  const handleRequestPlay = useCallback((id: string) => {
    if (playingId && playingId !== id) stopAllAppAudio();
    setPlayingId(id);
  }, [playingId]);

  const handlePlaybackEnd = useCallback((id: string) => {
    setPlayingId(prev => (prev === id ? null : prev));
  }, []);

  // ─── FILTER PILLS ───────────────────────────────────────────────

  const activePills: { label: string; clear: () => void }[] = [];
  if (search.trim()) activePills.push({ label: `"${search.trim()}"`, clear: () => handleSearchChange('') });
  if (genre) activePills.push({ label: genres.find(g => g.key === genre)?.name ?? genre, clear: () => setGenre('') });
  if (bpmMin) activePills.push({ label: `BPM >= ${bpmMin}`, clear: () => setBpmMin('') });
  if (bpmMax) activePills.push({ label: `BPM <= ${bpmMax}`, clear: () => setBpmMax('') });
  if (tagFilter) activePills.push({ label: tagFilter, clear: () => setTagFilter('') });

  const hasActiveFilters = activePills.length > 0;

  // ─── INPUT STYLE ────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 12,
    color: 'var(--text)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '6px 10px',
    outline: 'none',
    height: 36,
    transition: 'border-color 150ms',
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mt-24 mb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="max-w-[680px]">
            <p
              className="mb-3 text-xs uppercase"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--muted)',
                letterSpacing: '0.08em',
              }}
            >
              Public patterns
            </p>
            <h1
              className="font-extrabold"
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
                color: 'var(--text)',
              }}
            >
              Browse MIDI ideas by sound, tempo, and prompt.
            </h1>
            <p style={{ color: 'var(--foreground-muted)', fontSize: 15, marginTop: 14, lineHeight: 1.65 }}>
              Preview public generations, open the full pattern, or send a prompt back into the generator as a starting point.
            </p>
          </div>

          {/* Mobile filter toggle */}
          <button
            type="button"
            className="flex sm:hidden items-center gap-2"
            onClick={() => setFiltersOpen(v => !v)}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: hasActiveFilters ? 'var(--accent)' : 'var(--muted)',
              background: hasActiveFilters ? 'rgba(255,109,63,0.1)' : 'var(--surface)',
              border: hasActiveFilters ? '1px solid rgba(255,109,63,0.3)' : '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <FilterIcon />
            Filters
            {hasActiveFilters && (
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#FF6D3F',
                  color: '#fff',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {activePills.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────── */}
        <div
          className={[
            'mt-6 flex-col gap-3 rounded-xl p-3 sm:flex sm:flex-row sm:items-center sm:flex-wrap',
            filtersOpen ? 'flex' : 'hidden sm:flex',
          ].join(' ')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.10)',
          }}
        >
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search prompts..."
            style={{ ...inputStyle, width: '100%', maxWidth: 280 }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.4)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />

          {/* Genre */}
          <CustomSelect
            value={genre}
            onChange={setGenre}
            options={genreOptions}
            style={{ minWidth: 148, fontSize: 12 }}
          />

          {/* BPM range */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={bpmMin}
              onChange={e => setBpmMin(e.target.value)}
              placeholder="BPM min"
              min={60}
              max={200}
              style={{ ...inputStyle, width: 88 }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.4)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>-</span>
            <input
              type="number"
              value={bpmMax}
              onChange={e => setBpmMax(e.target.value)}
              placeholder="BPM max"
              min={60}
              max={200}
              style={{ ...inputStyle, width: 88 }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.4)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Sort */}
          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            options={SORT_OPTIONS}
            style={{ minWidth: 140, fontSize: 12 }}
          />

          {/* Tags */}
          <CustomSelect
            value={tagFilter}
            onChange={setTagFilter}
            options={[
              { value: '', label: 'All tags' },
              { value: 'low energy', label: 'Low energy' },
              { value: 'mid energy', label: 'Mid energy' },
              { value: 'high energy', label: 'High energy' },
              { value: 'dark', label: 'Dark' },
              { value: 'euphoric', label: 'Euphoric' },
              { value: 'chill', label: 'Chill' },
              { value: 'groovy', label: 'Groovy' },
              { value: 'minimal', label: 'Minimal' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'complex', label: 'Complex' },
            ]}
            style={{ minWidth: 130, fontSize: 12 }}
          />

          {/* Result count */}
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: 'var(--muted)',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            {loading ? 'Loading' : `${items.length} patterns`}
          </span>
        </div>

        {/* ── Active filter pills ──────────────────────────────────── */}
        {activePills.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {activePills.map(pill => (
              <FilterPill key={pill.label} label={pill.label} onRemove={pill.clear} />
            ))}
            <button
              type="button"
              onClick={() => {
                handleSearchChange('');
                setGenre('');
                setBpmMin('');
                setBpmMax('');
                setTagFilter('');
              }}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'var(--muted)',
                background: 'transparent',
                border: 'none',
                padding: '3px 4px',
                cursor: 'pointer',
                outline: 'none',
                transition: 'color 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              Clear all
            </button>
          </div>
        )}

        <div className="mt-5" style={{ height: 1, background: 'var(--border)' }} />
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
        {loading && items.length === 0 && (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[220px] rounded-xl"
              style={{
                background: 'linear-gradient(90deg, var(--surface) 0%, var(--surface-strong) 50%, var(--surface) 100%)',
                border: '1px solid var(--border)',
                opacity: 0.65,
              }}
            />
          ))
        )}
        {!loading && items.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={<MusicEmptyIcon />}
              title={hasActiveFilters ? 'No patterns match these filters' : 'No public patterns yet'}
              subtitle={hasActiveFilters ? 'Loosen the search, BPM, genre, or tag controls.' : 'Public generations will appear here once producers publish them.'}
              actionLabel={hasActiveFilters ? 'Clear filters' : 'Open generator'}
              actionHref={hasActiveFilters ? undefined : '/'}
              onAction={hasActiveFilters ? () => {
                handleSearchChange('');
                setGenre('');
                setBpmMin('');
                setBpmMax('');
                setTagFilter('');
              } : undefined}
            />
          </div>
        )}
        {items.map((item, idx) => (
          <ExploreCard
            key={item.id}
            item={item}
            idx={idx}
            isPlaying={playingId === item.id}
            onRequestPlay={handleRequestPlay}
            onPlaybackEnd={handlePlaybackEnd}
          />
        ))}
      </div>
    </div>
  );
}
