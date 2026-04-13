import { siteUrl } from '@/lib/seo';

type Props = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
};

export function ArticleJsonLd({ slug, title, excerpt, publishedAt }: Props) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: excerpt,
    datePublished: publishedAt,
    author: { '@type': 'Organization', name: 'papaya' },
    publisher: { '@id': `${siteUrl}/#organization` },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/blog/${slug}`,
    },
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
