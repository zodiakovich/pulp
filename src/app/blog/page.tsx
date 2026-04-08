import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

const PLACEHOLDER_POSTS = [
  {
    title: 'Afro House Chord Progressions: The Complete Guide',
    date: 'Apr 6, 2026',
    readTime: '3 min read',
  },
  {
    title: 'How to Use MIDI in FL Studio: Layer by Layer',
    date: 'Apr 1, 2026',
    readTime: '3 min read',
  },
  {
    title: 'Tech House Basslines: 5 Patterns That Work Every Time',
    date: 'Mar 30, 2026',
    readTime: '3 min read',
  },
] as const;

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="blog" />

      <main className="pt-24 pb-16 px-8">
        <div className="max-w-[1280px] mx-auto">
          <h1
            className="font-extrabold text-gradient"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            The Pulp Blog
          </h1>
          <p className="mt-3" style={{ color: 'var(--muted)', maxWidth: 720, lineHeight: 1.7 }}>
            Production tips, genre breakdowns, and music theory for electronic producers.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLACEHOLDER_POSTS.map(p => (
              <div
                key={p.title}
                className="rounded-2xl p-6 transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>{p.date}</span>
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 12,
                        color: 'var(--muted)',
                        border: '1px solid var(--border)',
                        background: 'color-mix(in srgb, var(--bg) 55%, transparent)',
                        padding: '4px 8px',
                        borderRadius: 8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.readTime}
                    </span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 12,
                        color: '#FF6D3F',
                        border: '1px solid rgba(255,109,63,0.25)',
                        background: 'rgba(255,109,63,0.10)',
                        padding: '4px 8px',
                        borderRadius: 8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Coming soon
                    </span>
                  </div>
                </div>

                <div className="mt-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
                  {p.title}
                </div>

                <div className="mt-4" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(138,138,154,0.65)' }}>
                  New articles are generating now.
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-10 rounded-2xl p-8"
            style={{
              background: 'rgba(255,109,63,0.06)',
              border: '1px solid rgba(255,109,63,0.18)',
            }}
          >
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18 }}>Articles drop every Monday. Check back soon.</div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: '#FF6D3F',
                  border: '1px solid rgba(255,109,63,0.45)',
                  color: '#fff',
                  textDecoration: 'none',
                }}
              >
                Start generating →
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  textDecoration: 'none',
                }}
              >
                Go Pro →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

