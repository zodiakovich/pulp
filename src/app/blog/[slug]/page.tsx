import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabase';
import { articlePageMeta } from '@/lib/seo-metadata';
import { ArticleJsonLd } from './ArticleJsonLd';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';

export const revalidate = 3600;

type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  read_time: string;
  published_at: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Pre-render known posts at build; new posts appear after revalidate window. */
export async function generateStaticParams() {
  try {
    const { data } = await supabase.from('blog_posts').select('slug');
    return (data ?? []).map((row: { slug: string }) => ({ slug: row.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, published_at')
    .eq('slug', slug)
    .single();

  if (!data) return { title: 'Blog post' };

  return articlePageMeta({
    title: data.title,
    description: data.excerpt,
    path: `/blog/${data.slug}`,
    publishedTime: data.published_at,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, content, read_time, published_at')
    .eq('slug', slug)
    .single();

  if (!data) notFound();
  const post = data as BlogPost;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <ArticleJsonLd
        slug={post.slug}
        title={post.title}
        excerpt={post.excerpt}
        publishedAt={post.published_at}
      />
      <Navbar active="blog" />
      <div className="mx-auto px-8 pt-24 pb-16" style={{ maxWidth: 720 }}>
        <Link href="/blog" style={{ textDecoration: 'none', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          ← Back to blog
        </Link>

        <h1 className="mt-6" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {post.title}
        </h1>
        <p className="mt-3" style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
          {post.excerpt}
        </p>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
            {formatDate(post.published_at)}
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
            {post.read_time}
          </span>
        </div>

        <article
          className="mt-10 rounded-2xl p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ color: 'var(--text)' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: (props) => <h2 {...props} style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 28 }} />,
                h3: (props) => <h3 {...props} style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 22 }} />,
                p: (props) => <p {...props} style={{ color: 'var(--muted)', lineHeight: 1.9, marginTop: 12 }} />,
                li: (props) => <li {...props} style={{ color: 'var(--muted)', lineHeight: 1.9, marginTop: 6 }} />,
                a: (props) => <a {...props} style={{ color: 'var(--accent)', textDecoration: 'none' }} />,
                code: (props) => (
                  <code
                    {...props}
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                      background: 'color-mix(in srgb, var(--surface) 70%, black)',
                      border: '1px solid var(--border)',
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}
                  />
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        </article>

        {/* CTA */}
        <div
          className="mt-10 rounded-2xl p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(255,109,63,0.10) 0%, rgba(255,109,63,0.04) 100%)',
            border: '1px solid rgba(255,109,63,0.25)',
          }}
        >
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Try it yourself
          </p>
          <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)', marginBottom: 8 }}>
            Generate MIDI from a text prompt — free to start.
          </p>
          <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 20 }}>
            Describe a genre, mood, or reference. pulp gives you melody, chords, bass, and drums — ready to drag into your DAW.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 44,
                padding: '0 20px',
                borderRadius: 10,
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 500,
                fontSize: 14,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Open generator →
            </Link>
            <Link
              href="/pricing"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 44,
                padding: '0 20px',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--muted)',
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 500,
                fontSize: 14,
                textDecoration: 'none',
                border: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}
            >
              See pricing
            </Link>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Link href="/blog" style={{ textDecoration: 'none', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            ← All articles
          </Link>
          <Link href="/blog" style={{ textDecoration: 'none', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            More from the blog →
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

