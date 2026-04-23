'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { ScrollReveal } from '@/components/ScrollReveal';

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

export function ExploreGallery({
  items,
  genres,
}: {
  items: GalleryItem[];
  genres: Array<{ key: string; name: string }>;
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
        {filteredGenerations.map((item, idx) => {
          const prompt = (item.prompt ?? '').trim();
          const promptShort =
            prompt.length > 60 ? `${prompt.slice(0, 60).trimEnd()}...` : (prompt || '-');
          const href = `/g/${item.id}`;

          return (
            <ScrollReveal key={item.id} delay={Math.min(idx % 6, 5) * 60}>
              <Link
                href={href}
                className="block rounded-2xl p-6 transition-all h-full"
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
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  );
}
