'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GENRES, type GenerationResult, type NoteEvent } from '@/lib/music-engine';
import { playNotes, stopAllPlayback } from '@/lib/audio-engine';

// ─── CHORD DERIVATION ────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const INTERVAL_QUALITY: Record<string, string> = {
  '0,3,7': 'm',     '0,4,7': '',      '0,3,6': 'dim',  '0,4,8': 'aug',
  '0,3,7,10': 'm7', '0,4,7,11': 'M7', '0,4,7,10': '7', '0,3,6,10': 'm7b5',
  '0,3,7,11': 'mM7','0,2,7': 'sus2',  '0,5,7': 'sus4',
};

function pitchesToChordName(pitches: number[]): string {
  if (pitches.length === 0) return '—';
  const classes = [...new Set(pitches.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
  if (classes.length === 1) return NOTE_NAMES[classes[0]!]!;
  for (const root of classes) {
    const intervals = classes.map(c => (c - root + 12) % 12).sort((a, b) => a - b);
    const key = intervals.join(',');
    if (key in INTERVAL_QUALITY) return NOTE_NAMES[root]! + INTERVAL_QUALITY[key];
  }
  return NOTE_NAMES[classes[0]!]!;
}

function deriveChords(chords: NoteEvent[]): string[] {
  if (chords.length === 0) return [];
  const maxTime = Math.max(...chords.map(n => n.startTime + n.duration));
  const bars = Math.max(1, Math.ceil(maxTime / 4));
  return Array.from({ length: bars }, (_, bar) => {
    const barNotes = chords.filter(n => n.startTime >= bar * 4 && n.startTime < bar * 4 + 4);
    if (barNotes.length === 0) return '—';
    const firstOnset = Math.min(...barNotes.map(n => n.startTime));
    const onset = barNotes.filter(n => Math.abs(n.startTime - firstOnset) < 0.05);
    return pitchesToChordName(onset.map(n => n.pitch));
  });
}

// ─── SHARE PAGE ──────────────────────────────────────────────
interface Generation {
  id: string;
  prompt: string;
  genre: string;
  bpm: number;
  layers: GenerationResult;
  created_at: string;
}

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const [gen, setGen] = useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('generations')
      .select('id, prompt, genre, bpm, layers, created_at')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else { setGen(data as Generation); }
        setLoading(false);
      });
  }, [id]);

  const handlePlayToggle = useCallback(() => {
    if (!gen) return;
    if (playing) {
      stopAllPlayback();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    playNotes({
      melody: gen.layers.melody,
      chords: gen.layers.chords,
      bass: gen.layers.bass,
      drums: gen.layers.drums,
      bpm: gen.bpm,
      genre: gen.genre,
      onComplete: () => setPlaying(false),
    });
  }, [gen, playing]);

  // ── LAYOUT ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#09090B' }}>
      {/* Nav */}
      <nav className="h-14 flex items-center px-8" style={{ borderBottom: '1px solid #1A1A2E' }}>
        <a
          href="/"
          className="text-gradient font-extrabold text-xl"
          style={{ fontFamily: 'Syne, sans-serif', textDecoration: 'none' }}
        >
          pulp
        </a>
      </nav>

      <main className="flex-1 flex items-center justify-center px-8 py-16">
        {loading && (
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#8A8A9A' }}>
            Loading…
          </p>
        )}

        {notFound && (
          <div className="text-center">
            <p className="font-extrabold text-xl mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
              Generation not found
            </p>
            <a href="/" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#FF6D3F', textDecoration: 'none' }}>
              ← Back to pulp
            </a>
          </div>
        )}

        {gen && !loading && (
          <div className="w-full max-w-[480px]">
            {/* Card */}
            <div
              className="rounded-2xl p-8"
              style={{ background: '#111118', border: '1px solid #1A1A2E' }}
            >
              {/* Prompt */}
              {gen.prompt && (
                <p
                  className="mb-6 leading-snug"
                  style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: '#F0F0FF' }}
                >
                  &ldquo;{gen.prompt}&rdquo;
                </p>
              )}

              {/* Meta row */}
              <div className="flex gap-3 flex-wrap mb-8">
                {[
                  GENRES[gen.genre]?.name ?? gen.genre,
                  `${gen.bpm} BPM`,
                ].map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-md text-xs"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#8A8A9A',
                      background: '#0D0D12',
                      border: '1px solid #1A1A2E',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Chord progression */}
              {gen.layers.chords.length > 0 && (
                <div className="mb-8">
                  <p
                    className="mb-3"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: 'rgba(138,138,154,0.45)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Chord Progression
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {deriveChords(gen.layers.chords).map((name, i, arr) => (
                      <span
                        key={i}
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 13,
                          color: '#A78BFA',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {name}
                        {i < arr.length - 1 && (
                          <span style={{ color: 'rgba(138,138,154,0.35)', fontSize: 11 }}>→</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Play button */}
              <button
                onClick={handlePlayToggle}
                className="w-full h-12 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: playing ? 'rgba(233,69,96,0.12)' : 'rgba(255,109,63,0.12)',
                  border: playing ? '1px solid rgba(233,69,96,0.4)' : '1px solid rgba(255,109,63,0.4)',
                  color: playing ? '#E94560' : '#FF6D3F',
                  fontFamily: 'Syne, sans-serif',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = playing
                    ? 'rgba(233,69,96,0.2)'
                    : 'rgba(255,109,63,0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = playing
                    ? 'rgba(233,69,96,0.12)'
                    : 'rgba(255,109,63,0.12)';
                }}
              >
                {playing ? '■  Stop' : '▶  Play'}
              </button>
            </div>

            {/* Back link */}
            <div className="mt-6 text-center">
              <a
                href="/"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  color: 'rgba(138,138,154,0.5)',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#8A8A9A')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(138,138,154,0.5)')}
              >
                ← Make your own at pulp
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
