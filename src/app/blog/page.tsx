import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  read_time: string;
  published_at: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function BlogIndexPage() {
  const { data } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, read_time, published_at')
    .order('published_at', { ascending: false });

  const posts = (data ?? []) as BlogPost[];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-gradient font-extrabold text-xl"
            style={{ fontFamily: 'Syne, sans-serif', textDecoration: 'none' }}
          >
            pulp
          </Link>
          <div className="flex items-center gap-8 text-sm" style={{ color: 'var(--muted)' }}>
            <Link href="/" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Create
            </Link>
            <Link href="/explore" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Explore
            </Link>
            <Link href="/build" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Build
            </Link>
            <Link href="/blog" className="transition-colors" style={{ color: 'var(--text)', textDecoration: 'none' }}>
              Blog
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Pricing
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-8">
        <div className="max-w-[1280px] mx-auto">
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.08em' }}>
            PULP BLOG
          </p>
          <h1
            className="mt-2"
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(34px,4.2vw,52px)', letterSpacing: '-0.02em' }}
          >
            Practical MIDI tips for producers.
          </h1>
          <p className="mt-3" style={{ color: 'var(--muted)', maxWidth: 640 }}>
            Short, actionable posts about genres, chord progressions, workflow, and getting the most out of AI MIDI.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map(p => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="rounded-2xl p-6 transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                      color: 'var(--muted)',
                    }}
                  >
                    {formatDate(p.published_at)}
                  </span>
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                      color: 'var(--purple)',
                      border: '1px solid rgba(167,139,250,0.35)',
                      background: 'rgba(167,139,250,0.10)',
                      padding: '4px 8px',
                      borderRadius: 8,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.read_time}
                  </span>
                </div>
                <div className="mt-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18 }}>
                  {p.title}
                </div>
                <div className="mt-2" style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
                  {p.excerpt}
                </div>
                <div className="mt-4" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--accent)' }}>
                  Read →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

