import { instrument } from 'soundfont-player';
import type { Player } from 'soundfont-player';
import { getAudioContext } from './audio-context';

export type { Player };

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12] ?? 'C';
  return `${name}${octave}`;
}

const instrumentCache = new Map<string, Promise<Player>>();

export function getInstrument(name: string): Promise<Player> {
  const existing = instrumentCache.get(name);
  if (existing) return existing;

  const p = instrument(getAudioContext(), name as Parameters<typeof instrument>[1]);
  instrumentCache.set(name, p);
  return p;
}

export function playNote(
  inst: Player,
  midiNote: number,
  time: number,
  duration: number,
  velocity: number,
): void {
  const noteName = midiToNoteName(midiNote);
  inst.play(noteName, time, { duration, gain: velocity });
}
