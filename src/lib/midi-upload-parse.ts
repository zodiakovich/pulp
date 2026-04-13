import { parseMidi } from 'midi-file';
import type {
  MidiData,
  MidiEvent,
  MidiKeySignatureEvent,
  MidiNoteOffEvent,
  MidiNoteOnEvent,
  MidiSetTempoEvent,
} from 'midi-file';

export type ParsedMidiNote = {
  channel: number;
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Pair noteOn/noteOff into absolute-beat note list + BPM / optional key signature. */
export function parseMidiToAnalysis(buffer: Uint8Array): {
  bpm: number;
  ticksPerBeat: number;
  keyGuess: string;
  scaleGuess: string;
  notes: ParsedMidiNote[];
  totalBeats: number;
  noteDensity: number;
} {
  const midi = parseMidi(buffer) as MidiData;
  const ticksPerBeat = midi.header.ticksPerBeat ?? 480;
  let bpm = 120;

  const paired: ParsedMidiNote[] = [];

  for (const track of midi.tracks) {
    let absTick = 0;
    const active = new Map<string, { startTick: number; velocity: number; channel: number; pitch: number }>();

    for (const ev of track as MidiEvent[]) {
      absTick += ev.deltaTime;

      if (ev.type === 'setTempo' && 'microsecondsPerBeat' in ev) {
        const us = (ev as MidiSetTempoEvent).microsecondsPerBeat;
        if (us > 0) bpm = Math.round(60_000_000 / us);
        bpm = Math.max(60, Math.min(200, bpm));
      }

      if (ev.type === 'noteOn') {
        const e = ev as MidiNoteOnEvent;
        const k = `${e.channel}:${e.noteNumber}`;
        if (e.velocity > 0) {
          active.set(k, { startTick: absTick, velocity: e.velocity, channel: e.channel, pitch: e.noteNumber });
        } else {
          const st = active.get(k);
          if (st) {
            const durTicks = absTick - st.startTick;
            if (durTicks > 0) {
              paired.push({
                channel: st.channel,
                pitch: st.pitch,
                startBeat: st.startTick / ticksPerBeat,
                durationBeats: durTicks / ticksPerBeat,
                velocity: st.velocity,
              });
            }
            active.delete(k);
          }
        }
      } else if (ev.type === 'noteOff') {
        const e = ev as MidiNoteOffEvent;
        const k = `${e.channel}:${e.noteNumber}`;
        const st = active.get(k);
        if (st) {
          const durTicks = absTick - st.startTick;
          if (durTicks > 0) {
            paired.push({
              channel: st.channel,
              pitch: e.noteNumber,
              startBeat: st.startTick / ticksPerBeat,
              durationBeats: durTicks / ticksPerBeat,
              velocity: st.velocity,
            });
          }
          active.delete(k);
        }
      }
    }
  }

  paired.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);

  let maxEnd = 0;
  for (const n of paired) {
    maxEnd = Math.max(maxEnd, n.startBeat + n.durationBeats);
  }
  const totalBeats = Math.max(4, maxEnd);
  const noteDensity = paired.length / totalBeats;

  const MAJOR_ROOTS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'] as const;
  let keyGuess = 'A';
  let scaleGuess = 'minor';
  let keyFromMeta = false;
  for (const track of midi.tracks) {
    for (const ev of track as MidiEvent[]) {
      if (ev.type === 'keySignature' && 'key' in ev) {
        const ks = ev as MidiKeySignatureEvent;
        const minor = ks.scale === 1;
        const idx = Math.min(14, Math.max(0, ks.key + 7));
        keyGuess = MAJOR_ROOTS[idx] ?? 'C';
        scaleGuess = minor ? 'minor' : 'major';
        keyFromMeta = true;
        break;
      }
    }
    if (keyFromMeta) break;
  }
  if (!keyFromMeta && paired.length > 0) {
    const counts = new Array(12).fill(0);
    for (const n of paired) {
      if (n.channel === 9) continue;
      counts[n.pitch % 12] += 1 + n.durationBeats;
    }
    let bestI = 0;
    for (let i = 1; i < 12; i++) {
      if (counts[i] > counts[bestI]) bestI = i;
    }
    keyGuess = KEY_NAMES[bestI] ?? 'A';
  }

  return {
    bpm,
    ticksPerBeat,
    keyGuess,
    scaleGuess,
    notes: paired,
    totalBeats,
    noteDensity,
  };
}

/** Rough 4-way split for Claude context (not authoritative). */
export function bucketNotesForPrompt(notes: ParsedMidiNote[]): {
  drums: ParsedMidiNote[];
  bass: ParsedMidiNote[];
  chords: ParsedMidiNote[];
  melody: ParsedMidiNote[];
} {
  const drums: ParsedMidiNote[] = [];
  const bass: ParsedMidiNote[] = [];
  const chords: ParsedMidiNote[] = [];
  const melody: ParsedMidiNote[] = [];

  for (const n of notes) {
    if (n.channel === 9) {
      drums.push(n);
    } else if (n.pitch < 52) {
      bass.push(n);
    } else if (n.durationBeats >= 1.25) {
      chords.push(n);
    } else {
      melody.push(n);
    }
  }
  return { drums, bass, chords, melody };
}

export function sampleNotesForPrompt(notes: ParsedMidiNote[], max: number): ParsedMidiNote[] {
  if (notes.length <= max) return notes;
  const step = Math.ceil(notes.length / max);
  const out: ParsedMidiNote[] = [];
  for (let i = 0; i < notes.length && out.length < max; i += step) {
    out.push(notes[i]!);
  }
  return out;
}
