import * as Tone from 'tone';
import type { NoteEvent } from '@/lib/music-engine';
import { bassPresets, chordPresets, melodyPresets, pickPresetIndex, type LayeredInstrument } from '@/lib/synth-presets';
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
  const sampleSlug = resolveToneSampleSlug(genre);
  const sampleSet = sampleSlug ? await ensureToneSampleSet(sampleSlug) : null;

  // Pre-create Reverb and await IR generation before computing `now`.
  // Tone.Reverb generates its impulse response asynchronously; audio is
  // silent until ready, so we must wait before scheduling any notes.
  // Bass uses no reverb, so skip it for that layer.
  const reverbDecay = layer === 'melody' ? 1.8 : layer === 'chords' ? 3 : layer === 'drums' ? 0.5 : null;
  const reverbWet   = layer === 'melody' ? 0.25 : layer === 'chords' ? 0.4 : layer === 'drums' ? 0.1 : null;
  const reverb = (reverbDecay !== null && reverbWet !== null)
    ? new Tone.Reverb({ decay: reverbDecay, wet: reverbWet }).toDestination()
    : null;

  if (reverb) {
    await reverb.ready;
  }

  // All async work is done — grab a fresh timestamp now.
  const now = Tone.now() + 0.05;

  if (layer === 'melody' && reverb) {
    const delay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.2, wet: 0.1 }).connect(reverb);
    let melInst: LayeredInstrument | null = null;
    if (sampleSet) {
      const sam = sampleSet.samplers.lead;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(delay);
      activeNodes.push(reverb, delay);
    } else {
      melInst = melodyPresets[pickPresetIndex(seed, melodyPresets.length)]!();
      (melInst.output as any).connect(delay);
      activeNodes.push(reverb, delay, ...melInst.nodes);
    }

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const duration = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity = note.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.lead.triggerAttackRelease(noteName, duration as any, startTime, velocity);
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

  if (layer === 'chords' && reverb) {
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.3 }).connect(reverb);
    chorus.start();
    let chInst: LayeredInstrument | null = null;
    if (sampleSet) {
      const sam = sampleSet.samplers.pad;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(chorus);
      activeNodes.push(reverb, chorus);
    } else {
      chInst = chordPresets[pickPresetIndex(seed + 11, chordPresets.length)]!();
      (chInst.output as any).connect(chorus);
      activeNodes.push(reverb, chorus, ...chInst.nodes);
    }

    let maxEnd = 0;
    for (const note of notes) {
      const startTime = now + note.startTime * secondsPerBeat;
      const duration = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity = note.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.pad.triggerAttackRelease(noteName, duration as any, startTime, velocity);
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

  if (layer === 'bass') {
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
      const duration = Math.max(0.1, note.duration * secondsPerBeat * 0.9);
      const noteName = midiToNoteName(Math.max(24, Math.min(108, note.pitch)));
      const velocity = note.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.bass.triggerAttackRelease(noteName, duration as any, startTime, velocity);
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

  // Drums
  if (reverb) {
    if (sampleSet) {
      const gKick  = new Tone.Gain(1).connect(reverb);
      const gSnare = new Tone.Gain(1).connect(reverb);
      const gCH    = new Tone.Gain(1).connect(reverb);
      const gOH    = new Tone.Gain(1).connect(reverb);
      const gPerc  = new Tone.Gain(1).connect(reverb);
      try { sampleSet.players.kick.disconnect(); } catch { /* not yet connected */ }
      try { sampleSet.players.snare.disconnect(); } catch { /* not yet connected */ }
      try { sampleSet.players['closed-hat'].disconnect(); } catch { /* not yet connected */ }
      try { sampleSet.players['open-hat'].disconnect(); } catch { /* not yet connected */ }
      try { sampleSet.players.perc.disconnect(); } catch { /* not yet connected */ }
      sampleSet.players.kick.connect(gKick);
      sampleSet.players.snare.connect(gSnare);
      sampleSet.players['closed-hat'].connect(gCH);
      sampleSet.players['open-hat'].connect(gOH);
      sampleSet.players.perc.connect(gPerc);
      activeNodes.push(reverb, gKick, gSnare, gCH, gOH, gPerc);

      let maxEnd = 0;
      for (const note of notes) {
        const startTime = now + note.startTime * secondsPerBeat;
        const v = Math.max(0.05, Math.min(1, note.velocity / 127));
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

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.08, octaves: 8,
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
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
      volume: -18,
    }).connect(reverb);
    hat.frequency.value = 400;
    activeNodes.push(reverb, kick, snare, hat);

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
