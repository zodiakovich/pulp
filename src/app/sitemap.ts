import type { MetadataRoute } from 'next';

const base = 'https://pulp-4ubq.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/explore`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/build`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];
}
