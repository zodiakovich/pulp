import type { NoteEvent } from '@/lib/music-engine';

type Tracks = {
  melody?: NoteEvent[];
  chords?: NoteEvent[];
  bass?: NoteEvent[];
  drums?: NoteEvent[];
};

function rand(): number {
  return Math.random() * 2 - 1; // [-1, 1]
}

function humanizeTrack(
  notes: NoteEvent[] | undefined,
  amount: number,
  spb: number,
): NoteEvent[] | undefined {
  if (!notes?.length || amount === 0) return notes;

  const velFrac   = (amount * 0.3) / 100;          // ±(amount*0.3)% as a 0–1 fraction
  const maxTimeSec = (amount * 0.1) / 1000;         // ±(amount*0.1) ms converted to seconds
  const maxSwing   = (amount / 100) * 0.025;         // max swing offset in beats (~12ms at 120BPM)

  return notes.map(n => {
    // Velocity variation: ±(amount*0.3)% of original
    const velocity = Math.max(1, Math.min(127, Math.round(n.velocity + rand() * n.velocity * velFrac)));

    // Timing offset: ±(amount*0.1)ms converted to beats
    const timingOffsetBeats = (rand() * maxTimeSec) / spb;

    // Swing: push even 16th notes (0.25, 0.75, 1.25 … beat positions) slightly late
    const posIn16th = n.startTime % 0.5; // position within a half-beat window
    const isEven16th = Math.abs(posIn16th - 0.25) < 0.07;
    const swingOffset = isEven16th ? maxSwing * (0.5 + Math.random() * 0.5) : 0;

    const startTime = Math.max(0, n.startTime + timingOffsetBeats + swingOffset);

    return { ...n, velocity, startTime };
  });
}

export function applyHumanization(tracks: Tracks, amount: number, bpm: number): Tracks {
  if (amount === 0) return tracks;
  const spb = 60 / Math.max(60, Math.min(200, bpm)); // seconds per beat
  return {
    melody: humanizeTrack(tracks.melody, amount, spb),
    chords: humanizeTrack(tracks.chords, amount, spb),
    bass:   humanizeTrack(tracks.bass,   amount, spb),
    drums:  humanizeTrack(tracks.drums,  amount, spb),
  };
}
