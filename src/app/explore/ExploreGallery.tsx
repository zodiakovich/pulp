'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

export function ExploreGallery({
  items,
  genres,
  seedMode,
}: {
  items: GalleryItem[];
  genres: Array<{ key: string; name: string }>;
  seedMode: boolean;
}) {
  const router = useRouter();
  const [selectedGenre, setSelectedGenre] = useState<(typeof EXPLORE_GENRES)[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGenerations = useMemo(() => {
    return items.filter(g => {
      const matchesGenre = selectedGenre === 'All' || (g.genreLabel ?? '').toLowerCase().includes(selectedGenre.toLowerCase());
      const matchesSearch = !searchQuery || (g.prompt ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGenre && matchesSearch;
    });
  }, [items, selectedGenre, searchQuery]);

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

      {seedMode && (
        <p
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--text-micro)',
            marginBottom: 24,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          example generations
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
        {filteredGenerations.length === 0 && !seedMode && (
          <div
            className="rounded-2xl p-8 lg:col-span-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
              No generations yet. Be the first to create one.
            </div>
            <p className="mt-2" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              Start from a simple prompt like “tech house, 128bpm, Am” and generate three variations.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center mt-5 h-10 px-4 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--accent)',
                border: '1px solid rgba(255,109,63,0.45)',
                color: 'var(--bg)',
                textDecoration: 'none',
                width: 'fit-content',
              }}
            >
              Start generating
            </Link>
          </div>
        )}
        {filteredGenerations.map(item => {
          const prompt = (item.prompt ?? '').trim();
          const promptShort =
            prompt.length > 60 ? `${prompt.slice(0, 60).trimEnd()}…` : (prompt || '—');
          const href = item.isExample ? '/' : `/g/${item.id}`;

          return (
            <Link
              key={item.id}
              href={href}
              className="block rounded-2xl p-6 transition-all"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {item.isExample && (
                    <span
                      className="inline-flex px-2 py-0.5 rounded-md mb-2"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 9,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--muted)',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-weak)',
                      }}
                    >
                      example
                    </span>
                  )}
                  <p
                    className="text-sm font-semibold mb-2"
                    style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}
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
                        textDecoration: 'none',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: prompt ? 'pointer' : 'not-allowed',
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!prompt) return;
                        router.push(`/?prompt=${encodeURIComponent(prompt)}`);
                      }}
                      disabled={!prompt}
                    >
                      Use this prompt →
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
          );
        })}
      </div>
    </div>
  );
}

