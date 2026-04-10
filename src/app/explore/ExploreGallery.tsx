'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

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
        style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}
      >
        <div>
          <h1
            className="font-extrabold text-gradient"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1.1 }}
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
                  border: selectedGenre === genre ? '1px solid #FF6D3F' : '1px solid var(--border)',
                  background: selectedGenre === genre ? 'rgba(255,109,63,0.1)' : 'transparent',
                  color: selectedGenre === genre ? '#FF6D3F' : 'var(--foreground-muted)',
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
            color: 'rgba(138,138,154,0.55)',
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
            style={{ background: '#111118', border: '1px solid #1A1A2E' }}
          >
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'rgba(240,240,255,0.92)' }}>
              No generations yet. Be the first to create one.
            </div>
            <p className="mt-2" style={{ color: '#8A8A9A', lineHeight: 1.7 }}>
              Start from a simple prompt like “tech house, 128bpm, Am” and generate three variations instantly.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center mt-5 h-10 px-4 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: '#FF6D3F',
                border: '1px solid rgba(255,109,63,0.45)',
                color: '#fff',
                textDecoration: 'none',
                width: 'fit-content',
              }}
            >
              Start generating →
            </Link>
          </div>
        )}
        {filteredGenerations.map(item => {
          const prompt = (item.prompt ?? '').trim();
          const promptShort =
            prompt.length > 60 ? `${prompt.slice(0, 60).trimEnd()}…` : (prompt || '—');
          const href = item.isExample ? '/' : `/g/${item.id}`;
          const usePromptHref = prompt ? `/?prompt=${encodeURIComponent(prompt)}` : '/';

          return (
            <Link
              key={item.id}
              href={href}
              className="block rounded-2xl p-6 transition-all"
              style={{
                background: '#111118',
                border: '1px solid #1A1A2E',
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
                        color: 'rgba(138,138,154,0.65)',
                        background: 'rgba(138,138,154,0.08)',
                        border: '1px solid rgba(138,138,154,0.18)',
                      }}
                    >
                      example
                    </span>
                  )}
                  <p
                    className="text-sm font-semibold mb-2"
                    style={{ fontFamily: 'Syne, sans-serif', color: 'rgba(240,240,255,0.92)' }}
                    title={prompt || undefined}
                  >
                    {promptShort}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="px-2 py-1 rounded-md text-xs"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#FF6D3F',
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
                        color: '#8A8A9A',
                        background: '#0D0D12',
                        border: '1px solid #1A1A2E',
                      }}
                    >
                      {item.bpm} BPM
                    </span>
                    {item.style_tag && (
                      <span
                        className="px-2 py-1 rounded-md text-xs"
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#FF6D3F',
                          background: 'rgba(255,109,63,0.1)',
                          border: '1px solid rgba(255,109,63,0.25)',
                        }}
                      >
                        {item.style_tag}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <Link
                      href={usePromptHref}
                      className="inline-flex items-center gap-2 text-xs"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#FF6D3F',
                        textDecoration: 'none',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Use this prompt →
                    </Link>
                  </div>
                </div>
                <span
                  className="text-xs flex-shrink-0"
                  style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}
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

