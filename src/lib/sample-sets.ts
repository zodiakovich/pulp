export const SAMPLE_SET_SLUGS = ['acid-drop', 'uk-garage', 'deep-hypnotic', 'bouncy-funk'] as const;
export type SampleSetSlug = (typeof SAMPLE_SET_SLUGS)[number];

/**
 * Map generator genre keys (from `music-engine`) to a sample folder slug.
 * Keep this intentionally explicit so adding a new set is:
 * - add `public/samples/<slug>/...wav`
 * - register the slug here
 * - optionally map a genre key to it
 */
export function resolveSampleSetSlug(genreKey: string): SampleSetSlug | null {
  const g = (genreKey ?? '').toLowerCase();
  if ((SAMPLE_SET_SLUGS as readonly string[]).includes(g)) return g as SampleSetSlug;

  // Known mappings (music-engine genre keys → sample folders)
  if (g === 'hard_techno') return 'acid-drop';
  if (g === 'uk_garage') return 'uk-garage';
  if (g === 'minimal_tech') return 'deep-hypnotic';
  if (g === 'tech_house') return 'bouncy-funk';

  return null;
}

export const SAMPLE_FILES = [
  'kick.wav',
  'snare.wav',
  'closed-hat.wav',
  'open-hat.wav',
  'perc.wav',
  'bass.wav',
  'lead.wav',
  'pad.wav',
] as const;
export type SampleFile = (typeof SAMPLE_FILES)[number];

export type DrumSampleKey = 'kick' | 'snare' | 'closed-hat' | 'open-hat' | 'perc';
export type PitchedSampleKey = 'bass' | 'lead' | 'pad';

export type WebAudioDecodedSampleSet = {
  slug: SampleSetSlug;
  kick: AudioBuffer;
  snare: AudioBuffer;
  closedHat: AudioBuffer;
  openHat: AudioBuffer;
  perc: AudioBuffer;
  bass: AudioBuffer;
  lead: AudioBuffer;
  pad: AudioBuffer;
};


