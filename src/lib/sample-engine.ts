import { getAudioContext } from './audio-context';

export type SampleSet = {
  kick: AudioBuffer;
  snare: AudioBuffer;
  'closed-hat': AudioBuffer;
  'open-hat': AudioBuffer;
  perc: AudioBuffer;
  bass: AudioBuffer;
  lead: AudioBuffer;
  pad: AudioBuffer;
};

export const PREMIUM_GENRES = ['acid-drop', 'uk-garage', 'deep-hypnotic', 'bouncy-funk'];

const sampleCache = new Map<string, Promise<SampleSet>>();

async function fetchAndDecode(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export function loadSampleSet(genre: string): Promise<SampleSet> {
  const existing = sampleCache.get(genre);
  if (existing) return existing;

  const p = (async (): Promise<SampleSet> => {
    const base = `/samples/${genre}/`;
    const [kick, snare, closedHat, openHat, perc, bass, lead, pad] = await Promise.all([
      fetchAndDecode(`${base}kick.wav`),
      fetchAndDecode(`${base}snare.wav`),
      fetchAndDecode(`${base}closed-hat.wav`),
      fetchAndDecode(`${base}open-hat.wav`),
      fetchAndDecode(`${base}perc.wav`),
      fetchAndDecode(`${base}bass.wav`),
      fetchAndDecode(`${base}lead.wav`),
      fetchAndDecode(`${base}pad.wav`),
    ]);
    return { kick, snare, 'closed-hat': closedHat, 'open-hat': openHat, perc, bass, lead, pad };
  })();

  sampleCache.set(genre, p);
  return p;
}

export function playBuffer(
  buffer: AudioBuffer,
  time: number,
  velocity: number,
  detune = 0,
): void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.detune.value = detune;
  gain.gain.value = velocity;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(time);
}

/**
 * Converts a MIDI note to detune in cents relative to baseNote.
 * base note for bass/lead/pad samples is C3 = MIDI 48.
 */
export function midiToDetune(midiNote: number, baseNote = 60): number {
  return (midiNote - baseNote) * 100;
}
