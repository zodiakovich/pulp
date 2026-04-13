import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { siteUrl } from '@/lib/seo';

const publicStatic: {
  path: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/changelog', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/docs', changeFrequency: 'monthly', priority: 0.65 },
  { path: '/docs/getting-started', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/docs/daw-setup', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/docs/piano-roll', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/docs/mix-engine', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.55 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.55 },
  { path: '/cookies', changeFrequency: 'yearly', priority: 0.45 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = publicStatic.map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  let blogEntries: MetadataRoute.Sitemap = [];
  let generationEntries: MetadataRoute.Sitemap = [];

  try {
    const { data: posts } = await supabase.from('blog_posts').select('slug, published_at');
    if (posts?.length) {
      blogEntries = posts.map(p => ({
        url: `${siteUrl}/blog/${p.slug}`,
        lastModified: p.published_at ? new Date(p.published_at) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.75,
      }));
    }
  } catch {
    /* build-time or env: skip dynamic URLs */
  }

  try {
    const { data: gens } = await supabase.from('generations').select('id, created_at').eq('is_public', true);
    if (gens?.length) {
      generationEntries = gens.map(g => ({
        url: `${siteUrl}/g/${g.id}`,
        lastModified: g.created_at ? new Date(g.created_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.55,
      }));
    }
  } catch {
    /* skip */
  }

  return [...staticEntries, ...blogEntries, ...generationEntries];
}
