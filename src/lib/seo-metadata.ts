import type { Metadata } from 'next';
import { ogImagePath, pageTitle, siteUrl } from '@/lib/seo';

const ogAlt = 'pulp — AI MIDI Generator';

export type PageMetaInput = {
  /** Short segment for <title> (template adds suffix) */
  title: string;
  /** ~150–160 chars */
  description: string;
  /** Path starting with / */
  path: string;
};

/**
 * Unique title, description, canonical, Open Graph, and Twitter for public pages.
 * Root layout `title.template` turns `title` into "Segment — pulp | AI MIDI Generator".
 */
export function pageMeta({ title, description, path }: PageMetaInput): Metadata {
  const url = `${siteUrl}${path === '/' ? '' : path}`;
  const ogTitle = pageTitle(title);

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: ogTitle,
      description,
      url,
      siteName: 'pulp',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: ogImagePath,
          width: 1200,
          height: 630,
          alt: ogAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [ogImagePath],
    },
  };
}

/** Blog posts: `article` Open Graph type + published time. */
export function articlePageMeta(
  input: PageMetaInput & { publishedTime: string; modifiedTime?: string },
): Metadata {
  const base = pageMeta(input);
  const og = base.openGraph;
  if (!og || typeof og !== 'object' || Array.isArray(og)) return base;

  return {
    ...base,
    openGraph: {
      ...og,
      type: 'article',
      publishedTime: input.publishedTime,
      modifiedTime: input.modifiedTime ?? input.publishedTime,
    },
  };
}
