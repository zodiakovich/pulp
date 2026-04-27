'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { ScrollReveal } from '@/components/ScrollReveal';
import { supabase } from '@/lib/supabase';
import { playAll, stopPlayAll } from '@/lib/tone-lazy';
import type { GenerationResult } from '@/lib/music-engine';

const EXPLORE_GENRES = ['All', 'Tech House', 'Afro House', 'Melodic Techno', 'Deep House', 'Hard Techno', 'Melodic House', 'Techno', 'Trance', 'Drum & Bass'] as const;

type GalleryItem = {
  id: string;
  prompt: string | null;
  genreKey: string;
  genreLabel: string;
  bpm: number;
  style_tag: string | null;
  created_at: string;
  timeAgo: string;
  isExample: boolean;
};

function MusicEmptyIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" role="presentation">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ─── PLAY BUTTON ICONS ────────────────────────────────────────────

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(16);
  const router = useRouter();

  // Clean up when this card stops being the active one
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
      stopPlayAll();
      onPlaybackEnd(item.id);
      return;
    }

    // Signal parent to stop any currently playing card and mark this one active
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

      // Estimate total duration from the note data
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

      // Tick progress
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
  const promptShort = prompt.length > 60 ? `${prompt.slice(0, 60).trimEnd()}...` : (prompt || '-');
  const href = `/g/${item.id}`;

  return (
    <ScrollReveal delay={Math.min(idx % 6, 5) * 60}>
      <div
        className="relative rounded-2xl h-full"
        style={{
          background: 'var(--surface)',
          border: isPlaying ? '1px solid #FF6D3F' : '1px solid var(--border)',
          transition: 'border-color 180ms',
          overflow: 'hidden',
        }}
        onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)'; }}
        onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        {/* Card body — clicking navigates to the generation detail page */}
        <Link
          href={href}
          className="block p-6"
          style={{ textDecoration: 'none', paddingBottom: 56 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p
                className="text-sm font-semibold mb-2"
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                  lineHeight: 1.2,
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
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-xs"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent)',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: prompt ? 'pointer' : 'not-allowed',
                  }}
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!prompt) return;
                    router.push(`/generate?prompt=${encodeURIComponent(prompt)}`);
                  }}
                  disabled={!prompt}
                >
                  Use this prompt
                </button>
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

        {/* Play / pause button — bottom-left, does not navigate */}
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
            zIndex: 2,
            transition: 'background 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,109,63,0.28)')}
          onMouseLeave={e => (e.currentTarget.style.background = isPlaying ? 'rgba(255,109,63,0.22)' : 'rgba(255,109,63,0.15)')}
        >
          {loading ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Progress bar — 2px at the very bottom of the card */}
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
      </div>
    </ScrollReveal>
  );
}

// ─── EXPLORE GALLERY ──────────────────────────────────────────────

export function ExploreGallery({
  items,
  genres,
}: {
  items: GalleryItem[];
  genres: Array<{ key: string; name: string }>;
}) {
  const [selectedGenre, setSelectedGenre] = useState<(typeof EXPLORE_GENRES)[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const filteredGenerations = useMemo(() => {
    return items.filter(g => {
      const matchesGenre = selectedGenre === 'All' || (g.genreLabel ?? '').toLowerCase().includes(selectedGenre.toLowerCase());
      const matchesSearch = !searchQuery || (g.prompt ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGenre && matchesSearch;
    });
  }, [items, selectedGenre, searchQuery]);

  const handleRequestPlay = useCallback((id: string) => {
    if (playingId && playingId !== id) stopPlayAll();
    setPlayingId(id);
  }, [playingId]);

  const handlePlaybackEnd = useCallback((id: string) => {
    setPlayingId(prev => (prev === id ? null : prev));
  }, []);

  const isFiltered = searchQuery.length > 0 || selectedGenre !== 'All';
  const emptyTitle = isFiltered ? 'No patterns match your filter' : 'Nothing here yet';
  const emptySubtitle = isFiltered ? 'Try a different genre or search term' : 'Be the first to share a generation';

  return (
    <div className="max-w-[1280px] mx-auto px-8">
      {/* Filter bar */}
      <div
        className="mt-20 mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}
      >
        <div>
          <h1
            className="font-extrabold text-gradient"
            style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            Explore
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 8 }}>
            A public gallery of recent generations.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search prompts..."
              className="input-field"
              style={{ height: 40, fontSize: 13, maxWidth: 280 }}
            />
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
              {filteredGenerations.length} patterns
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {EXPLORE_GENRES.map(genre => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  border: selectedGenre === genre ? '1px solid rgba(255,109,63,0.45)' : '1px solid var(--border)',
                  background: selectedGenre === genre ? 'rgba(255,109,63,0.1)' : 'transparent',
                  color: selectedGenre === genre ? 'var(--accent)' : 'var(--foreground-muted)',
                }}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
        {filteredGenerations.length === 0 && (
          <EmptyState
            icon={<MusicEmptyIcon />}
            title={emptyTitle}
            subtitle={emptySubtitle}
            actionLabel={isFiltered ? undefined : 'Start generating'}
            actionHref={isFiltered ? undefined : '/'}
          />
        )}
        {filteredGenerations.map((item, idx) => (
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
