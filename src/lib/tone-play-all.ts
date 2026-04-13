import * as Tone from 'tone';
import type { NoteEvent } from '@/lib/music-engine';
import { bassPresets, chordPresets, melodyPresets, pickPresetIndex } from '@/lib/synth-presets';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNote(midi: number): string {
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12] ?? 'C'}${oct}`;
}

let activeNodes: Tone.ToneAudioNode[] = [];

export function stopPlayAll() {
  for (const n of activeNodes) {
    try {
      n.dispose();
    } catch {
      /* ignore */
    }
  }
  activeNodes = [];
}

export async function playAll(
  tracks: { melody?: NoteEvent[]; chords?: NoteEvent[]; bass?: NoteEvent[]; drums?: NoteEvent[] },
  bpm: number,
  onComplete?: () => void,
) {
  await Tone.start();
  stopPlayAll();

  const spb = 60 / Math.max(60, Math.min(200, bpm));
  const now = Tone.now() + 0.05;
  let maxEnd = 0;
  const seed = Math.round(bpm) + (tracks.melody?.length ?? 0) + (tracks.chords?.length ?? 0) + (tracks.bass?.length ?? 0);

  // MELODY — richer layered FM/AM presets + FX
  if (tracks.melody?.length) {
    const rev = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).toDestination();
    const dly = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.15, wet: 0.08 }).connect(rev);
    const idx = pickPresetIndex(seed, melodyPresets.length);
    const inst = melodyPresets[idx]!();
    (inst.output as any).connect(dly);
    activeNodes.push(rev, dly, ...inst.nodes);
    for (const n of tracks.melody) {
      const t = now + n.startTime * spb;
      const d = Math.max(0.1, n.duration * spb * 0.9);
      inst.trigger(midiToNote(Math.max(24, Math.min(108, n.pitch))), d, t, n.velocity / 127);
      maxEnd = Math.max(maxEnd, n.startTime * spb + d);
    }
  }

  // CHORDS — pad-like layered FM/AM presets + chorus + reverb
  if (tracks.chords?.length) {
    const rev = new Tone.Reverb({ decay: 3, wet: 0.35 }).toDestination();
    const cho = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.25 }).connect(rev);
    cho.start();
    const idx = pickPresetIndex(seed + 11, chordPresets.length);
    const inst = chordPresets[idx]!();
    (inst.output as any).connect(cho);
    activeNodes.push(rev, cho, ...inst.nodes);
    for (const n of tracks.chords) {
      const t = now + n.startTime * spb;
      const d = Math.max(0.1, n.duration * spb * 0.9);
      inst.trigger(midiToNote(Math.max(24, Math.min(108, n.pitch))), d, t, n.velocity / 127);
      maxEnd = Math.max(maxEnd, n.startTime * spb + d);
    }
  }

  // BASS — layered bass presets (includes 808) + filter
  if (tracks.bass?.length) {
    const flt = new Tone.Filter({ frequency: 600, type: 'lowpass', rolloff: -24 }).toDestination();
    const idx = pickPresetIndex(seed + 29, bassPresets.length);
    const inst = bassPresets[idx]!();
    (inst.output as any).connect(flt);
    activeNodes.push(flt, ...inst.nodes);
    for (const n of tracks.bass) {
      const t = now + n.startTime * spb;
      const d = Math.max(0.1, n.duration * spb * 0.9);
      inst.trigger(midiToNote(Math.max(24, Math.min(108, n.pitch))), d, t, n.velocity / 127);
      maxEnd = Math.max(maxEnd, n.startTime * spb + d);
    }
  }

  // DRUMS — kick + snare + hat (shared synths per layer)
  if (tracks.drums?.length) {
    const rev = new Tone.Reverb({ decay: 0.4, wet: 0.08 }).toDestination();
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 8,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
      volume: -4,
    }).connect(rev);
    const snr = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      volume: -12,
    }).connect(rev);
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -20,
    }).connect(rev);
    hat.frequency.value = 400;
    activeNodes.push(rev, kick, snr, hat);

    for (const n of tracks.drums) {
      const t = now + n.startTime * spb;
      const isKick = n.pitch === 36 || n.pitch === 35;
      const isSnare = n.pitch === 38 || n.pitch === 40;
      const isHat = n.pitch >= 42;

      if (isKick) {
        kick.triggerAttackRelease('C1', '8n', t);
      } else if (isSnare) {
        snr.triggerAttackRelease('8n', t);
      } else if (isHat) {
        hat.triggerAttackRelease('32n', t);
      }
      maxEnd = Math.max(maxEnd, n.startTime * spb + 0.5);
    }
  }

  if (onComplete) {
    window.setTimeout(() => {
      stopPlayAll();
      onComplete();
    }, (maxEnd + 2) * 1000);
  }
}
