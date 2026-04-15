import type { NoteEvent } from '@/lib/music-engine';
import { getAudioContext } from './audio-context';
import { loadSampleSet, midiToDetune } from './sample-engine';
import { getInstrument, playNote } from './soundfont-engine';
import { resolveSampleSetSlug } from './sample-sets';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNote(midi: number): string {
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12] ?? 'C'}${oct}`;
}

const activeSources = new Set<AudioBufferSourceNode | OscillatorNode>();

export function stopPlayAll() {
  for (const src of activeSources) {
    try { src.stop(); } catch { /* ignore */ }
  }
  activeSources.clear();
}

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export async function playAll(
  tracks: { melody?: NoteEvent[]; chords?: NoteEvent[]; bass?: NoteEvent[]; drums?: NoteEvent[] },
  bpm: number,
  genre: string,
  onComplete?: () => void,
) {
  stopPlayAll();
  const ctx = getAudioContext();

  const hasNotes =
    (tracks.melody?.length ?? 0) +
    (tracks.chords?.length ?? 0) +
    (tracks.bass?.length ?? 0) +
    (tracks.drums?.length ?? 0);
  if (!hasNotes) { onComplete?.(); return; }

  const spb = 60 / Math.max(60, Math.min(200, bpm));

  // Resolve slug — if non-null, load sample set; otherwise use soundfont
  const slug = resolveSampleSetSlug(genre);
  const sampleSet = slug ? await loadSampleSet(slug) : null;

  const now = ctx.currentTime + 0.05;
  let maxEnd = 0;

  // ─── MELODY ────────────────────────────────────────────────────────────────
  if (tracks.melody?.length) {
    if (sampleSet) {
      for (const n of tracks.melody) {
        const t      = now + n.startTime * spb;
        const d      = Math.max(0.1, n.duration * spb * 0.9);
        const vel    = n.velocity / 127;
        const detune = midiToDetune(Math.max(24, Math.min(108, n.pitch)), 48);
        const src    = ctx.createBufferSource();
        const gain   = ctx.createGain();
        src.buffer         = sampleSet.lead;
        src.detune.value   = detune;
        gain.gain.value    = vel;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(t);
        src.stop(t + d);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    } else {
      const inst = await getInstrument('acoustic_grand_piano');
      for (const n of tracks.melody) {
        const t   = now + n.startTime * spb;
        const d   = Math.max(0.1, n.duration * spb * 0.9);
        const vel = n.velocity / 127;
        playNote(inst, Math.max(24, Math.min(108, n.pitch)), t, d, vel);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    }
  }

  // ─── CHORDS ────────────────────────────────────────────────────────────────
  if (tracks.chords?.length) {
    if (sampleSet) {
      for (const n of tracks.chords) {
        const t      = now + n.startTime * spb;
        const d      = Math.max(0.1, n.duration * spb * 0.9);
        const vel    = n.velocity / 127;
        const detune = midiToDetune(Math.max(24, Math.min(108, n.pitch)), 48);
        const src    = ctx.createBufferSource();
        const gain   = ctx.createGain();
        src.buffer         = sampleSet.pad;
        src.detune.value   = detune;
        gain.gain.value    = vel;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(t);
        src.stop(t + d);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    } else {
      const inst = await getInstrument('string_ensemble_1');
      for (const n of tracks.chords) {
        const t   = now + n.startTime * spb;
        const d   = Math.max(0.1, n.duration * spb * 0.9);
        const vel = n.velocity / 127;
        playNote(inst, Math.max(24, Math.min(108, n.pitch)), t, d, vel);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    }
  }

  // ─── BASS ──────────────────────────────────────────────────────────────────
  if (tracks.bass?.length) {
    if (sampleSet) {
      for (const n of tracks.bass) {
        const t      = now + n.startTime * spb;
        const d      = Math.max(0.1, n.duration * spb * 0.9);
        const vel    = n.velocity / 127;
        const detune = midiToDetune(Math.max(24, Math.min(108, n.pitch)), 48);
        const src    = ctx.createBufferSource();
        const gain   = ctx.createGain();
        src.buffer         = sampleSet.bass;
        src.detune.value   = detune;
        gain.gain.value    = vel;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(t);
        src.stop(t + d);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    } else {
      const inst = await getInstrument('electric_bass_finger');
      for (const n of tracks.bass) {
        const t   = now + n.startTime * spb;
        const d   = Math.max(0.1, n.duration * spb * 0.9);
        const vel = n.velocity / 127;
        playNote(inst, Math.max(24, Math.min(108, n.pitch)), t, d, vel);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    }
  }

  // ─── DRUMS ─────────────────────────────────────────────────────────────────
  if (tracks.drums?.length) {
    if (sampleSet) {
      for (const n of tracks.drums) {
        const t = now + n.startTime * spb;
        const v = Math.max(0.05, Math.min(1, n.velocity / 127));
        const isKick   = n.pitch === 36 || n.pitch === 35;
        const isSnare  = n.pitch === 38 || n.pitch === 40;
        const isOpen   = n.pitch === 46;
        const isClosed = n.pitch === 42 || n.pitch === 51;

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
        gain.connect(ctx.destination);
        src.start(t);
        activeSources.add(src);
        src.onended = () => activeSources.delete(src);
        maxEnd = Math.max(maxEnd, n.startTime * spb + 0.5);
      }
    } else {
      // Synthesized drums — Web Audio API only
      for (const n of tracks.drums) {
        const t       = now + n.startTime * spb;
        const isKick  = n.pitch === 36 || n.pitch === 35;
        const isSnare = n.pitch === 38 || n.pitch === 40;
        const isHat   = n.pitch >= 42;

        if (isKick) {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(150, t);
          osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
          gain.gain.setValueAtTime(0.7, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
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
          gain.connect(ctx.destination);
          src.start(t);
          activeSources.add(src);
          src.onended = () => activeSources.delete(src);
        } else if (isHat) {
          const noiseBuffer = createNoiseBuffer(ctx, 0.05);
          const src    = ctx.createBufferSource();
          const filter = ctx.createBiquadFilter();
          const gain   = ctx.createGain();
          filter.type          = 'highpass';
          filter.frequency.value = 8000;
          src.buffer = noiseBuffer;
          gain.gain.setValueAtTime(0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          src.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          src.start(t);
          activeSources.add(src);
          src.onended = () => activeSources.delete(src);
        }
        maxEnd = Math.max(maxEnd, n.startTime * spb + 0.5);
      }
    }
  }

  if (onComplete) {
    window.setTimeout(() => { stopPlayAll(); onComplete(); }, (maxEnd + 2) * 1000);
  }
}

// Keep midiToNote exported for any consumers that relied on it
export { midiToNote };
