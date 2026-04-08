'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { GenerationResult, NoteEvent } from '@/lib/music-engine';
import { playNotes, stopAllPlayback } from '@/lib/audio-engine';
import { generateMidiFormat1, downloadMidi } from '@/lib/midi-writer';

type GenerationRow = {
  id: string;
  prompt: string | null;
  genre: string;
  bpm: number;
  style_tag: string | null;
  layers: GenerationResult;
  created_at: string;
};

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function mostCommon<T extends string | number>(items: T[]): T | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: T | null = null;
  let bestN = -1;
  for (const [k, n] of counts.entries()) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

export function ProfileClient({
  userId,
  isProFromCredits,
}: {
  userId: string;
  isProFromCredits?: boolean;
}) {
  const [rows, setRows] = useState<GenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<{ used: number; isPro: boolean } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('generations')
          .select('id, prompt, genre, bpm, style_tag, layers, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (!cancelled && data) setRows(data as GenerationRow[]);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      stopAllPlayback();
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { data } = await supabase.from('user_credits').select('*').eq('user_id', userId).single();
        if (cancelled) return;
        if (!data) return;
        setCredits({ used: (data.credits_used as number) ?? 0, isPro: Boolean(data.is_pro) });
      } catch {
        // ignore
      }
    };
    run();
    return () => { cancelled = true; };
  }, [userId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const favoriteGenre = mostCommon(rows.map(r => r.genre));
    const mostUsedBpm = mostCommon(rows.map(r => r.bpm));
    return { total, favoriteGenre, mostUsedBpm };
  }, [rows]);

  const pro = credits?.isPro ?? isProFromCredits ?? false;
  const limit = pro ? Infinity : 10;
  const used = credits?.used ?? 0;

  return (
    <div className="pt-24 pb-16 px-8">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-4 rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Total generations', value: String(stats.total) },
                { label: 'Favorite genre', value: stats.favoriteGenre ?? '—' },
                { label: 'Most used BPM', value: stats.mostUsedBpm ? `${stats.mostUsedBpm}` : '—' },
                { label: 'Credits (this month)', value: pro ? 'Pro' : `${Math.max(0, limit - used)} / ${limit}` },
              ].map(card => (
                <div key={card.label} className="rounded-xl p-4" style={{ border: '1px solid var(--border)', background: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em' }}>
                    {card.label.toUpperCase()}
                  </div>
                  <div className="mt-2" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)' }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
            {!pro && (
              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                <div style={{ color: 'var(--muted)' }}>
                  Upgrade to Pro for unlimited generations and saved history.
                </div>
                <Link
                  href="/pricing"
                  className="btn-primary"
                  style={{ height: 40, padding: '0 16px', fontSize: 13, textDecoration: 'none' }}
                >
                  Upgrade to Pro
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.08em' }}>
              YOUR GENERATIONS
            </p>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text)' }}>
              Library
            </h2>
          </div>
          <div style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            {loading ? 'Loading…' : `${rows.length} items`}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!loading && rows.length === 0 && (
            <div className="rounded-2xl p-6 lg:col-span-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)' }}>
                No generations yet
              </div>
              <div className="mt-2" style={{ color: 'var(--muted)' }}>
                Go back to Create and generate your first track.
              </div>
              <Link href="/" className="btn-secondary mt-4" style={{ height: 40, padding: '0 16px', fontSize: 13, textDecoration: 'none' }}>
                Go to Create
              </Link>
            </div>
          )}

          {rows.map((r) => {
            const title = (r.prompt ?? '').trim() || 'Untitled prompt';
            const created = new Date(r.created_at);
            return (
              <div key={r.id} className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text)' }} className="truncate">
                      {title}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded-md text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                        {r.genre}
                      </span>
                      <span className="px-2 py-1 rounded-md text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                        {r.bpm} BPM
                      </span>
                      <span className="px-2 py-1 rounded-md text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'color-mix(in srgb, var(--muted) 85%, transparent)' }}>
                        {formatDate(created)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    className="btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      if (playingId === r.id) {
                        stopAllPlayback();
                        setPlayingId(null);
                        return;
                      }
                      stopAllPlayback();
                      setPlayingId(r.id);
                      playNotes({
                        melody: r.layers.melody,
                        chords: r.layers.chords,
                        bass: r.layers.bass,
                        drums: r.layers.drums,
                        bpm: r.bpm,
                        genre: r.genre,
                        onComplete: () => setPlayingId(null),
                      });
                    }}
                    title={playingId === r.id ? 'Stop' : 'Play'}
                  >
                    {playingId === r.id ? '■' : '▶'} Play
                  </button>

                  <button
                    className="btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      void navigator.clipboard.writeText(`/g/${r.id}`);
                      setCopiedId(r.id);
                      window.setTimeout(() => setCopiedId(null), 1600);
                    }}
                    title="Copy share URL"
                  >
                    {copiedId === r.id ? 'Copied' : 'Share'}
                  </button>

                  <button
                    className="btn-download btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      const tracks: { name: string; notes: NoteEvent[]; channel: number }[] = [];
                      if (r.layers.melody?.length) tracks.push({ name: 'Melody', notes: r.layers.melody, channel: 0 });
                      if (r.layers.chords?.length) tracks.push({ name: 'Chords', notes: r.layers.chords, channel: 1 });
                      if (r.layers.bass?.length) tracks.push({ name: 'Bass', notes: r.layers.bass, channel: 2 });
                      if (r.layers.drums?.length) tracks.push({ name: 'Drums', notes: r.layers.drums, channel: 9 });
                      const midi = generateMidiFormat1(tracks, r.bpm);
                      const safeGenre = (r.genre || 'track').toLowerCase().replace(/\s/g, '-');
                      downloadMidi(midi, `pulp-${safeGenre}-${r.bpm}bpm.mid`);
                    }}
                    title="Download MIDI"
                  >
                    ↓ MIDI
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

