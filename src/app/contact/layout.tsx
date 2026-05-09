import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Contact',
  description: 'Get in touch with the pulp team — live chat support and FAQ for questions about exports, plans, billing, and DAW compatibility.',
  path: '/contact',
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
