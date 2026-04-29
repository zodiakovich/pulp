import type { NoteEvent } from '@/lib/music-engine';
import type { LayerFXSettings } from './fx-settings';
import { buildFXChain } from './fx-chain';
import { getAudioContext } from './audio-context';
import { loadSampleSet, midiToDetune } from './sample-engine';
import { getInstrument, playNote } from './soundfont-engine';
import { resolveSampleSetSlug } from './sample-sets';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12] ?? 'C';
  return `${name}${octave}`;
}

const activeSources = new Set<AudioBufferSourceNode | OscillatorNode>();
const activeChainOutputs = new Set<AudioNode>();
let previewToken = 0;
let completionTimeout: number | ReturnType<typeof setTimeout> | null = null;

export function stopTonePreview() {
  previewToken += 1;
  if (completionTimeout !== null) {
    window.clearTimeout(completionTimeout);
    completionTimeout = null;
  }
  for (const src of activeSources) {
    try { src.stop(); } catch { /* ignore */ }
  }
  activeSources.clear();
  for (const out of activeChainOutputs) {
    try { out.disconnect(); } catch { /* ignore */ }
  }
  activeChainOutputs.clear();
}

export type TonePreviewLayer = 'melody' | 'chords' | 'bass' | 'drums';

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export async function playTonePreview(
  notes: NoteEvent[],
  bpm: number,
  layer: TonePreviewLayer,
  genre: string,
  onComplete?: () => void,
  instrument?: string,
  fx?: LayerFXSettings,
  volume = 1,
) {
  stopTonePreview();
  const runToken = previewToken;
  const ctx = getAudioContext();

  if (notes.length === 0) {
    onComplete?.();
    return;
  }

  const secondsPerBeat = 60 / Math.max(60, Math.min(200, bpm));
  const slug = resolveSampleSetSlug(genre);
  const sampleSet = slug ? await loadSampleSet(slug) : null;
  const now = ctx.currentTime + 0.05;

  // Build a single FX chain for this preview call (sample-based path only)
  let dest: AudioNode = ctx.destination;
  if (fx && sampleSet) {
    const chain = buildFXChain(ctx, fx);
    activeChainOutputs.add(chain.output);
    dest = chain.input;
  }

  // ─── MELODY ──────────────────────────────────────────────────────────────────
  if (layer === 'melody') {
    let maxEnd = 0;
    if (sampleSet) {
      for (const note of notes) {
        const t      = now + note.startTime * secondsPerBeat;
        const d      = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
        const vel    = note.velocity / 127;
        const detune = midiToDetune(Math.max(24, Math.min(108, note.pitch)), 48);
        const src    = ctx.createBufferSource();
        const gain   = ctx.createGain();
        src.buffer         = sampleSet.lead;
        src.detune.value   = detune;
        gain.gain.value    = vel * volume;
        src.connect(gain);
        gain.connect(dest);
        src.start(t);
        src.stop(t + d);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
        maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + d);
      }
    } else {
      const inst = await getInstrument(instrument ?? 'acoustic_grand_piano');
      for (const note of notes) {
        const t   = now + note.startTime * secondsPerBeat;
        const d   = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
        const vel = note.velocity / 127;
        playNote(inst, Math.max(24, Math.min(108, note.pitch)), t, d, vel * volume);
        maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + d);
      }
    }
    if (onComplete) {
      completionTimeout = window.setTimeout(() => {
        if (previewToken !== runToken) return;
        completionTimeout = null;
        stopTonePreview();
        onComplete();
      }, (maxEnd + 2) * 1000);
    }
    return;
  }

  // ─── CHORDS ──────────────────────────────────────────────────────────────────
  if (layer === 'chords') {
    let maxEnd = 0;
    if (sampleSet) {
      for (const note of notes) {
        const t      = now + note.startTime * secondsPerBeat;
        const d      = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
        const vel    = note.velocity / 127;
        const detune = midiToDetune(Math.max(24, Math.min(108, note.pitch)), 48);
        const src    = ctx.createBufferSource();
        const gain   = ctx.createGain();
        src.buffer         = sampleSet.pad;
        src.detune.value   = detune;
        gain.gain.value    = vel * volume;
        src.connect(gain);
        gain.connect(dest);
        src.start(t);
        src.stop(t + d);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
        maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + d);
      }
    } else {
      const inst = await getInstrument(instrument ?? 'string_ensemble_1');
      for (const note of notes) {
        const t   = now + note.startTime * secondsPerBeat;
        const d   = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
        const vel = note.velocity / 127;
        playNote(inst, Math.max(24, Math.min(108, note.pitch)), t, d, vel * volume);
        maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + d);
      }
    }
    if (onComplete) {
      completionTimeout = window.setTimeout(() => {
        if (previewToken !== runToken) return;
        completionTimeout = null;
        stopTonePreview();
        onComplete();
      }, (maxEnd + 2) * 1000);
    }
    return;
  }

  // ─── BASS ────────────────────────────────────────────────────────────────────
  if (layer === 'bass') {
    let maxEnd = 0;
    if (sampleSet) {
      for (const note of notes) {
        const t      = now + note.startTime * secondsPerBeat;
        const d      = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
        const vel    = note.velocity / 127;
        const detune = midiToDetune(Math.max(24, Math.min(108, note.pitch)), 48);
        const src    = ctx.createBufferSource();
        const gain   = ctx.createGain();
        src.buffer         = sampleSet.bass;
        src.detune.value   = detune;
        gain.gain.value    = vel * volume;
        src.connect(gain);
        gain.connect(dest);
        src.start(t);
        src.stop(t + d);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
        maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + d);
      }
    } else {
      const inst = await getInstrument(instrument ?? 'electric_bass_finger');
      for (const note of notes) {
        const t   = now + note.startTime * secondsPerBeat;
        const d   = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
        const vel = note.velocity / 127;
        playNote(inst, Math.max(24, Math.min(108, note.pitch)), t, d, vel * volume);
        maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + d);
      }
    }
    if (onComplete) {
      completionTimeout = window.setTimeout(() => {
        if (previewToken !== runToken) return;
        completionTimeout = null;
        stopTonePreview();
        onComplete();
      }, (maxEnd + 2) * 1000);
    }
    return;
  }

  // ─── DRUMS ───────────────────────────────────────────────────────────────────
  if (layer === 'drums') {
    let maxEnd = 0;
    if (sampleSet) {
      for (const note of notes) {
        const t        = now + note.startTime * secondsPerBeat;
        const v        = Math.max(0.05, Math.min(1, note.velocity / 127)) * volume;
        const isKick   = note.pitch === 36 || note.pitch === 35;
        const isSnare  = note.pitch === 38 || note.pitch === 40;
        const isOpen   = note.pitch === 46;
        const isClosed = note.pitch === 42 || note.pitch === 51;

        let buf: AudioBuffer;
        if (isKick)        buf = sampleSet.kick;
        else if (isSnare)  buf = sampleSet.snare;
        else if (isOpen)   buf = sampleSet['open-hat'];
        else if (isClosed) buf = sampleSet['closed-hat'];
        else               buf = sampleSet.perc;

        const src  = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer      = buf;
        gain.gain.value = v;
        src.connect(gain);
        gain.connect(dest);
        src.start(t);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
        maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + 0.5);
      }
      if (onComplete) {
        completionTimeout = window.setTimeout(() => {
          if (previewToken !== runToken) return;
          completionTimeout = null;
          stopTonePreview();
          onComplete();
        }, (maxEnd + 1) * 1000);
      }
      return;
    }

    for (const note of notes) {
      const t       = now + note.startTime * secondsPerBeat;
      const isKick  = note.pitch === 36 || note.pitch === 35;
      const isSnare = note.pitch === 38 || note.pitch === 40;
      const isHat   = note.pitch >= 42;

      if (isKick) {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.3);
        activeSources.add(osc);
        osc.onended = () => activeSources.delete(osc);
      } else if (isSnare) {
        const noiseBuffer = createNoiseBuffer(ctx, 0.15);
        const src  = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = noiseBuffer;
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        src.connect(gain);
        gain.connect(dest);
        src.start(t);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
      } else if (isHat) {
        const noiseBuffer = createNoiseBuffer(ctx, 0.05);
        const src    = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain   = ctx.createGain();
        filter.type            = 'highpass';
        filter.frequency.value = 8000;
        src.buffer = noiseBuffer;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        src.start(t);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
      }
      maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + 0.5);
    }
    if (onComplete) {
      completionTimeout = window.setTimeout(() => {
        if (previewToken !== runToken) return;
        completionTimeout = null;
        stopTonePreview();
        onComplete();
      }, (maxEnd + 1) * 1000);
    }
  }
}

export { midiToNoteName };
