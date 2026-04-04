// ============================================================
// PULP — MIDI File Writer
// Generates valid Standard MIDI Format 0/1 files
// Compatible with FL Studio, Ableton, Logic, etc.
// ============================================================

import { NoteEvent } from './music-engine';

// --- VARIABLE LENGTH QUANTITY ---
function writeVLQ(value: number): number[] {
  if (value < 0) value = 0;
  const bytes: number[] = [];
  bytes.unshift(value & 0x7f);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return bytes;
}

// --- WRITE 16-BIT BIG ENDIAN ---
function write16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

// --- WRITE 32-BIT BIG ENDIAN ---
function write32(value: number): number[] {
  return [
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ];
}

// --- CONVERT BEATS TO TICKS ---
const TICKS_PER_BEAT = 480;

function beatsToTicks(beats: number): number {
  return Math.round(beats * TICKS_PER_BEAT);
}

// --- BUILD TRACK DATA ---
interface MidiEvent {
  absoluteTick: number;
  data: number[];
}

function buildTrackEvents(notes: NoteEvent[], channel: number): MidiEvent[] {
  const events: MidiEvent[] = [];

  for (const note of notes) {
    const startTick = beatsToTicks(note.startTime);
    const endTick = beatsToTicks(note.startTime + note.duration);
    const vel = Math.max(1, Math.min(127, Math.round(note.velocity)));
    const pitch = Math.max(0, Math.min(127, Math.round(note.pitch)));

    // Note On
    events.push({
      absoluteTick: startTick,
      data: [0x90 | channel, pitch, vel],
    });

    // Note Off
    events.push({
      absoluteTick: endTick,
      data: [0x80 | channel, pitch, 0],
    });
  }

  // Sort by time (stable: note-on before note-off at same tick)
  events.sort((a, b) => {
    if (a.absoluteTick !== b.absoluteTick) return a.absoluteTick - b.absoluteTick;
    // Note-on before note-off
    const aIsOn = (a.data[0] & 0xf0) === 0x90;
    const bIsOn = (b.data[0] & 0xf0) === 0x90;
    if (aIsOn && !bIsOn) return -1;
    if (!aIsOn && bIsOn) return 1;
    return 0;
  });

  return events;
}

function eventsToTrackBytes(events: MidiEvent[], bpm?: number, trackName?: string): number[] {
  const trackData: number[] = [];

  // Optional: tempo event at start
  if (bpm) {
    const microsecondsPerBeat = Math.round(60000000 / bpm);
    trackData.push(...writeVLQ(0)); // delta time 0
    trackData.push(0xff, 0x51, 0x03); // tempo meta event
    trackData.push(
      (microsecondsPerBeat >> 16) & 0xff,
      (microsecondsPerBeat >> 8) & 0xff,
      microsecondsPerBeat & 0xff
    );
  }

  // Optional: track name
  if (trackName) {
    const nameBytes = Array.from(new TextEncoder().encode(trackName));
    trackData.push(...writeVLQ(0)); // delta time 0
    trackData.push(0xff, 0x03); // track name meta event
    trackData.push(...writeVLQ(nameBytes.length));
    trackData.push(...nameBytes);
  }

  // Write note events with delta times
  let lastTick = 0;
  for (const event of events) {
    const delta = Math.max(0, event.absoluteTick - lastTick);
    trackData.push(...writeVLQ(delta));
    trackData.push(...event.data);
    lastTick = event.absoluteTick;
  }

  // End of track
  trackData.push(...writeVLQ(0));
  trackData.push(0xff, 0x2f, 0x00);

  return trackData;
}

// --- FORMAT 0: SINGLE TRACK (all layers merged) ---
export function generateMidiFormat0(
  notes: NoteEvent[],
  bpm: number,
  trackName: string = 'pulp'
): Uint8Array {
  const events = buildTrackEvents(notes, 0);
  const trackBytes = eventsToTrackBytes(events, bpm, trackName);

  const header = [
    // MThd
    0x4d, 0x54, 0x68, 0x64,
    ...write32(6),        // header length
    ...write16(0),        // format 0
    ...write16(1),        // 1 track
    ...write16(TICKS_PER_BEAT),
  ];

  const trackHeader = [
    // MTrk
    0x4d, 0x54, 0x72, 0x6b,
    ...write32(trackBytes.length),
  ];

  const result = new Uint8Array(header.length + trackHeader.length + trackBytes.length);
  result.set(header, 0);
  result.set(trackHeader, header.length);
  result.set(trackBytes, header.length + trackHeader.length);

  return result;
}

// --- FORMAT 1: MULTI-TRACK (separate layers) ---
export interface MultiTrackInput {
  name: string;
  notes: NoteEvent[];
  channel: number;
}

export function generateMidiFormat1(
  tracks: MultiTrackInput[],
  bpm: number
): Uint8Array {
  const allTrackBytes: number[][] = [];

  // Track 0: tempo track (no notes)
  const tempoTrack = eventsToTrackBytes([], bpm, 'pulp');
  allTrackBytes.push(tempoTrack);

  // Remaining tracks: one per layer
  for (const track of tracks) {
    const events = buildTrackEvents(track.notes, track.channel);
    const bytes = eventsToTrackBytes(events, undefined, track.name);
    allTrackBytes.push(bytes);
  }

  // Calculate total size
  const numTracks = allTrackBytes.length;
  const header = [
    0x4d, 0x54, 0x68, 0x64,
    ...write32(6),
    ...write16(1),           // format 1
    ...write16(numTracks),
    ...write16(TICKS_PER_BEAT),
  ];

  let totalSize = header.length;
  const trackHeaders: number[][] = [];
  for (const tb of allTrackBytes) {
    const th = [0x4d, 0x54, 0x72, 0x6b, ...write32(tb.length)];
    trackHeaders.push(th);
    totalSize += th.length + tb.length;
  }

  const result = new Uint8Array(totalSize);
  let offset = 0;
  result.set(header, offset);
  offset += header.length;

  for (let i = 0; i < numTracks; i++) {
    result.set(trackHeaders[i], offset);
    offset += trackHeaders[i].length;
    result.set(allTrackBytes[i], offset);
    offset += allTrackBytes[i].length;
  }

  return result;
}

// --- DOWNLOAD HELPER ---
export function downloadMidi(data: Uint8Array, filename: string): void {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
