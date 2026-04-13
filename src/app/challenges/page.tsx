import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Challenges',
  description:
    'Community challenges for pulp—prompt jams, genre weeks, and remix rounds—will land here. Check back or follow the blog for the first event.',
  path: '/challenges',
});

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="sr-only">Challenges</h1>
        <p className="font-display font-bold text-2xl text-gradient">Coming soon</p>
        <p className="text-muted mt-2 text-sm">This section is under construction.</p>
        <a href="/" className="mt-6 inline-block text-sm text-papaya hover:underline">← Back to pulp</a>
      </div>
    </div>
  );
}
