import { siteUrl } from '@/lib/seo';

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'papaya',
      url: siteUrl,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#pulp`,
      name: 'pulp',
      applicationCategory: 'MusicApplication',
      operatingSystem: 'Web',
      url: siteUrl,
      description: 'Generate editable MIDI from a text prompt.',
      publisher: { '@id': `${siteUrl}/#organization` },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  ],
};

export function SiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
