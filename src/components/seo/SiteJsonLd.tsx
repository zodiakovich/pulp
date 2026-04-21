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
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#pulp`,
      name: 'pulp',
      url: siteUrl,
      description: 'AI MIDI generator for music producers. Generate melody, chords, bass, and drums from text prompts.',
      applicationCategory: 'MusicApplication',
      operatingSystem: 'Web',
      publisher: { '@id': `${siteUrl}/#organization` },
      offers: [
        {
          '@type': 'Offer',
          name: 'Free',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Pro',
          price: '7',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Studio',
          price: '19',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      ],
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
