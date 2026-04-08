'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type GalleryItem = {
  id: string;
  prompt: string | null;
  genre: string;
  bpm: number;
  style_tag: string | null;
  created_at: string;
  timeAgo: string;
};

export function ExploreGallery({
  items,
  genres,
}: {
  items: GalleryItem[];
  genres: Array<{ key: string; name: string }>;
}) {
  const [genreFilter, setGenreFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (genreFilter === 'all') return items;
    return items.filter(i => i.genre === genreFilter);
  }, [items, genreFilter]);

  return (
    <div className="max-w-[1280px] mx-auto px-8">
      {/* Filter bar */}
      <div
        className="mt-20 mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        style={{ borderBottom: '1px solid #1A1A2E', paddingBottom: 16 }}
      >
        <div>
          <h1
            className="font-extrabold text-gradient"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            Explore
          </h1>
          <p style={{ color: '#8A8A9A', fontSize: 14, marginTop: 8 }}>
            A public gallery of recent generations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-xs uppercase tracking-widest"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}
          >
            Genre
          </span>
          <select
            value={genreFilter}
            onChange={e => setGenreFilter(e.target.value)}
            className="h-10 rounded-xl px-3 text-sm"
            style={{
              background: '#111118',
              border: '1px solid #1A1A2E',
              color: '#F0F0FF',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <option value="all">All</option>
            {genres.map(g => (
              <option key={g.key} value={g.key}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
        {filtered.length === 0 && (
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
        {filtered.map(item => {
          const prompt = (item.prompt ?? '').trim();
          const promptShort =
            prompt.length > 40 ? `${prompt.slice(0, 40).trimEnd()}…` : (prompt || '—');

          return (
            <Link
              key={item.id}
              href={`/g/${item.id}`}
              className="block rounded-2xl p-6 transition-all"
              style={{
                background: '#111118',
                border: '1px solid #1A1A2E',
                textDecoration: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1A1A2E')}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
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
                        color: '#8A8A9A',
                        background: '#0D0D12',
                        border: '1px solid #1A1A2E',
                      }}
                    >
                      {item.genre}
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

