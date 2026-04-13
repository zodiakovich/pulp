import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import type { GenerationResult, NoteEvent } from '@/lib/music-engine';
import { notFound } from 'next/navigation';
import { clipDescription } from '@/lib/seo';
import { pageMeta } from '@/lib/seo-metadata';
import { PlayButton } from './PlayButton';
import { PianoRollViz } from './PianoRollViz';

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
    .select('id, prompt, genre, bpm, layers, created_at, inspiration_source, is_public')
    .eq('id', id)
    .eq('is_public', true)
    .single();

  if (error || !data) notFound();

  const layers = data.layers as GenerationResult;
  const bpm = data.bpm as number;
  const genre = data.genre as string;
  const prompt = (data.prompt as string) || '';
  const inspiration = (data.inspiration_source as string | null) ?? null;

  // The generations table doesn’t currently store bars/params; default to 4 (matches Home history hydration).
  const bars = 4;
  const chords = deriveChordProgression(layers.chords ?? [], bars);
  const allPitches = [
    ...(layers.melody ?? []).map(n => n.pitch),
    ...(layers.chords ?? []).map(n => n.pitch),
    ...(layers.bass ?? []).map(n => n.pitch),
  ];
  const keyGuess = (() => {
    if (allPitches.length === 0) return '—';
    const counts = new Array(12).fill(0) as number[];
    for (const p of allPitches) counts[((p % 12) + 12) % 12] += 1;
    const best = counts.reduce((bi, v, i) => (v > counts[bi]! ? i : bi), 0);
    return NOTE_NAMES[best] ?? '—';
  })();

  return (
    <div className="min-h-screen px-8 pt-24 pb-16">
      <div className="max-w-[860px] mx-auto">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <p
              className="text-xs mb-3"
              style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.30)', letterSpacing: '0.08em' }}
            >
              GENERATION
            </p>
            <h1
              className="font-extrabold leading-[1.1] mb-3"
              style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3.8vw, 34px)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
            >
              {prompt || 'Untitled prompt'}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span
                className="px-2 py-1 rounded-md text-xs"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {genre}
              </span>
              <span
                className="px-2 py-1 rounded-md text-xs"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {keyGuess}
              </span>
              <span
                className="px-2 py-1 rounded-md text-xs"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {bpm} BPM
              </span>
              {inspiration && (
                <span
                  className="px-2 py-1 rounded-md text-xs"
                  style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.50)', background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {inspiration}
                </span>
              )}
              <span
                className="px-2 py-1 rounded-md text-xs"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.30)', background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                /g/{id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PlayButton layers={layers} bpm={bpm} genre={genre} />
          </div>
        </div>

        <div className="mt-8">
          <PianoRollViz layers={layers} bars={bars} />
        </div>

        <div className="mt-8 rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p
            className="text-xs mb-3"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.30)', letterSpacing: '0.08em' }}
          >
            CHORD PROGRESSION
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            {chords.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="text-sm"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}
              >
                {name}
                {i < chords.length - 1 && <span style={{ color: 'rgba(138,138,154,0.35)' }}> → </span>}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-6" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <p
            className="text-xs"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.45)' }}
          >
            Read-only view. To generate new variations, go back to the main page.
          </p>
        </div>

        <div className="mt-6 rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text)', fontWeight: 600 }}>
            Generate your own pattern
          </p>
          <a
            href="/"
            className="btn-primary btn-sm"
            style={{ textDecoration: 'none' }}
          >
            Start generating
          </a>
        </div>
      </div>
    </div>
  );
}

function titleSegmentFromPrompt(prompt: string): string {
  const t = (prompt || '').trim();
  if (!t) return 'Shared generation';
  if (t.length <= 48) return t;
  return `${t.slice(0, 45)}…`;
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const path = `/g/${id}`;
  const { data } = await supabase
    .from('generations')
    .select('genre, bpm, layers, is_public, prompt')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();

  if (!data) {
    return pageMeta({
      title: 'Shared generation',
      description:
        'This shared MIDI link is unavailable or private. Use pulp to generate editable melody, chords, bass, and drums from a text prompt.',
      path,
    });
  }
  const genre = (data.genre as string) || 'beat';
  const bpm = (data.bpm as number) || 0;
  const layers = data.layers as GenerationResult;
  const pitches = [
    ...(layers.melody ?? []).map(n => n.pitch),
    ...(layers.chords ?? []).map(n => n.pitch),
    ...(layers.bass ?? []).map(n => n.pitch),
  ];
  const key = (() => {
    if (pitches.length === 0) return '—';
    const counts = new Array(12).fill(0) as number[];
    for (const p of pitches) counts[((p % 12) + 12) % 12] += 1;
    const best = counts.reduce((bi, v, i) => (v > counts[bi]! ? i : bi), 0);
    return NOTE_NAMES[best] ?? '—';
  })();
  const prompt = (data.prompt as string) || '';
  const titleSeg = titleSegmentFromPrompt(prompt);
  const desc = clipDescription(
    `${genre} at ${bpm} BPM, key ${key}. ${prompt ? `“${prompt.slice(0, 120)}${prompt.length > 120 ? '…' : ''}” ` : ''}Preview shared MIDI from pulp or export to your DAW.`,
  );

  return pageMeta({
    title: titleSeg,
    description: desc,
    path,
  });
}
