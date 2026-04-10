import * as Tone from 'tone';
import type { NoteEvent } from '@/lib/music-engine';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12] ?? 'C';
  return `${name}${octave}`;
}

let activeNodes: Tone.ToneAudioNode[] = [];

export function stopTonePreview() {
  for (const node of activeNodes) {
    try {
      node.dispose();
    } catch {
      /* ignore */
    }
  }
  activeNodes = [];
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

export type TonePreviewLayer = 'melody' | 'chords' | 'bass' | 'drums';

export async function playTonePreview(
  notes: NoteEvent[],
  bpm: number,
  layer: TonePreviewLayer,
  onComplete?: () => void,
) {
  await Tone.start();
  stopTonePreview();

  if (notes.length === 0) {
    onComplete?.();
    return;
  }

  const secondsPerBeat = 60 / Math.max(60, Math.min(200, bpm));
  const now = Tone.now() + 0.05;

  if (layer === 'melody') {
    const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.25 }).toDestination();
    const delay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.2, wet: 0.1 }).connect(reverb);
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.04, decay: 0.2, sustain: 0.6, release: 1.0 },
      volume: -8,
    }).connect(delay);
    activeNodes.push(reverb, delay, poly);

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const duration = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity = note.velocity / 127;
      poly.triggerAttackRelease(noteName, duration, startTime, velocity);
      maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + duration);
    }
    if (onComplete) {
      window.setTimeout(() => {
        stopTonePreview();
        onComplete();
      }, (maxEnd + 2) * 1000);
    }
    return;
  }

  if (layer === 'chords') {
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.4 }).toDestination();
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.3 }).connect(reverb);
    chorus.start();
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.15, decay: 0.5, sustain: 0.7, release: 2.0 },
      volume: -12,
    }).connect(chorus);
    activeNodes.push(reverb, chorus, poly);

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const duration = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity = note.velocity / 127;
      poly.triggerAttackRelease(noteName, duration, startTime, velocity);
      maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + duration);
    }
    if (onComplete) {
      window.setTimeout(() => {
        stopTonePreview();
        onComplete();
      }, (maxEnd + 2) * 1000);
    }
    return;
  }

  if (layer === 'bass') {
    const filter = new Tone.Filter({ frequency: 500, type: 'lowpass', rolloff: -24 }).toDestination();
    const distortion = new Tone.Distortion({ distortion: 0.15, wet: 0.2 }).connect(filter);
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.3 },
      volume: -6,
    }).connect(distortion);
    activeNodes.push(filter, distortion, poly);

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const duration = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity = note.velocity / 127;
      poly.triggerAttackRelease(noteName, duration, startTime, velocity);
      maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + duration);
    }
    if (onComplete) {
      window.setTimeout(() => {
        stopTonePreview();
        onComplete();
      }, (maxEnd + 2) * 1000);
    }
    return;
  }

  // Drums — shared synths (avoid allocating per hit)
  const reverb = new Tone.Reverb({ decay: 0.5, wet: 0.1 }).toDestination();
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 8,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
    volume: -4,
  }).connect(reverb);
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    volume: -10,
  }).connect(reverb);
  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
    volume: -18,
  }).connect(reverb);
  hat.frequency.value = 400;
  activeNodes.push(reverb, kick, snare, hat);

  let maxEnd = 0;
  for (const note of notes) {
    const startTime = now + note.startTime * secondsPerBeat;
    const isKick = note.pitch === 36 || note.pitch === 35;
    const isSnare = note.pitch === 38 || note.pitch === 40;
    const isHat = note.pitch >= 42;

    if (isKick) {
      kick.triggerAttackRelease('C1', '8n', startTime);
    } else if (isSnare) {
      snare.triggerAttackRelease('8n', startTime);
    } else if (isHat) {
      hat.triggerAttackRelease('32n', startTime);
    }
    maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + 0.5);
  }

  if (onComplete) {
    window.setTimeout(() => {
      stopTonePreview();
      onComplete();
    }, (maxEnd + 1) * 1000);
  }
}
