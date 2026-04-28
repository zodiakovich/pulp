import type { NoteEvent } from '@/lib/music-engine';

type Layers = { melody: NoteEvent[]; chords: NoteEvent[]; bass: NoteEvent[]; drums: NoteEvent[] };

const DARK_GENRES = new Set(['techno', 'hard_techno', 'industrial', 'dark_techno', 'melodic_techno', 'dub_techno']);
const CHILL_GENRES = new Set(['lo_fi', 'lo_fi_hiphop', 'ambient', 'chill_house', 'chillout']);
const GROOVY_GENRES = new Set(['afro_house', 'rnb', 'disco_nu_disco', 'funk', 'deep_house', 'hiphop', 'afrobeats']);
const EUPHORIC_GENRES = new Set(['melodic_house', 'progressive_house', 'trance', 'big_room', 'euphoric_hardstyle']);

const DARK_SCALES = new Set(['phrygian', 'harmonic_minor', 'blues', 'locrian']);
const GROOVY_SCALES = new Set(['dorian', 'mixolydian', 'pentatonic_minor']);
const EUPHORIC_SCALES = new Set(['major', 'lydian', 'pentatonic_major']);

function energyTag(bpm: number, totalNotes: number, bars: number): string {
  const density = totalNotes / Math.max(bars * 4, 1);
  if (bpm >= 140 || (bpm >= 120 && density >= 6)) return 'high energy';
  if (bpm <= 95 || density <= 2) return 'low energy';
  return 'mid energy';
}

function moodTag(genre: string, scale: string): string {
  if (DARK_GENRES.has(genre) || DARK_SCALES.has(scale)) return 'dark';
  if (CHILL_GENRES.has(genre)) return 'chill';
  if (GROOVY_GENRES.has(genre) || GROOVY_SCALES.has(scale)) return 'groovy';
  if (EUPHORIC_GENRES.has(genre) || EUPHORIC_SCALES.has(scale)) return 'euphoric';
  return 'chill';
}

function complexityTag(totalNotes: number): string {
  if (totalNotes <= 20) return 'minimal';
  if (totalNotes >= 80) return 'complex';
  return 'moderate';
}

export function generateAutoTags(
  params: { genre: string; scale: string; bpm: number; bars: number },
  layers: Layers,
): string[] {
  const totalNotes =
    layers.melody.length + layers.chords.length + layers.bass.length + layers.drums.length;
  return [
    energyTag(params.bpm, totalNotes, params.bars),
    moodTag(params.genre, params.scale),
    complexityTag(totalNotes),
  ];
}
