import * as Tone from 'tone';
import type { NoteEvent } from '@/lib/music-engine';
import {
  bassPresets, chordPresets, melodyPresets, pickPresetIndex,
  type LayeredInstrument,
} from '@/lib/synth-presets';
import { ensureToneSampleSet, resolveToneSampleSlug } from '@/lib/tone-sample-loader';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNote(midi: number): string {
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12] ?? 'C'}${oct}`;
}

let activeNodes: Tone.ToneAudioNode[] = [];

export function stopPlayAll() {
  for (const n of activeNodes) {
    try { n.dispose(); } catch { /* ignore */ }
  }
  activeNodes = [];
}

export async function playAll(
  tracks: { melody?: NoteEvent[]; chords?: NoteEvent[]; bass?: NoteEvent[]; drums?: NoteEvent[] },
  bpm: number,
  genre: string,
  onComplete?: () => void,
) {
  await Tone.start();
  stopPlayAll();

  const hasNotes =
    (tracks.melody?.length ?? 0) +
    (tracks.chords?.length ?? 0) +
    (tracks.bass?.length ?? 0) +
    (tracks.drums?.length ?? 0);
  if (!hasNotes) { onComplete?.(); return; }

  const spb = 60 / Math.max(60, Math.min(200, bpm));
  const seed =
    Math.round(bpm) +
    (tracks.melody?.length ?? 0) +
    (tracks.chords?.length ?? 0) +
    (tracks.bass?.length ?? 0);

  // Only async step: sample loading. `now` is computed after so timestamps are fresh.
  const sampleSlug = resolveToneSampleSlug(genre);
  const sampleSet = sampleSlug ? await ensureToneSampleSet(sampleSlug) : null;

  const now = Tone.now() + 0.05;
  let maxEnd = 0;

  // ─── MELODY ────────────────────────────────────────────────────────────────
  if (tracks.melody?.length) {
    // FeedbackDelay → Destination (synchronous, no async setup needed)
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
    for (const n of tracks.melody) {
      const t    = now + n.startTime * spb;
      const d    = Math.max(0.1, n.duration * spb * 0.9);
      const note = midiToNote(Math.max(24, Math.min(108, n.pitch)));
      const vel  = n.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.lead.triggerAttackRelease(note, d, t, vel);
      } else {
        melInst?.trigger(note, d, t, vel);
      }
      maxEnd = Math.max(maxEnd, n.startTime * spb + d);
    }
  }

  // ─── CHORDS ────────────────────────────────────────────────────────────────
  if (tracks.chords?.length) {
    // Chorus → Destination
    const cho = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.25 }).toDestination();
    cho.start();
    let chInst: LayeredInstrument | null = null;
    if (sampleSet) {
      const sam = sampleSet.samplers.pad;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(cho);
      activeNodes.push(cho);
    } else {
      chInst = chordPresets[pickPresetIndex(seed + 11, chordPresets.length)]!();
      (chInst.output as any).connect(cho);
      activeNodes.push(cho, ...chInst.nodes);
    }
    for (const n of tracks.chords) {
      const t    = now + n.startTime * spb;
      const d    = Math.max(0.1, n.duration * spb * 0.9);
      const note = midiToNote(Math.max(24, Math.min(108, n.pitch)));
      const vel  = n.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.pad.triggerAttackRelease(note, d, t, vel);
      } else {
        chInst?.trigger(note, d, t, vel);
      }
      maxEnd = Math.max(maxEnd, n.startTime * spb + d);
    }
  }

  // ─── BASS ──────────────────────────────────────────────────────────────────
  if (tracks.bass?.length) {
    // Filter → Destination
    const flt = new Tone.Filter({ frequency: 600, type: 'lowpass', rolloff: -24 }).toDestination();
    let bassInst: LayeredInstrument | null = null;
    if (sampleSet) {
      const sam = sampleSet.samplers.bass;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(flt);
      activeNodes.push(flt);
    } else {
      bassInst = bassPresets[pickPresetIndex(seed + 29, bassPresets.length)]!();
      (bassInst.output as any).connect(flt);
      activeNodes.push(flt, ...bassInst.nodes);
    }
    for (const n of tracks.bass) {
      const t    = now + n.startTime * spb;
      const d    = Math.max(0.1, n.duration * spb * 0.9);
      const note = midiToNote(Math.max(24, Math.min(108, n.pitch)));
      const vel  = n.velocity / 127;
      if (sampleSet) {
        sampleSet.samplers.bass.triggerAttackRelease(note, d, t, vel);
      } else {
        bassInst?.trigger(note, d, t, vel);
      }
      maxEnd = Math.max(maxEnd, n.startTime * spb + d);
    }
  }

  // ─── DRUMS ─────────────────────────────────────────────────────────────────
  if (tracks.drums?.length) {
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

      for (const n of tracks.drums) {
        const t       = now + n.startTime * spb;
        const v       = Math.max(0.05, Math.min(1, n.velocity / 127));
        const isKick   = n.pitch === 36 || n.pitch === 35;
        const isSnare  = n.pitch === 38 || n.pitch === 40;
        const isOpen   = n.pitch === 46;
        const isClosed = n.pitch === 42 || n.pitch === 51;
        if (isKick)        { gKick.gain.setValueAtTime(v, t);  sampleSet.players.kick.start(t); }
        else if (isSnare)  { gSnare.gain.setValueAtTime(v, t); sampleSet.players.snare.start(t); }
        else if (isOpen)   { gOH.gain.setValueAtTime(v, t);    sampleSet.players['open-hat'].start(t); }
        else if (isClosed) { gCH.gain.setValueAtTime(v, t);    sampleSet.players['closed-hat'].start(t); }
        else               { gPerc.gain.setValueAtTime(v, t);  sampleSet.players.perc.start(t); }
        maxEnd = Math.max(maxEnd, n.startTime * spb + 0.5);
      }
    } else {
      // Synth drums — connect directly to destination.
      const kick = new Tone.MembraneSynth({
        pitchDecay: 0.08, octaves: 8,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
        volume: -4,
      }).toDestination();
      const snr = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
        volume: -12,
      }).toDestination();
      const hat = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
        harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
        volume: -20,
      }).toDestination();
      hat.frequency.value = 400;
      activeNodes.push(kick, snr, hat);

      for (const n of tracks.drums) {
        const t      = now + n.startTime * spb;
        const isKick  = n.pitch === 36 || n.pitch === 35;
        const isSnare = n.pitch === 38 || n.pitch === 40;
        const isHat   = n.pitch >= 42;
        if (isKick)       kick.triggerAttackRelease('C1', '8n', t);
        else if (isSnare) snr.triggerAttackRelease('8n', t);
        else if (isHat)   hat.triggerAttackRelease('32n', t);
        maxEnd = Math.max(maxEnd, n.startTime * spb + 0.5);
      }
    }
  }

  if (onComplete) {
    window.setTimeout(() => { stopPlayAll(); onComplete(); }, (maxEnd + 2) * 1000);
  }
}
