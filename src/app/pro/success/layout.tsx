import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata: Metadata = {
  ...pageMeta({
    title: 'Pro activated',
    description:
      'Your pulp Pro subscription is active—higher generation limits and commercial use per your plan. Return to the app to keep creating MIDI.',
    path: '/pro/success',
  }),
  robots: { index: false, follow: true },
};

export default function ProSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
