/**
 * Lazy-loads Tone.js and synth helpers on first playback so `tone` is not in the initial JS bundle.
 * Does not import music-engine.ts, midi-writer.ts, or audio-engine.ts.
 */
import type { NoteEvent } from '@/lib/music-engine';
import type { AllLayerFX, LayerFXSettings } from './fx-settings';
import type { AllMixerState } from './mixer-settings';

type PlayAllMod = typeof import('./tone-play-all');
type PreviewMod = typeof import('./tone-preview');

let playAllMod: PlayAllMod | null = null;
let previewMod: PreviewMod | null = null;

async function ensurePlayAll(): Promise<PlayAllMod> {
  if (!playAllMod) playAllMod = await import('./tone-play-all');
  return playAllMod;
}

async function ensurePreview(): Promise<PreviewMod> {
  if (!previewMod) previewMod = await import('./tone-preview');
  return previewMod;
}

export function stopPlayAll() {
  playAllMod?.stopPlayAll();
}

export function updateAllMixer(mixer: AllMixerState) {
  playAllMod?.updateAllMixer(mixer);
}

export async function playAll(
  tracks: { melody?: NoteEvent[]; chords?: NoteEvent[]; bass?: NoteEvent[]; drums?: NoteEvent[] },
  bpm: number,
  genre: string,
  onComplete?: () => void,
  allFX?: AllLayerFX,
  mixer?: AllMixerState,
) {
  const m = await ensurePlayAll();
  return m.playAll(tracks, bpm, genre, onComplete, allFX, mixer);
}

export function stopTonePreview() {
  previewMod?.stopTonePreview();
}

export type TonePreviewLayer = import('./tone-preview').TonePreviewLayer;

export async function playTonePreview(
  notes: NoteEvent[],
  bpm: number,
  layer: TonePreviewLayer,
  genre: string,
  onComplete?: () => void,
  instrument?: string,
  fx?: LayerFXSettings,
  volume?: number,
) {
  const m = await ensurePreview();
  return m.playTonePreview(notes, bpm, layer, genre, onComplete, instrument, fx, volume);
}
