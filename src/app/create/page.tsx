import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Create',
  description:
    'A dedicated create hub for pulp workflows is under construction. Use the home page to generate MIDI and explore public examples in the meantime.',
  path: '/create',
});

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="sr-only">Create</h1>
        <p className="font-display font-bold text-2xl text-gradient">Coming soon</p>
        <p className="text-muted mt-2 text-sm">This section is under construction.</p>
        <a href="/" className="mt-6 inline-block text-sm text-papaya hover:underline">← Back to pulp</a>
      </div>
    </div>
  );
}
