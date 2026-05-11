import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { pageMeta } from '@/lib/seo-metadata';
import { supabase } from '@/lib/supabase';

export const revalidate = 3600;

export const metadata = pageMeta({
  title: 'Blog',
  description:
    'Production tips, genre breakdowns, and music theory for electronic producers—MIDI-focused articles from the pulp team.',
  path: '/blog',
});

type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  tag: string;
  read_time: string;
  published_at: string;
};

const TAG_COLORS: Record<string, string> = {
  Theory: '#FF6D3F',
  Production: '#FF6D3F',
  Tutorial: 'var(--muted)',
  Genre: 'var(--muted)',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function BlogIndexPage() {
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, tag, read_time, published_at')
    .order('published_at', { ascending: false })
    .limit(20);

  const posts: BlogPost[] = data ?? [];
  const featured = posts[0] ?? null;
  const rest = posts.slice(1);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="blog" />

      <main className="pt-24 pb-16 px-8">
        <div className="max-w-[1280px] mx-auto">
          {/* Header */}
          <h1
            className="font-extrabold text-gradient"
            style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            The Pulp Blog
          </h1>
          <p className="mt-3" style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--muted)', maxWidth: 720, lineHeight: 1.7 }}>
            Production tips, genre breakdowns, and music theory for electronic producers.
          </p>

          {/* Featured */}
          {featured && (
            <Link href={`/blog/${featured.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="mt-10 rounded-2xl p-8 transition-colors bg-[var(--surface)] border border-[color:var(--border)] hover:border-[color:var(--accent)] cursor-pointer">
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
                          color: TAG_COLORS[featured.tag] ?? '#FF6D3F',
                          background: `${(TAG_COLORS[featured.tag] ?? '#FF6D3F')}18`,
                          border: `1px solid ${(TAG_COLORS[featured.tag] ?? '#FF6D3F')}33`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {featured.tag}
                      </span>
                    </div>

                    <div
                      className="mt-4"
                      style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1.2 }}
                    >
                      {featured.title}
                    </div>

                    <p className="mt-4" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--foreground-muted)', lineHeight: 1.7, maxWidth: 880 }}>
                      {featured.excerpt}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(138,138,154,0.55)', whiteSpace: 'nowrap' }}>
                      {formatDate(featured.published_at)} · {featured.read_time}
                    </span>
                    <span
                      className="px-2 py-1 rounded-md text-xs"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--accent)',
                        border: '1px solid rgba(255,109,63,0.25)',
                        background: 'rgba(255,109,63,0.08)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Read →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map(p => {
                const tagColor = TAG_COLORS[p.tag] ?? '#FF6D3F';
                return (
                  <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="rounded-2xl p-6 transition-colors bg-[var(--surface)] border border-[color:var(--border)] hover:border-[color:var(--accent)] h-full">
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
                          {formatDate(p.published_at)} · {p.read_time}
                        </span>
                      </div>

                      <div className="mt-4" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                        {p.title}
                      </div>

                      <p className="mt-3" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--foreground-muted)', lineHeight: 1.7 }}>
                        {p.excerpt}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {posts.length === 0 && (
            <div className="mt-16 text-center" style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
              Articles coming soon.
            </div>
          )}

          {/* Subscribe */}
          <div className="mt-10 rounded-2xl p-8 bg-[var(--surface)] border border-[color:var(--border)]">
            <div style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              New articles every week. Subscribe to get notified.
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
                  background: 'var(--accent)',
                  border: '1px solid rgba(255,109,63,0.45)',
                  color: 'var(--on-accent)',
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
      <SiteFooter />
    </div>
  );
}
