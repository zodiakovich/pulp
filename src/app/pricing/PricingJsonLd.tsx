import { siteUrl } from '@/lib/seo';

/** Product + Offer list aligned with pricing plans (USD, monthly). */
export function PricingJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'pulp',
    description: 'AI MIDI generation with monthly generation limits by plan.',
    brand: { '@type': 'Brand', name: 'papaya' },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
        url: `${siteUrl}/pricing`,
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '7',
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
        url: `${siteUrl}/pricing`,
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Studio',
        price: '19',
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
        url: `${siteUrl}/pricing`,
        availability: 'https://schema.org/InStock',
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
