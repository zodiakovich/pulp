import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabase';

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

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, published_at')
    .eq('slug', slug)
    .single();

  if (!data) return { title: 'Blog — pulp' };

  const title = `${data.title} — pulp`;
  const desc = data.excerpt;
  const url = `https://pulp-4ubq.vercel.app/blog/${data.slug}`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
    },
  };
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
    <div className="min-h-screen px-8 pt-24 pb-16" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <Link href="/blog" style={{ textDecoration: 'none', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          ← Back to blog
        </Link>

        <h1 className="mt-6" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em' }}>
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
                h2: (props) => <h2 {...props} style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, marginTop: 28 }} />,
                h3: (props) => <h3 {...props} style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, marginTop: 22 }} />,
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
      </div>
    </div>
  );
}

