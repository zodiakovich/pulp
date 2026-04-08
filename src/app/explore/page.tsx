import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { GENRES } from '@/lib/music-engine';
import { ExploreGallery } from './ExploreGallery';
import { Navbar } from '@/components/Navbar';

function formatTimeAgo(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function ExplorePage() {
  const e2eBypass = process.env.NEXT_PUBLIC_E2E === '1';

  const { data } = e2eBypass
    ? { data: [] as any[] }
    : await supabase
      .from('generations')
      .select('id, prompt, genre, bpm, style_tag, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

  const items = (data ?? []).map(row => ({
    id: row.id as string,
    prompt: (row.prompt as string | null) ?? null,
    genre: (row.genre as string) ?? '—',
    bpm: (row.bpm as number) ?? 0,
    style_tag: (row.style_tag as string | null) ?? null,
    created_at: row.created_at as string,
    timeAgo: formatTimeAgo(row.created_at as string),
  }));

  const genres = Object.entries(GENRES).map(([key, g]) => ({ key, name: g.name }));

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="explore" />

      <ExploreGallery items={items} genres={genres} />
    </div>
  );
}
