'use client';

import { useEffect, useState } from 'react';
import { playAll } from '@/lib/tone-lazy';
import { stopAllAppAudio, subscribeToAudioStop } from '@/lib/audio-control';
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

  useEffect(() => subscribeToAudioStop(() => setPlaying(false)), []);

  const onToggle = () => {
    if (playing) {
      stopAllAppAudio();
      setPlaying(false);
      return;
    }

    stopAllAppAudio();
    setPlaying(true);
    void playAll(
      {
        melody: layers.melody?.length ? layers.melody : undefined,
        chords: layers.chords?.length ? layers.chords : undefined,
        bass: layers.bass?.length ? layers.bass : undefined,
        drums: layers.drums?.length ? layers.drums : undefined,
      },
      bpm,
      genre,
      () => setPlaying(false),
    );
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
