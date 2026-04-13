import type { GenerationResult, NoteEvent } from './music-engine';
import { DS } from './design-system';

type AbletonLayer = 'Melody' | 'Chords' | 'Bass' | 'Drums';

/** Hex approximations of DS layer tints (accent + white opacities) for Ableton XML Color fields. */
const TRACKS: Array<{ key: keyof GenerationResult; name: AbletonLayer; color: string }> = [
  { key: 'melody', name: 'Melody', color: DS.accent },
  { key: 'chords', name: 'Chords', color: '#919191' },
  { key: 'bass', name: 'Bass', color: '#6C6C6C' },
  { key: 'drums', name: 'Drums', color: '#4F4F4F' },
];

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Ableton colors in .als are not stored as raw hex; they use internal palette indices.
// We keep the hex for readability and place it in XML as a tag value (best-effort).
function noteEventsToAbletonNotesXml(notes: NoteEvent[]): string {
  // Best-effort simplified "notes" block. Ableton expects a richer structure; this is a pragmatic export.
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
  return sorted.map((n, i) => {
    const pitch = clampInt(n.pitch, 0, 127);
    const start = Math.max(0, n.startTime);
    const dur = Math.max(0.0625, n.duration);
    const vel = clampInt(n.velocity ?? 90, 1, 127);
    return `        <Note Id="${i}">
          <Time Value="${start.toFixed(4)}" />
          <Duration Value="${dur.toFixed(4)}" />
          <Pitch Value="${pitch}" />
          <Velocity Value="${vel}" />
        </Note>`;
  }).join('\n');
}

function trackXml(trackName: string, colorHex: string, notes: NoteEvent[]): string {
  return `  <MidiTrack Name="${escapeXml(trackName)}" Color="${escapeXml(colorHex)}">
    <DeviceChain />
    <ClipSlot>
      <MidiClip Name="${escapeXml(trackName)} Clip">
        <LoopStart Value="0" />
        <LoopEnd Value="16" />
        <Notes>
${noteEventsToAbletonNotesXml(notes)}
        </Notes>
      </MidiClip>
    </ClipSlot>
  </MidiTrack>`;
}

/**
 * Generates a gzipped Ableton Live Set (.als).
 *
 * Notes:
 * - Real .als files are gzipped XML with a complex schema that varies by Live version.
 * - This export is a best-effort minimal set intended to be importable/openable in Live,
 *   but cannot guarantee compatibility across versions without Ableton's private schema.
 */
export async function generateAbletonAlsBlob(opts: {
  generation: GenerationResult;
  bpm: number;
  projectName: string;
}): Promise<Blob> {
  const { generation, bpm, projectName } = opts;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AbletonLiveSet Version="1.0" Creator="pulp">
  <ProjectName Value="${escapeXml(projectName)}" />
  <Tempo Value="${clampInt(bpm, 60, 200)}" />
  <TimeSignature Numerator="4" Denominator="4" />
  <Tracks>
${TRACKS.map(t => trackXml(t.name, t.color, (generation[t.key] as NoteEvent[]) ?? [])).join('\n')}
  </Tracks>
  <MasterTrack />
</AbletonLiveSet>
`;

  // gzip for .als using CompressionStream (browser built-in)
  const encoder = new TextEncoder();
  const input = new Blob([encoder.encode(xml)], { type: 'application/xml' });
  const cs = new CompressionStream('gzip');
  const compressedStream = input.stream().pipeThrough(cs);
  const compressed = await new Response(compressedStream).blob();

  return new Blob([compressed], { type: 'application/octet-stream' });
}

