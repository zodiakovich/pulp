import * as Tone from 'tone';
import type { NoteEvent } from '@/lib/music-engine';
import {
  bassPresets, chordPresets, melodyPresets, pickPresetIndex,
  type LayeredInstrument,
} from '@/lib/synth-presets';
import { ensureToneSampleSet, resolveToneSampleSlug } from '@/lib/tone-sample-loader';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12] ?? 'C';
  return `${name}${octave}`;
}

let activeNodes: Tone.ToneAudioNode[] = [];

export function stopTonePreview() {
  for (const node of activeNodes) {
    try { node.dispose(); } catch { /* ignore */ }
  }
  activeNodes = [];
  // Do NOT call Tone.Transport.stop/cancel — we use absolute-time scheduling,
  // not Transport-relative, and stop() can disrupt in-progress async previews.
}

export type TonePreviewLayer = 'melody' | 'chords' | 'bass' | 'drums';

export async function playTonePreview(
  notes: NoteEvent[],
  bpm: number,
  layer: TonePreviewLayer,
  genre: string,
  onComplete?: () => void,
) {
  await Tone.start();
  stopTonePreview();

  if (notes.length === 0) {
    onComplete?.();
    return;
  }

  const secondsPerBeat = 60 / Math.max(60, Math.min(200, bpm));
  const seed = Math.round(bpm) + notes.length;

  // Only async step: sample loading. `now` is computed after so timestamps are fresh.
  const sampleSlug = resolveToneSampleSlug(genre);
  const sampleSet = sampleSlug ? await ensureToneSampleSet(sampleSlug) : null;

  const now = Tone.now() + 0.05;

  // ─── MELODY ────────────────────────────────────────────────────────────────
  if (layer === 'melody') {
    // FeedbackDelay → Destination (synchronous, no async setup)
    const dly = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.2, wet: 0.1 }).toDestination();
    let melInst: LayeredInstrument | null = null;
    if (sampleSet) {
      const sam = sampleSet.samplers.lead;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(dly);
      activeNodes.push(dly);
    } else {
      melInst = melodyPresets[pickPresetIndex(seed, melodyPresets.length)]!();
      (melInst.output as any).connect(dly);
      activeNodes.push(dly, ...melInst.nodes);
    }

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const duration  = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName  = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity  = note.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.lead.triggerAttackRelease(noteName, duration, startTime, velocity);
      } else {
        melInst?.trigger(noteName, duration, startTime, velocity);
      }
      maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + duration);
    }
    if (onComplete) {
      window.setTimeout(() => { stopTonePreview(); onComplete(); }, (maxEnd + 2) * 1000);
    }
    return;
  }

  // ─── CHORDS ────────────────────────────────────────────────────────────────
  if (layer === 'chords') {
    // Chorus → Destination
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.3 }).toDestination();
    chorus.start();
    let chInst: LayeredInstrument | null = null;
    if (sampleSet) {
      const sam = sampleSet.samplers.pad;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(chorus);
      activeNodes.push(chorus);
    } else {
      chInst = chordPresets[pickPresetIndex(seed + 11, chordPresets.length)]!();
      (chInst.output as any).connect(chorus);
      activeNodes.push(chorus, ...chInst.nodes);
    }

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const duration  = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName  = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity  = note.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.pad.triggerAttackRelease(noteName, duration, startTime, velocity);
      } else {
        chInst?.trigger(noteName, duration, startTime, velocity);
      }
      maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + duration);
    }
    if (onComplete) {
      window.setTimeout(() => { stopTonePreview(); onComplete(); }, (maxEnd + 2) * 1000);
    }
    return;
  }

  // ─── BASS ──────────────────────────────────────────────────────────────────
  if (layer === 'bass') {
    // Filter → Destination
    const filter = new Tone.Filter({ frequency: 500, type: 'lowpass', rolloff: -24 }).toDestination();
    const distortion = new Tone.Distortion({ distortion: 0.15, wet: 0.2 }).connect(filter);
    let bassInst: LayeredInstrument | null = null;
    if (sampleSet) {
      const sam = sampleSet.samplers.bass;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(distortion);
      activeNodes.push(filter, distortion);
    } else {
      bassInst = bassPresets[pickPresetIndex(seed + 29, bassPresets.length)]!();
      (bassInst.output as any).connect(distortion);
      activeNodes.push(filter, distortion, ...bassInst.nodes);
    }

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const duration  = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName  = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity  = note.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.bass.triggerAttackRelease(noteName, duration, startTime, velocity);
      } else {
        bassInst?.trigger(noteName, duration, startTime, velocity);
      }
      maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + duration);
    }
    if (onComplete) {
      window.setTimeout(() => { stopTonePreview(); onComplete(); }, (maxEnd + 2) * 1000);
    }
    return;
  }

  // ─── DRUMS ─────────────────────────────────────────────────────────────────
  if (layer === 'drums') {
    if (sampleSet) {
      // Per-drum Gain nodes allow per-hit velocity without storing shared players in activeNodes.
      const gKick  = new Tone.Gain(1).toDestination();
      const gSnare = new Tone.Gain(1).toDestination();
      const gCH    = new Tone.Gain(1).toDestination();
      const gOH    = new Tone.Gain(1).toDestination();
      const gPerc  = new Tone.Gain(1).toDestination();
      try { sampleSet.players.kick.disconnect(); }          catch { /* not yet connected */ }
      try { sampleSet.players.snare.disconnect(); }         catch { /* not yet connected */ }
      try { sampleSet.players['closed-hat'].disconnect(); } catch { /* not yet connected */ }
      try { sampleSet.players['open-hat'].disconnect(); }   catch { /* not yet connected */ }
      try { sampleSet.players.perc.disconnect(); }          catch { /* not yet connected */ }
      sampleSet.players.kick.connect(gKick);
      sampleSet.players.snare.connect(gSnare);
      sampleSet.players['closed-hat'].connect(gCH);
      sampleSet.players['open-hat'].connect(gOH);
      sampleSet.players.perc.connect(gPerc);
      activeNodes.push(gKick, gSnare, gCH, gOH, gPerc);

      let maxEnd = 0;
      for (const note of notes) {
        const startTime = now + note.startTime * secondsPerBeat;
        const v         = Math.max(0.05, Math.min(1, note.velocity / 127));
        const isKick   = note.pitch === 36 || note.pitch === 35;
        const isSnare  = note.pitch === 38 || note.pitch === 40;
        const isOpen   = note.pitch === 46;
        const isClosed = note.pitch === 42 || note.pitch === 51;
        if (isKick)        { gKick.gain.setValueAtTime(v, startTime);  sampleSet.players.kick.start(startTime); }
        else if (isSnare)  { gSnare.gain.setValueAtTime(v, startTime); sampleSet.players.snare.start(startTime); }
        else if (isOpen)   { gOH.gain.setValueAtTime(v, startTime);    sampleSet.players['open-hat'].start(startTime); }
        else if (isClosed) { gCH.gain.setValueAtTime(v, startTime);    sampleSet.players['closed-hat'].start(startTime); }
        else               { gPerc.gain.setValueAtTime(v, startTime);  sampleSet.players.perc.start(startTime); }
        maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + 0.5);
      }
      if (onComplete) {
        window.setTimeout(() => { stopTonePreview(); onComplete(); }, (maxEnd + 1) * 1000);
      }
      return;
    }

    // Synth drums — connect directly to destination.
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.08, octaves: 8,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
      volume: -4,
    }).toDestination();
    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
      volume: -10,
    }).toDestination();
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
      volume: -18,
    }).toDestination();
    hat.frequency.value = 400;
    activeNodes.push(kick, snare, hat);

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const isKick  = note.pitch === 36 || note.pitch === 35;
      const isSnare = note.pitch === 38 || note.pitch === 40;
      const isHat   = note.pitch >= 42;
      if (isKick)       kick.triggerAttackRelease('C1', '8n', startTime);
      else if (isSnare) snare.triggerAttackRelease('8n', startTime);
      else if (isHat)   hat.triggerAttackRelease('32n', startTime);
      maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + 0.5);
    }
    if (onComplete) {
      window.setTimeout(() => { stopTonePreview(); onComplete(); }, (maxEnd + 1) * 1000);
    }
  }
}
