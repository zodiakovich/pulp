import * as Tone from 'tone';
import type { NoteEvent } from '@/lib/music-engine';
import { bassPresets, chordPresets, melodyPresets, pickPresetIndex } from '@/lib/synth-presets';
import { ensureToneSampleSet, resolveToneSampleSlug } from '@/lib/tone-sample-loader';

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
  genre: string,
  onComplete?: () => void,
) {
  await Tone.start();
  stopPlayAll();

  const spb = 60 / Math.max(60, Math.min(200, bpm));
  let maxEnd = 0;
  const seed = Math.round(bpm) + (tracks.melody?.length ?? 0) + (tracks.chords?.length ?? 0) + (tracks.bass?.length ?? 0);
  const sampleSlug = resolveToneSampleSlug(genre);
  const sampleSet = sampleSlug ? await ensureToneSampleSet(sampleSlug) : null;

  // Pre-create Reverb nodes and await their IR generation in parallel before
  // computing `now`. Tone.Reverb generates its impulse response asynchronously;
  // audio is silent until ready, so we must wait before scheduling any notes.
  const melRev = tracks.melody?.length ? new Tone.Reverb({ decay: 1.8, wet: 0.2 }).toDestination() : null;
  const chRev  = tracks.chords?.length  ? new Tone.Reverb({ decay: 3,   wet: 0.35 }).toDestination() : null;
  const drmRev = tracks.drums?.length   ? new Tone.Reverb({ decay: 0.4, wet: 0.08 }).toDestination() : null;

  await Promise.all(
    ([melRev, chRev, drmRev] as (Tone.Reverb | null)[])
      .filter((r): r is Tone.Reverb => r !== null)
      .map(r => r.ready),
  );

  // All reverbs are ready — grab a fresh timestamp now.
  const now = Tone.now() + 0.05;

  // MELODY — richer layered FM/AM presets + FX
  if (tracks.melody?.length && melRev) {
    const dly = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.15, wet: 0.08 }).connect(melRev);
    if (sampleSet) {
      const sam = sampleSet.samplers.lead;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(dly);
      activeNodes.push(melRev, dly);
      for (const n of tracks.melody) {
        const t = now + n.startTime * spb;
        const d = Math.max(0.1, n.duration * spb * 0.9);
        sam.triggerAttackRelease(midiToNote(Math.max(24, Math.min(108, n.pitch))), d, t, n.velocity / 127);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    } else {
      const idx = pickPresetIndex(seed, melodyPresets.length);
      const inst = melodyPresets[idx]!();
      (inst.output as any).connect(dly);
      activeNodes.push(melRev, dly, ...inst.nodes);
      for (const n of tracks.melody) {
        const t = now + n.startTime * spb;
        const d = Math.max(0.1, n.duration * spb * 0.9);
        inst.trigger(midiToNote(Math.max(24, Math.min(108, n.pitch))), d, t, n.velocity / 127);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    }
  }

  // CHORDS — pad-like layered FM/AM presets + chorus + reverb
  if (tracks.chords?.length && chRev) {
    const cho = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.25 }).connect(chRev);
    cho.start();
    if (sampleSet) {
      const sam = sampleSet.samplers.pad;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(cho);
      activeNodes.push(chRev, cho);
      for (const n of tracks.chords) {
        const t = now + n.startTime * spb;
        const d = Math.max(0.1, n.duration * spb * 0.9);
        sam.triggerAttackRelease(midiToNote(Math.max(24, Math.min(108, n.pitch))), d, t, n.velocity / 127);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    } else {
      const idx = pickPresetIndex(seed + 11, chordPresets.length);
      const inst = chordPresets[idx]!();
      (inst.output as any).connect(cho);
      activeNodes.push(chRev, cho, ...inst.nodes);
      for (const n of tracks.chords) {
        const t = now + n.startTime * spb;
        const d = Math.max(0.1, n.duration * spb * 0.9);
        inst.trigger(midiToNote(Math.max(24, Math.min(108, n.pitch))), d, t, n.velocity / 127);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    }
  }

  // BASS — layered bass presets (includes 808) + filter
  if (tracks.bass?.length) {
    const flt = new Tone.Filter({ frequency: 600, type: 'lowpass', rolloff: -24 }).toDestination();
    if (sampleSet) {
      const sam = sampleSet.samplers.bass;
      try { sam.disconnect(); } catch { /* not yet connected */ }
      sam.connect(flt);
      activeNodes.push(flt);
      for (const n of tracks.bass) {
        const t = now + n.startTime * spb;
        const d = Math.max(0.1, n.duration * spb * 0.9);
        sam.triggerAttackRelease(midiToNote(Math.max(24, Math.min(108, n.pitch))), d, t, n.velocity / 127);
        maxEnd = Math.max(maxEnd, n.startTime * spb + d);
      }
    } else {
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
  }

  // DRUMS — kick + snare + hat (shared synths per layer)
  if (tracks.drums?.length && drmRev) {
    if (sampleSet) {
      const gKick = new Tone.Gain(1).connect(drmRev);
      const gSnare = new Tone.Gain(1).connect(drmRev);
      const gCH = new Tone.Gain(1).connect(drmRev);
      const gOH = new Tone.Gain(1).connect(drmRev);
      const gPerc = new Tone.Gain(1).connect(drmRev);
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
      activeNodes.push(drmRev, gKick, gSnare, gCH, gOH, gPerc);

      for (const n of tracks.drums) {
        const t = now + n.startTime * spb;
        const v = Math.max(0.05, Math.min(1, n.velocity / 127));
        const isKick = n.pitch === 36 || n.pitch === 35;
        const isSnare = n.pitch === 38 || n.pitch === 40;
        const isOpen = n.pitch === 46;
        const isClosed = n.pitch === 42 || n.pitch === 51;

        if (isKick) { gKick.gain.setValueAtTime(v, t); sampleSet.players.kick.start(t); }
        else if (isSnare) { gSnare.gain.setValueAtTime(v, t); sampleSet.players.snare.start(t); }
        else if (isOpen) { gOH.gain.setValueAtTime(v, t); sampleSet.players['open-hat'].start(t); }
        else if (isClosed) { gCH.gain.setValueAtTime(v, t); sampleSet.players['closed-hat'].start(t); }
        else { gPerc.gain.setValueAtTime(v, t); sampleSet.players.perc.start(t); }

        maxEnd = Math.max(maxEnd, n.startTime * spb + 0.5);
      }
    } else {
      const kick = new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 8,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
        volume: -4,
      }).connect(drmRev);
      const snr = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
        volume: -12,
      }).connect(drmRev);
      const hat = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
        volume: -20,
      }).connect(drmRev);
      hat.frequency.value = 400;
      activeNodes.push(drmRev, kick, snr, hat);

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
  }

  if (onComplete) {
    window.setTimeout(() => {
      stopPlayAll();
      onComplete();
    }, (maxEnd + 2) * 1000);
  }
}
