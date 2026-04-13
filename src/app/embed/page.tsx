import { EmbedIframeClient } from './EmbedIframeClient';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Embed',
  description:
    'Embeddable pulp preview for sites and docs—load genre, BPM, and key parameters via query string. Use the main app for full editing.',
  path: '/embed',
});

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; bpm?: string; key?: string }>;
}) {
  const sp = await searchParams;
  return (
    <EmbedIframeClient
      initialGenre={sp.genre ?? null}
      initialBpm={sp.bpm ?? null}
      initialKey={sp.key ?? null}
    />
  );
}
