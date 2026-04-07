import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { GENRES } from '@/lib/music-engine';
import { ExploreGallery } from './ExploreGallery';

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
    <div className="min-h-screen" style={{ background: '#0A0A0F' }}>
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{ borderBottom: '1px solid #1A1A2E', background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-[1280px] mx-auto px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-gradient font-extrabold text-xl"
            style={{ fontFamily: 'Syne, sans-serif', textDecoration: 'none' }}
          >
            pulp
          </Link>
          <div className="flex items-center gap-8 text-sm" style={{ color: '#8A8A9A' }}>
            <Link href="/" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Create
            </Link>
            <Link href="/explore" className="transition-colors" style={{ color: '#F0F0FF', textDecoration: 'none' }}>
              Explore
            </Link>
            <Link href="/build" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Build
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Pricing
            </Link>
          </div>
        </div>
      </nav>

      <ExploreGallery items={items} genres={genres} />
    </div>
  );
}
