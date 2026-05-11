import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
      '/api/',
      '/dashboard/',
      '/profile/',
      '/settings/',
      '/sign-in/',
      '/pro/',
      '/papaya-site/',
      '/embed/',
      '/generate/',
      '/transcribe/',
    ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
