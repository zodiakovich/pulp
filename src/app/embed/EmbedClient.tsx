'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GENRES,
  generateTrack,
  getDefaultParams,
  type GenerationParams,
  type GenerationResult,
  type NoteEvent,
} from '@/lib/music-engine';
import { playNotes, stopAllPlayback } from '@/lib/audio-engine';
import { generateMidiFormat1, downloadMidi } from '@/lib/midi-writer';
import { ButtonLoadingDots } from '@/components/ButtonLoadingDots';

function normalizeGenreParam(raw: string | null): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (GENRES[v]) return v;
  const byName = Object.entries(GENRES).find(([, g]) => g.name.toLowerCase().replace(/\\s/g, '') === v.toLowerCase().replace(/\\s/g, ''));
  return byName?.[0] ?? null;
}

function parseKeyParam(raw: string | null): { key?: string; scale?: string } {
  const v = (raw ?? '').trim();
  if (!v) return {};
  const compact = v.replace(/\\s/g, '');
  const m = compact.match(/^([A-Ga-g])(#|b)?(m|min|minor|maj|major)?$/);
  if (!m) return {};
  const note = (m[1] ?? 'A').toUpperCase() + (m[2] ?? '');
  const qual = (m[3] ?? '').toLowerCase();
  const scale = (qual === 'm' || qual === 'min' || qual === 'minor') ? 'minor' : (qual ? 'major' : undefined);
  return { key: note, scale };
}

export function EmbedClient({
  initialGenre,
  initialBpm,
  initialKey,
  compact = false,
  onAfterGenerate,
  onDownloadMidi,
  onParamsChange,
}: {
  initialGenre: string | null;
  initialBpm: string | null;
  initialKey: string | null;
  /** When true, drop full-viewport centering for embedding in collab / panels */
  compact?: boolean;
  onAfterGenerate?: (info: { genre: string; bpm: number }) => void;
  onDownloadMidi?: () => void;
  /** Fires when genre changes inside the embed (for shared sessions) */
  onParamsChange?: (info: { genre: string; bpm: number }) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [params, setParams] = useState<GenerationParams>(getDefaultParams());
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const resultRef = useRef<GenerationResult | null>(null);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    const g = normalizeGenreParam(initialGenre);
    const bpm = initialBpm ? Math.max(60, Math.min(200, Math.round(Number(initialBpm)))) : null;
    const { key, scale } = parseKeyParam(initialKey);
    setParams(p => ({
      ...p,
      genre: g ?? p.genre,
      bpm: bpm ?? p.bpm,
      key: key ?? p.key,
      scale: scale ?? p.scale,
    }));
  }, [initialGenre, initialBpm, initialKey]);

  const genreOptions = useMemo(() => Object.entries(GENRES).map(([id, g]) => ({ id, name: g.name })), []);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const gen = generateTrack(params);
      setResult(gen);
      onAfterGenerate?.({ genre: params.genre, bpm: params.bpm });
    } finally {
      setIsGenerating(false);
      stopAllPlayback();
      setPlaying(false);
    }
  };

  const handlePlayToggle = () => {
    if (!resultRef.current) return;
    if (playing) {
      stopAllPlayback();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    playNotes({
      melody: params.layers.melody ? resultRef.current.melody : undefined,
      chords: params.layers.chords ? resultRef.current.chords : undefined,
      bass: params.layers.bass ? resultRef.current.bass : undefined,
      drums: params.layers.drums ? resultRef.current.drums : undefined,
      bpm: params.bpm,
      genre: params.genre,
      onComplete: () => setPlaying(false),
    });
  };

  const handleDownload = () => {
    if (!result) return;
    onDownloadMidi?.();
    const tracks: { name: string; notes: NoteEvent[]; channel: number }[] = [];
    if (result.melody.length > 0) tracks.push({ name: 'Melody', notes: result.melody, channel: 0 });
    if (result.chords.length > 0) tracks.push({ name: 'Chords', notes: result.chords, channel: 1 });
    if (result.bass.length > 0) tracks.push({ name: 'Bass', notes: result.bass, channel: 2 });
    if (result.drums.length > 0) tracks.push({ name: 'Drums', notes: result.drums, channel: 9 });
    const midi = generateMidiFormat1(tracks, params.bpm);
    const safeGenre = (GENRES[params.genre]?.name || params.genre).toLowerCase().replace(/\\s/g, '-');
    downloadMidi(midi, `pulp-${safeGenre}-${params.bpm}bpm.mid`);
  };

  return (
    <div
      className={compact ? 'w-full' : 'min-h-screen flex items-center justify-center px-4 py-10'}
      style={{ background: compact ? 'transparent' : 'var(--bg)', color: 'var(--text)' }}
    >
      <div
        className="w-full rounded-2xl p-5 glass-elevated card-tilt-hover"
        style={{ maxWidth: compact ? 'none' : 860 }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
            pulp
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
            {GENRES[params.genre]?.name ?? params.genre} · {params.bpm} BPM · {params.key}{params.scale === 'minor' ? 'm' : ''}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the vibe…"
            className="input-field md:col-span-2"
            style={{ height: 44, opacity: isGenerating ? 0.55 : 1 }}
            readOnly={isGenerating}
            aria-busy={isGenerating}
          />
          <select
            className="w-full"
            value={params.genre}
            onChange={(e) => {
              const genre = e.target.value;
              setParams(p => {
                const next = { ...p, genre };
                onParamsChange?.({ genre, bpm: next.bpm });
                return next;
              });
            }}
            style={{ height: 44 }}
            aria-label="Genre"
          >
            {genreOptions.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            className={`btn-primary btn-sm${isGenerating ? ' pulsing' : ''}`}
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
          >
            {isGenerating ? <ButtonLoadingDots label="Generating" /> : 'Generate'}
          </button>
          <button className="btn-secondary btn-sm" onClick={handlePlayToggle} disabled={!result}>
            {playing ? '■ Stop' : '▶ Play'}
          </button>
          <button className="btn-download btn-sm" onClick={handleDownload} disabled={!result}>
            ↓ Download MIDI
          </button>
        </div>

        {!compact && (
          <div className="mt-6 pt-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
              made with{' '}
              <a href="/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                pulp.
              </a>
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'color-mix(in srgb, var(--muted) 70%, transparent)' }}>
              /embed
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

