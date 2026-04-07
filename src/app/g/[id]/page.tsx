import { supabase } from '@/lib/supabase';
import type { GenerationResult, NoteEvent } from '@/lib/music-engine';
import { notFound } from 'next/navigation';
import { PlayButton } from './PlayButton';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const INTERVAL_QUALITY: Record<string, string> = {
  '0,3,7': 'm',
  '0,4,7': '',
  '0,3,6': 'dim',
  '0,4,8': 'aug',
  '0,3,7,10': 'm7',
  '0,4,7,11': 'M7',
  '0,4,7,10': '7',
  '0,3,6,10': 'm7b5',
  '0,3,7,11': 'mM7',
  '0,2,7': 'sus2',
  '0,5,7': 'sus4',
};

function pitchesToChordName(pitches: number[]): string {
  if (pitches.length === 0) return '—';
  const classes = [...new Set(pitches.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
  if (classes.length === 1) return NOTE_NAMES[classes[0]!] ?? '—';
  for (const root of classes) {
    const intervals = classes.map(c => (c - root + 12) % 12).sort((a, b) => a - b);
    const key = intervals.join(',');
    if (key in INTERVAL_QUALITY) return (NOTE_NAMES[root] ?? '—') + INTERVAL_QUALITY[key];
  }
  return NOTE_NAMES[classes[0]!] ?? '—';
}

function deriveChordProgression(chords: NoteEvent[], bars: number): string[] {
  return Array.from({ length: bars }, (_, bar) => {
    const barNotes = chords.filter(n => n.startTime >= bar * 4 && n.startTime < bar * 4 + 4);
    if (barNotes.length === 0) return '—';
    const firstOnset = Math.min(...barNotes.map(n => n.startTime));
    const onset = barNotes.filter(n => Math.abs(n.startTime - firstOnset) < 0.05);
    return pitchesToChordName(onset.map(n => n.pitch));
  });
}

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from('generations')
    .select('id, prompt, genre, bpm, layers, created_at')
    .eq('id', id)
    .single();

  if (error || !data) notFound();

  const layers = data.layers as GenerationResult;
  const bpm = data.bpm as number;
  const genre = data.genre as string;
  const prompt = (data.prompt as string) || '';

  // The generations table doesn’t currently store bars/params; default to 4 (matches Home history hydration).
  const bars = 4;
  const chords = deriveChordProgression(layers.chords ?? [], bars);

  return (
    <div className="min-h-screen px-8 pt-24 pb-16">
      <div className="max-w-[860px] mx-auto">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <p
              className="text-xs mb-3"
              style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)', letterSpacing: '0.08em' }}
            >
              GENERATION
            </p>
            <h1
              className="font-extrabold leading-[1.1] mb-3"
              style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 3.8vw, 44px)', letterSpacing: '-0.02em' }}
            >
              {prompt || 'Untitled prompt'}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span
                className="px-2 py-1 rounded-md text-xs"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A', background: '#111118', border: '1px solid #1A1A2E' }}
              >
                {genre}
              </span>
              <span
                className="px-2 py-1 rounded-md text-xs"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A', background: '#111118', border: '1px solid #1A1A2E' }}
              >
                {bpm} BPM
              </span>
              <span
                className="px-2 py-1 rounded-md text-xs"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)', background: '#111118', border: '1px solid #1A1A2E' }}
              >
                /g/{id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PlayButton layers={layers} bpm={bpm} genre={genre} />
          </div>
        </div>

        <div className="mt-8 rounded-2xl p-6" style={{ background: '#111118', border: '1px solid #1A1A2E' }}>
          <p
            className="text-xs mb-3"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)', letterSpacing: '0.08em' }}
          >
            CHORD PROGRESSION
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            {chords.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="text-sm"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}
              >
                {name}
                {i < chords.length - 1 && <span style={{ color: 'rgba(138,138,154,0.35)' }}> → </span>}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-6" style={{ background: '#0D0D12', border: '1px solid #1A1A2E' }}>
          <p
            className="text-xs"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.45)' }}
          >
            Read-only view. To generate new variations, go back to the main page.
          </p>
        </div>
      </div>
    </div>
  );
}
