'use client';

import { useState } from 'react';
import { playNotes, stopAllPlayback } from '@/lib/audio-engine';
import type { GenerationResult } from '@/lib/music-engine';

export function PlayButton({
  layers,
  bpm,
  genre,
}: {
  layers: GenerationResult;
  bpm: number;
  genre: string;
}) {
  const [playing, setPlaying] = useState(false);

  const onToggle = () => {
    if (playing) {
      stopAllPlayback();
      setPlaying(false);
      return;
    }

    setPlaying(true);
    playNotes({
      melody: layers.melody?.length ? layers.melody : undefined,
      chords: layers.chords?.length ? layers.chords : undefined,
      bass: layers.bass?.length ? layers.bass : undefined,
      drums: layers.drums?.length ? layers.drums : undefined,
      bpm,
      genre,
      onComplete: () => setPlaying(false),
    });
  };

  return (
    <button
      onClick={onToggle}
      className="btn-secondary btn-sm"
      title={playing ? 'Stop' : 'Play'}
    >
      {playing ? '■ Stop' : '▶ Play'}
    </button>
  );
}

