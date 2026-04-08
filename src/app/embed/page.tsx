import { EmbedClient } from './EmbedClient';

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; bpm?: string; key?: string }>;
}) {
  const sp = await searchParams;
  return (
    <EmbedClient
      initialGenre={sp.genre ?? null}
      initialBpm={sp.bpm ?? null}
      initialKey={sp.key ?? null}
    />
  );
}

