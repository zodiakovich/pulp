import { supabase } from '@/lib/supabase';
import { GENRES } from '@/lib/music-engine';
import { ExploreGallery } from './ExploreGallery';
import { Navbar } from '@/components/Navbar';

const SEED_GENERATIONS = [
  { id: 'seed-1', prompt: 'dark melodic techno, 128bpm, Am', genre: 'Melodic Techno', bpm: 128, style_tag: 'Dark Hypnotic Dub', created_at: new Date().toISOString() },
  { id: 'seed-2', prompt: 'afro house groove, 124bpm, Dm', genre: 'Afro House', bpm: 124, style_tag: 'Organic Afro Groove', created_at: new Date().toISOString() },
  { id: 'seed-3', prompt: 'deep house late night, 120bpm, Fm', genre: 'Deep House', bpm: 120, style_tag: 'Jazzy UK Deep', created_at: new Date().toISOString() },
  { id: 'seed-4', prompt: 'tech house peak time, 132bpm, Gm', genre: 'Tech House', bpm: 132, style_tag: 'Pumping Festival Tech', created_at: new Date().toISOString() },
  { id: 'seed-5', prompt: 'melodic house sunrise, 122bpm, Em', genre: 'Melodic House', bpm: 122, style_tag: 'Euphoric Melodic', created_at: new Date().toISOString() },
  { id: 'seed-6', prompt: 'hard techno industrial, 140bpm, Cm', genre: 'Hard Techno', bpm: 140, style_tag: 'Peak-Time Industrial', created_at: new Date().toISOString() },
  { id: 'seed-7', prompt: 'organic house, 118bpm, Gm', genre: 'Organic House', bpm: 118, style_tag: 'Groovy Seoul House', created_at: new Date().toISOString() },
  { id: 'seed-8', prompt: 'minimal techno warehouse, 135bpm, Dm', genre: 'Minimal Tech', bpm: 135, style_tag: 'Acid Warehouse', created_at: new Date().toISOString() },
];

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

  const realItems = (data ?? []).map(row => ({
    id: row.id as string,
    prompt: (row.prompt as string | null) ?? null,
    genreKey: (row.genre as string) ?? '—',
    genreLabel: GENRES[(row.genre as string) ?? '']?.name ?? ((row.genre as string) ?? '—'),
    bpm: (row.bpm as number) ?? 0,
    style_tag: (row.style_tag as string | null) ?? null,
    created_at: row.created_at as string,
    timeAgo: formatTimeAgo(row.created_at as string),
    isExample: false,
  }));

  const seedMode = realItems.length === 0;
  const items = seedMode
    ? SEED_GENERATIONS.map(s => ({
      ...s,
      prompt: s.prompt ?? null,
      style_tag: s.style_tag ?? null,
      timeAgo: formatTimeAgo(s.created_at),
      genreKey: Object.entries(GENRES).find(([, g]) => g.name.toLowerCase() === s.genre.toLowerCase())?.[0] ?? s.genre,
      genreLabel: s.genre,
      isExample: true,
    }))
    : realItems;

  const genres = Object.entries(GENRES).map(([key, g]) => ({ key, name: g.name }));

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="explore" />

      <ExploreGallery items={items} genres={genres} seedMode={seedMode} />
    </div>
  );
}
