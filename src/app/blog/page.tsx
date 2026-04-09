import { Navbar } from '@/components/Navbar';

const TAG_COLORS: Record<string, string> = {
  Theory: '#A78BFA',
  Production: '#FF6D3F',
  Tutorial: '#00B894',
  Genre: '#8A8A9A',
};

const FEATURED = {
  title: 'Afro House Chord Progressions: The Complete Guide for Electronic Producers',
  excerpt: 'Learn the minor 7th voicings, syncopated rhythms, and modal harmony that define the Afro House sound. With MIDI examples you can drop straight into your DAW.',
  tag: 'Theory',
  readTime: '8 min read',
  date: 'Apr 7, 2026',
} as const;

const POSTS = [
  {
    title: 'Tech House Basslines: 5 Patterns That Work Every Time',
    excerpt: 'From driving 16th-note grooves to syncopated subs — the bassline formulas behind every Tech House peak-time banger.',
    tag: 'Production',
    readTime: '5 min read',
    date: 'Mar 31, 2026',
  },
  {
    title: 'How to Use MIDI in FL Studio: Layer by Layer',
    excerpt: 'A step-by-step guide to importing and arranging multi-track MIDI files in FL Studio. From the Channel Rack to the Mixer.',
    tag: 'Tutorial',
    readTime: '6 min read',
    date: 'Mar 24, 2026',
  },
  {
    title: 'Melodic Techno Scales: Why Phrygian Dominates the Genre',
    excerpt: 'The exotic tension of the Phrygian mode explained for producers. Why Charlotte de Witte, Alignment, and Anyma keep coming back to it.',
    tag: 'Theory',
    readTime: '4 min read',
    date: 'Mar 17, 2026',
  },
  {
    title: 'Deep House vs Tech House: The Production Differences Explained',
    excerpt: 'BPM, groove, chord complexity, bass character — a technical breakdown of what separates these two genres at the production level.',
    tag: 'Genre',
    readTime: '5 min read',
    date: 'Mar 10, 2026',
  },
  {
    title: 'The Humanization Parameter: Why Perfect MIDI Sounds Wrong',
    excerpt: 'Why quantized-to-the-grid MIDI sounds robotic, and how micro-timing variations create the groove that makes people move.',
    tag: 'Production',
    readTime: '3 min read',
    date: 'Mar 3, 2026',
  },
] as const;

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="blog" />

      <main className="pt-24 pb-16 px-8">
        <div className="max-w-[1280px] mx-auto">
          {/* Header */}
          <h1
            className="font-extrabold text-gradient"
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            The Pulp Blog
          </h1>
          <p className="mt-3" style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--muted)', maxWidth: 720, lineHeight: 1.7 }}>
            Production tips, genre breakdowns, and music theory for electronic producers.
          </p>

          {/* Featured */}
          <div
            className="mt-10 rounded-2xl p-8 transition-colors bg-[var(--surface)] border border-[color:var(--border)] hover:border-[#FF6D3F]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2 py-1 rounded-md text-xs"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#FF6D3F',
                      background: 'rgba(255,109,63,0.10)',
                      border: '1px solid rgba(255,109,63,0.25)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Featured
                  </span>
                  <span
                    className="px-2 py-1 rounded-md text-xs"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: TAG_COLORS[FEATURED.tag] ?? '#FF6D3F',
                      background: `${(TAG_COLORS[FEATURED.tag] ?? '#FF6D3F')}18`,
                      border: `1px solid ${(TAG_COLORS[FEATURED.tag] ?? '#FF6D3F')}33`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {FEATURED.tag}
                  </span>
                </div>

                <div
                  className="mt-4"
                  style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, letterSpacing: '-0.015em', lineHeight: 1.15 }}
                >
                  {FEATURED.title}
                </div>

                <p className="mt-4" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--foreground-muted)', lineHeight: 1.7, maxWidth: 880 }}>
                  {FEATURED.excerpt}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span
                  className="px-2 py-1 rounded-md text-xs"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#FF6D3F',
                    border: '1px solid rgba(255,109,63,0.25)',
                    background: 'rgba(255,109,63,0.10)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Coming soon
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(138,138,154,0.55)' }}>
                  {FEATURED.date} · {FEATURED.readTime}
                </span>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {POSTS.map(p => {
              const tagColor = TAG_COLORS[p.tag] ?? '#FF6D3F';
              return (
                <div
                  key={p.title}
                  className="rounded-2xl p-6 transition-colors bg-[var(--surface)] border border-[color:var(--border)] hover:border-[#FF6D3F] relative"
                >
                  <span
                    className="absolute top-4 right-4 px-2 py-1 rounded-md text-xs"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#FF6D3F',
                      border: '1px solid rgba(255,109,63,0.25)',
                      background: 'rgba(255,109,63,0.10)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Coming soon
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-1 rounded-md text-xs"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        color: tagColor,
                        background: `${tagColor}18`,
                        border: `1px solid ${tagColor}33`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.tag}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(138,138,154,0.55)' }}>
                      {p.date} · {p.readTime}
                    </span>
                  </div>

                  <div className="mt-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                    {p.title}
                  </div>

                  <p className="mt-3" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--foreground-muted)', lineHeight: 1.7 }}>
                    {p.excerpt}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Subscribe */}
          <div className="mt-10 rounded-2xl p-8 bg-[var(--surface)] border border-[color:var(--border)]">
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>
              New articles every Monday. Subscribe to get notified.
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                type="email"
                placeholder="you@studio.com"
                className="h-11 rounded-xl px-4 text-sm"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  fontFamily: 'JetBrains Mono, monospace',
                  flex: 1,
                  minWidth: 220,
                }}
              />
              <button
                type="button"
                className="h-11 px-5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: '#FF6D3F',
                  border: '1px solid rgba(255,109,63,0.45)',
                  color: '#fff',
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                Subscribe
              </button>
            </div>
            <p className="mt-3" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(138,138,154,0.55)' }}>
              No spam. Just production notes and new posts.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

