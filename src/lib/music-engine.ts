// ============================================================
// PULP — Rule-Based Music Generation Engine
// No AI required. Pure music theory + genre rules.
// ============================================================

// --- CONSTANTS ---
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const SCALE_INTERVALS: Record<string, number[]> = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor:  [0, 2, 3, 5, 7, 9, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues:      [0, 3, 5, 6, 7, 10],
};

export type NoteName = typeof NOTE_NAMES[number];

// --- MIDI NOTE HELPERS ---
export function noteNameToMidi(name: string, octave: number): number {
  const flatMap: Record<string, string> = { 'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B' };
  const normalized = flatMap[name] || name;
  const i = (NOTE_NAMES as readonly string[]).indexOf(normalized);
  return i >= 0 ? (octave + 1) * 12 + i : 60;
}

export function getScaleNotes(root: string, scale: string, octave: number): number[] {
  const rootMidi = noteNameToMidi(root, octave);
  const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.minor;
  return intervals.map(i => rootMidi + i);
}

export function getScaleNotesMultiOctave(root: string, scale: string, startOctave: number, endOctave: number): number[] {
  const notes: number[] = [];
  for (let oct = startOctave; oct <= endOctave; oct++) {
    notes.push(...getScaleNotes(root, scale, oct));
  }
  return notes;
}

// --- NOTE EVENT TYPE ---
export interface NoteEvent {
  pitch: number;      // MIDI note number (0-127)
  startTime: number;  // in beats (0-based)
  duration: number;   // in beats
  velocity: number;   // 0-127
}

// --- GENRE DEFINITIONS ---
export interface GenreProfile {
  name: string;
  bpmRange: [number, number];
  defaultBpm: number;
  preferredScale: string;
  melodyOctave: [number, number];    // [start, end] octaves
  melodyDensity: number;             // notes per bar (approx)
  melodyNoteLengths: number[];       // possible durations in beats
  chordComplexity: 'triads' | 'sevenths' | 'extended';
  chordRhythm: 'sustained' | 'stabs' | 'offbeat' | 'arpeggiated';
  chordProgressions: number[][];     // arrays of scale degrees (0-indexed)
  bassStyle: 'root' | 'walking' | 'octave' | 'syncopated' | '808';
  bassOctave: number;
  drumPattern: 'four_on_floor' | 'breakbeat' | 'trap' | 'halftime' | 'dnb' | 'shuffle';
  hatDensity: 8 | 16 | 32;          // divisions per bar
  swingAmount: number;               // 0-1
  energy: number;                    // 0-1
}

export const GENRES: Record<string, GenreProfile> = {
  'deep_house': {
    name: 'Deep House',
    bpmRange: [118, 125], defaultBpm: 122,
    preferredScale: 'minor',
    melodyOctave: [4, 5], melodyDensity: 6,
    melodyNoteLengths: [0.5, 1, 1.5, 2],
    chordComplexity: 'sevenths', chordRhythm: 'sustained',
    chordProgressions: [[0,3,4,0], [0,5,3,4], [0,2,3,4], [0,3,5,4]],
    bassStyle: 'root', bassOctave: 2,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0.1, energy: 0.5,
  },
  'melodic_house': {
    name: 'Melodic House',
    bpmRange: [120, 126], defaultBpm: 123,
    preferredScale: 'minor',
    melodyOctave: [4, 6], melodyDensity: 8,
    melodyNoteLengths: [0.25, 0.5, 1, 2],
    chordComplexity: 'sevenths', chordRhythm: 'sustained',
    chordProgressions: [[0,3,4,5], [0,5,6,4], [0,4,5,3]],
    bassStyle: 'root', bassOctave: 2,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0, energy: 0.6,
  },
  'tech_house': {
    name: 'Tech House',
    bpmRange: [124, 130], defaultBpm: 126,
    preferredScale: 'minor',
    melodyOctave: [3, 5], melodyDensity: 4,
    melodyNoteLengths: [0.25, 0.5, 0.5, 1],
    chordComplexity: 'triads', chordRhythm: 'stabs',
    chordProgressions: [[0,0,3,4], [0,4,0,3], [0,3,0,4]],
    bassStyle: 'syncopated', bassOctave: 2,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0.15, energy: 0.7,
  },
  'minimal_tech': {
    name: 'Minimal Tech',
    bpmRange: [126, 133], defaultBpm: 130,
    preferredScale: 'minor',
    melodyOctave: [3, 5], melodyDensity: 3,
    melodyNoteLengths: [0.25, 0.5, 1],
    chordComplexity: 'triads', chordRhythm: 'stabs',
    chordProgressions: [[0,0,0,3], [0,3,0,0], [0,0,4,0]],
    bassStyle: 'syncopated', bassOctave: 2,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0, energy: 0.6,
  },
  'techno': {
    name: 'Techno',
    bpmRange: [128, 138], defaultBpm: 132,
    preferredScale: 'minor',
    melodyOctave: [3, 5], melodyDensity: 5,
    melodyNoteLengths: [0.25, 0.5, 0.75],
    chordComplexity: 'triads', chordRhythm: 'stabs',
    chordProgressions: [[0,0,3,3], [0,4,0,3], [0,0,0,4]],
    bassStyle: 'root', bassOctave: 1,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0, energy: 0.8,
  },
  'melodic_techno': {
    name: 'Melodic Techno',
    bpmRange: [120, 130], defaultBpm: 124,
    preferredScale: 'minor',
    melodyOctave: [4, 6], melodyDensity: 7,
    melodyNoteLengths: [0.5, 1, 1.5, 2, 4],
    chordComplexity: 'sevenths', chordRhythm: 'sustained',
    chordProgressions: [[0,3,4,5], [0,5,3,4], [0,4,5,3]],
    bassStyle: 'root', bassOctave: 2,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0, energy: 0.7,
  },
  'hard_techno': {
    name: 'Hard Techno',
    bpmRange: [140, 155], defaultBpm: 145,
    preferredScale: 'phrygian',
    melodyOctave: [3, 5], melodyDensity: 4,
    melodyNoteLengths: [0.25, 0.25, 0.5],
    chordComplexity: 'triads', chordRhythm: 'stabs',
    chordProgressions: [[0,1,0,0], [0,0,1,0], [0,4,0,1]],
    bassStyle: 'root', bassOctave: 1,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0, energy: 0.95,
  },
  'progressive_house': {
    name: 'Progressive House',
    bpmRange: [122, 128], defaultBpm: 124,
    preferredScale: 'minor',
    melodyOctave: [4, 6], melodyDensity: 6,
    melodyNoteLengths: [0.5, 1, 2, 4],
    chordComplexity: 'sevenths', chordRhythm: 'arpeggiated',
    chordProgressions: [[0,3,5,4], [0,5,3,4], [0,4,5,6]],
    bassStyle: 'root', bassOctave: 2,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0, energy: 0.6,
  },
  'afro_house': {
    name: 'Afro House',
    bpmRange: [120, 126], defaultBpm: 122,
    preferredScale: 'dorian',
    melodyOctave: [4, 6], melodyDensity: 8,
    melodyNoteLengths: [0.25, 0.5, 0.75, 1],
    chordComplexity: 'sevenths', chordRhythm: 'offbeat',
    chordProgressions: [[0,3,4,5], [0,2,3,4], [0,5,4,3]],
    bassStyle: 'syncopated', bassOctave: 2,
    drumPattern: 'shuffle', hatDensity: 16, swingAmount: 0.2, energy: 0.7,
  },
  'organic_house': {
    name: 'Organic House',
    bpmRange: [118, 124], defaultBpm: 120,
    preferredScale: 'dorian',
    melodyOctave: [4, 6], melodyDensity: 5,
    melodyNoteLengths: [0.5, 1, 2, 3],
    chordComplexity: 'sevenths', chordRhythm: 'sustained',
    chordProgressions: [[0,3,5,4], [0,2,5,4], [0,5,3,2]],
    bassStyle: 'root', bassOctave: 2,
    drumPattern: 'shuffle', hatDensity: 8, swingAmount: 0.15, energy: 0.4,
  },
  'trance': {
    name: 'Trance',
    bpmRange: [136, 145], defaultBpm: 140,
    preferredScale: 'minor',
    melodyOctave: [4, 6], melodyDensity: 10,
    melodyNoteLengths: [0.25, 0.5, 1],
    chordComplexity: 'triads', chordRhythm: 'arpeggiated',
    chordProgressions: [[0,3,4,5], [0,5,3,4], [0,4,5,3]],
    bassStyle: 'root', bassOctave: 1,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0, energy: 0.85,
  },
  'uk_garage': {
    name: 'UK Garage',
    bpmRange: [130, 138], defaultBpm: 134,
    preferredScale: 'minor',
    melodyOctave: [4, 6], melodyDensity: 7,
    melodyNoteLengths: [0.25, 0.5, 0.75, 1],
    chordComplexity: 'extended', chordRhythm: 'offbeat',
    chordProgressions: [[0,3,4,5], [0,5,6,4], [0,2,3,5]],
    bassStyle: 'syncopated', bassOctave: 2,
    drumPattern: 'shuffle', hatDensity: 16, swingAmount: 0.25, energy: 0.7,
  },
  'drum_and_bass': {
    name: 'Drum & Bass',
    bpmRange: [170, 180], defaultBpm: 174,
    preferredScale: 'minor',
    melodyOctave: [4, 6], melodyDensity: 6,
    melodyNoteLengths: [0.5, 1, 2],
    chordComplexity: 'sevenths', chordRhythm: 'sustained',
    chordProgressions: [[0,3,4,5], [0,5,3,4]],
    bassStyle: 'syncopated', bassOctave: 1,
    drumPattern: 'dnb', hatDensity: 16, swingAmount: 0, energy: 0.85,
  },
  'amapiano': {
    name: 'Amapiano',
    bpmRange: [112, 118], defaultBpm: 115,
    preferredScale: 'major',
    melodyOctave: [4, 6], melodyDensity: 6,
    melodyNoteLengths: [0.5, 0.75, 1, 1.5],
    chordComplexity: 'sevenths', chordRhythm: 'offbeat',
    chordProgressions: [[0,3,4,5], [0,5,4,3], [0,2,3,4]],
    bassStyle: 'walking', bassOctave: 2,
    drumPattern: 'shuffle', hatDensity: 16, swingAmount: 0.2, energy: 0.5,
  },
  'lofi_hiphop': {
    name: 'Lo-Fi Hip-Hop',
    bpmRange: [75, 90], defaultBpm: 82,
    preferredScale: 'minor',
    melodyOctave: [4, 5], melodyDensity: 5,
    melodyNoteLengths: [0.5, 1, 1.5, 2],
    chordComplexity: 'extended', chordRhythm: 'sustained',
    chordProgressions: [[0,3,4,5], [0,5,3,4], [0,2,5,4]],
    bassStyle: 'root', bassOctave: 2,
    drumPattern: 'halftime', hatDensity: 8, swingAmount: 0.2, energy: 0.3,
  },
  'hiphop': {
    name: 'Hip-Hop',
    bpmRange: [85, 100], defaultBpm: 92,
    preferredScale: 'minor',
    melodyOctave: [4, 5], melodyDensity: 5,
    melodyNoteLengths: [0.25, 0.5, 1, 2],
    chordComplexity: 'sevenths', chordRhythm: 'sustained',
    chordProgressions: [[0,3,4,0], [0,5,3,4], [0,4,5,3]],
    bassStyle: '808', bassOctave: 1,
    drumPattern: 'halftime', hatDensity: 16, swingAmount: 0.1, energy: 0.6,
  },
  'trap': {
    name: 'Trap',
    bpmRange: [130, 160], defaultBpm: 145,
    preferredScale: 'minor',
    melodyOctave: [4, 5], melodyDensity: 5,
    melodyNoteLengths: [0.25, 0.5, 1, 2],
    chordComplexity: 'triads', chordRhythm: 'sustained',
    chordProgressions: [[0,3,4,0], [0,5,4,3], [0,0,3,4]],
    bassStyle: '808', bassOctave: 1,
    drumPattern: 'trap', hatDensity: 32, swingAmount: 0, energy: 0.75,
  },
  'pop': {
    name: 'Pop',
    bpmRange: [100, 130], defaultBpm: 118,
    preferredScale: 'major',
    melodyOctave: [4, 5], melodyDensity: 7,
    melodyNoteLengths: [0.25, 0.5, 1, 2],
    chordComplexity: 'triads', chordRhythm: 'sustained',
    chordProgressions: [[0,4,5,3], [0,3,4,5], [0,5,3,4]],
    bassStyle: 'root', bassOctave: 2,
    drumPattern: 'four_on_floor', hatDensity: 8, swingAmount: 0, energy: 0.6,
  },
  'rnb': {
    name: 'R&B',
    bpmRange: [65, 85], defaultBpm: 75,
    preferredScale: 'dorian',
    melodyOctave: [4, 6], melodyDensity: 6,
    melodyNoteLengths: [0.5, 1, 1.5, 2],
    chordComplexity: 'extended', chordRhythm: 'sustained',
    chordProgressions: [[0,3,5,4], [0,2,3,5], [0,5,4,2]],
    bassStyle: 'walking', bassOctave: 2,
    drumPattern: 'halftime', hatDensity: 16, swingAmount: 0.15, energy: 0.4,
  },
  'disco_nu_disco': {
    name: 'Disco / Nu-Disco',
    bpmRange: [115, 125], defaultBpm: 120,
    preferredScale: 'dorian',
    melodyOctave: [4, 6], melodyDensity: 8,
    melodyNoteLengths: [0.25, 0.5, 0.75, 1],
    chordComplexity: 'sevenths', chordRhythm: 'offbeat',
    chordProgressions: [[0,3,4,5], [0,5,4,3], [0,2,3,5]],
    bassStyle: 'octave', bassOctave: 2,
    drumPattern: 'four_on_floor', hatDensity: 16, swingAmount: 0.1, energy: 0.75,
  },
};

// ============================================================
// GENRE → SOUND MAPPING (for Web Audio engine)
// ============================================================
// This is intentionally lightweight: it only tells the audio engine which
// synthesized presets to prefer per genre (no samples, no external deps).

export type SoundPresetName =
  // Melody
  | 'fmbell'
  | 'detunedsaw'
  | 'marimba'
  | 'flute'
  | 'choir'
  | 'pizzicato'
  | 'pluck'
  | 'pad'
  | 'acid'
  | 'bell'
  | 'supersaw'
  | 'sinelead'
  // Chords
  | 'stringpad'
  | 'rhodes'
  | 'wurlitzer'
  | 'vibraphone'
  | 'brass'
  | 'warmpad'
  | 'epiano'
  | 'organ'
  | 'glass'
  // Bass
  | 'wobble'
  | 'fingerbass'
  | 'uprightbass'
  | 'slapbass'
  | 'tb303'
  | 'logdrum'
  | 'sub'
  | 'reese'
  | 'acidbass'
  | '808'
  | 'pluckbass';

export type KickPresetName = 'deep' | 'punchy' | 'distorted' | 'house' | '808' | 'techno';
export type SnarePresetName = 'tight' | 'fat' | 'brush' | 'clapreverb' | 'clap' | 'snare' | 'rim';
export type HatPresetName = 'closed' | 'open' | 'pedal' | 'sizzle' | 'tambourine';

export interface GenreSoundMap {
  melody: SoundPresetName[];
  chords: SoundPresetName[];
  bass: SoundPresetName[];
  kick: KickPresetName;
  snare: SnarePresetName;
  hats: HatPresetName[];
  percussion: Array<'conga' | 'bongo' | 'timbale' | 'woodblock' | 'triangle' | 'cabasa'>;
}

export const GENRE_SOUND_MAP: Record<string, GenreSoundMap> = {
  deep_house:        { melody: ['fmbell', 'pluck'], chords: ['rhodes'], bass: ['fingerbass'], kick: 'deep', snare: 'clap', hats: ['closed', 'sizzle'], percussion: ['cabasa'] },
  melodic_house:     { melody: ['detunedsaw', 'choir'], chords: ['stringpad'], bass: ['sub'], kick: 'punchy', snare: 'clap', hats: ['closed'], percussion: ['triangle'] },
  tech_house:        { melody: ['pluck', 'tb303'], chords: ['wurlitzer'], bass: ['pluckbass'], kick: 'punchy', snare: 'tight', hats: ['closed', 'pedal'], percussion: ['woodblock'] },
  minimal_tech:      { melody: ['flute', 'pluck'], chords: ['vibraphone'], bass: ['uprightbass'], kick: 'techno', snare: 'tight', hats: ['closed', 'pedal'], percussion: ['woodblock'] },
  techno:            { melody: ['tb303', 'sinelead'], chords: ['glass'], bass: ['reese'], kick: 'distorted', snare: 'fat', hats: ['closed', 'sizzle'], percussion: ['cabasa'] },
  melodic_techno:    { melody: ['detunedsaw', 'supersaw'], chords: ['stringpad'], bass: ['wobble'], kick: 'techno', snare: 'fat', hats: ['closed'], percussion: ['triangle'] },
  hard_techno:       { melody: ['tb303'], chords: ['brass'], bass: ['tb303'], kick: 'distorted', snare: 'tight', hats: ['closed', 'sizzle'], percussion: [] },
  progressive_house: { melody: ['supersaw', 'choir'], chords: ['stringpad'], bass: ['sub'], kick: 'punchy', snare: 'clap', hats: ['closed'], percussion: ['triangle'] },

  // Requested updates
  afro_house:        { melody: ['pizzicato', 'flute'], chords: ['rhodes'], bass: ['sub'], kick: 'deep', snare: 'clap', hats: ['closed', 'tambourine'], percussion: ['bongo', 'conga'] },
  amapiano:          { melody: ['choir'], chords: ['rhodes'], bass: ['logdrum', 'slapbass'], kick: 'deep', snare: 'tight', hats: ['closed', 'pedal'], percussion: ['conga'] },
  disco_nu_disco:    { melody: ['brass'], chords: ['rhodes'], bass: ['slapbass'], kick: 'punchy', snare: 'clapreverb', hats: ['closed', 'tambourine'], percussion: ['triangle', 'cabasa'] },
  lofi_hiphop:       { melody: ['marimba'], chords: ['rhodes'], bass: ['fingerbass'], kick: 'deep', snare: 'brush', hats: ['closed'], percussion: ['cabasa'] },

  organic_house:     { melody: ['flute', 'fmbell'], chords: ['stringpad'], bass: ['uprightbass'], kick: 'deep', snare: 'clap', hats: ['closed'], percussion: ['triangle'] },
  trance:            { melody: ['supersaw'], chords: ['stringpad'], bass: ['sub'], kick: 'punchy', snare: 'clap', hats: ['closed'], percussion: [] },
  uk_garage:         { melody: ['pluck', 'fmbell'], chords: ['wurlitzer'], bass: ['fingerbass'], kick: 'punchy', snare: 'snare', hats: ['closed', 'pedal'], percussion: ['woodblock'] },
  drum_and_bass:     { melody: ['detunedsaw'], chords: ['stringpad'], bass: ['wobble'], kick: 'techno', snare: 'fat', hats: ['closed', 'sizzle'], percussion: [] },
  hiphop:            { melody: ['marimba', 'fmbell'], chords: ['rhodes'], bass: ['808'], kick: '808', snare: 'fat', hats: ['closed'], percussion: ['cabasa'] },
  trap:              { melody: ['choir'], chords: ['stringpad'], bass: ['808'], kick: '808', snare: 'clap', hats: ['closed', 'sizzle'], percussion: [] },
  pop:               { melody: ['detunedsaw', 'pluck'], chords: ['stringpad'], bass: ['fingerbass'], kick: 'punchy', snare: 'clap', hats: ['closed'], percussion: [] },
  rnb:               { melody: ['flute', 'choir'], chords: ['rhodes'], bass: ['uprightbass'], kick: 'deep', snare: 'brush', hats: ['closed'], percussion: ['cabasa'] },
};

export function getGenreSoundMap(genreKey: string): GenreSoundMap {
  return GENRE_SOUND_MAP[genreKey] ?? GENRE_SOUND_MAP.deep_house;
}

// --- RANDOM HELPERS ---
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// --- CHORD BUILDER ---
function buildChord(scaleNotes: number[], degree: number, complexity: string): number[] {
  const len = scaleNotes.length;
  const root = scaleNotes[degree % len];
  const third = scaleNotes[(degree + 2) % len];
  const fifth = scaleNotes[(degree + 4) % len];
  
  // Ensure notes are above root
  const chord = [root];
  chord.push(third < root ? third + 12 : third);
  chord.push(fifth < chord[1] ? fifth + 12 : fifth);
  
  if (complexity === 'sevenths' || complexity === 'extended') {
    let seventh = scaleNotes[(degree + 6) % len];
    seventh = seventh < chord[2] ? seventh + 12 : seventh;
    chord.push(seventh);
  }
  if (complexity === 'extended') {
    let ninth = scaleNotes[(degree + 1) % len];
    ninth = ninth < chord[chord.length - 1] ? ninth + 12 : ninth;
    // Put ninth an octave up for voicing
    chord.push(ninth + 12);
  }
  
  return chord;
}

// --- GENERATION PARAMS ---
export interface GenerationParams {
  genre: string;
  key: string;
  scale: string;
  bpm: number;
  bars: number;
  layers: {
    melody: boolean;
    chords: boolean;
    bass: boolean;
    drums: boolean;
  };
}

export interface GenerationResult {
  melody: NoteEvent[];
  chords: NoteEvent[];
  bass: NoteEvent[];
  drums: NoteEvent[];
  params: GenerationParams;
}

// --- MELODY GENERATOR ---
function generateMelody(params: GenerationParams, genre: GenreProfile): NoteEvent[] {
  const notes: NoteEvent[] = [];
  if (!params.layers.melody) return notes;
  
  const scaleNotes = getScaleNotesMultiOctave(
    params.key, params.scale,
    genre.melodyOctave[0], genre.melodyOctave[1]
  );
  
  const totalBeats = params.bars * 4;
  let currentBeat = 0;
  let lastNoteIdx = Math.floor(scaleNotes.length / 2); // start in middle
  
  while (currentBeat < totalBeats) {
    // Rest probability based on energy
    if (Math.random() > genre.energy * 0.8 + 0.2) {
      currentBeat += pick(genre.melodyNoteLengths);
      continue;
    }
    
    // Choose note duration
    const duration = pick(genre.melodyNoteLengths);
    if (currentBeat + duration > totalBeats) break;
    
    // Melodic motion: mostly stepwise, occasional leaps
    const motion = Math.random();
    let step: number;
    if (motion < 0.5) step = pick([-1, 1]);          // step
    else if (motion < 0.75) step = pick([-2, 2]);     // third
    else if (motion < 0.9) step = pick([-3, 3, -4, 4]); // leap
    else step = 0;                                      // repeat
    
    lastNoteIdx = Math.max(0, Math.min(scaleNotes.length - 1, lastNoteIdx + step));
    const pitch = scaleNotes[lastNoteIdx];
    
    // Velocity variation
    const baseVel = 80 + Math.floor(genre.energy * 30);
    const vel = Math.max(50, Math.min(120, baseVel + randInt(-15, 15)));
    
    // Emphasize downbeats
    const isDownbeat = currentBeat % 4 === 0;
    const finalVel = isDownbeat ? Math.min(127, vel + 10) : vel;
    
    notes.push({
      pitch,
      startTime: currentBeat,
      duration: duration * (0.8 + Math.random() * 0.2), // slight humanization
      velocity: finalVel,
    });
    
    currentBeat += duration;
  }
  
  return notes;
}

// --- CHORD GENERATOR ---
function generateChords(params: GenerationParams, genre: GenreProfile): NoteEvent[] {
  const notes: NoteEvent[] = [];
  if (!params.layers.chords) return notes;
  
  const scaleNotes = getScaleNotes(params.key, params.scale, 3);
  const progression = pick(genre.chordProgressions);
  
  const totalBeats = params.bars * 4;
  
  for (let bar = 0; bar < params.bars; bar++) {
    const degree = progression[bar % progression.length];
    const chordPitches = buildChord(scaleNotes, degree, genre.chordComplexity);
    
    // Move chord to octave 4 range
    const transposed = chordPitches.map(p => p + 12);
    
    switch (genre.chordRhythm) {
      case 'sustained': {
        // Whole bar chord
        for (const p of transposed) {
          notes.push({
            pitch: p,
            startTime: bar * 4,
            duration: 3.8,
            velocity: 70 + randInt(-5, 10),
          });
        }
        break;
      }
      case 'stabs': {
        // Short stabs on beats
        const stabPositions = [0, 1.5, 3]; // syncopated
        for (const pos of stabPositions) {
          if (Math.random() < 0.7) {
            for (const p of transposed) {
              notes.push({
                pitch: p,
                startTime: bar * 4 + pos,
                duration: 0.3,
                velocity: 85 + randInt(-5, 10),
              });
            }
          }
        }
        break;
      }
      case 'offbeat': {
        // Offbeat chords (beats 1.5, 2.5, 3.5)
        const offbeats = [0.5, 1.5, 2.5, 3.5];
        for (const pos of offbeats) {
          if (Math.random() < 0.75) {
            for (const p of transposed) {
              notes.push({
                pitch: p,
                startTime: bar * 4 + pos,
                duration: 0.4,
                velocity: 75 + randInt(-5, 10),
              });
            }
          }
        }
        break;
      }
      case 'arpeggiated': {
        // Arpeggiate the chord
        const divisions = 8; // 8th notes
        for (let i = 0; i < divisions; i++) {
          const noteIdx = i % transposed.length;
          const beat = bar * 4 + i * 0.5;
          if (beat < totalBeats && Math.random() < 0.85) {
            notes.push({
              pitch: transposed[noteIdx],
              startTime: beat,
              duration: 0.4,
              velocity: 65 + randInt(-5, 15),
            });
          }
        }
        break;
      }
    }
  }
  
  return notes;
}

// --- BASS GENERATOR ---
function generateBass(params: GenerationParams, genre: GenreProfile): NoteEvent[] {
  const notes: NoteEvent[] = [];
  if (!params.layers.bass) return notes;
  
  const scaleNotes = getScaleNotes(params.key, params.scale, genre.bassOctave);
  const progression = pick(genre.chordProgressions);
  
  for (let bar = 0; bar < params.bars; bar++) {
    const degree = progression[bar % progression.length];
    const root = scaleNotes[degree % scaleNotes.length];
    const fifth = scaleNotes[(degree + 4) % scaleNotes.length];
    
    switch (genre.bassStyle) {
      case 'root': {
        // Simple root note pattern
        notes.push({ pitch: root, startTime: bar * 4, duration: 0.8, velocity: 100 });
        if (Math.random() < 0.6) {
          notes.push({ pitch: root, startTime: bar * 4 + 2, duration: 0.8, velocity: 90 });
        }
        if (Math.random() < 0.4) {
          notes.push({ pitch: root, startTime: bar * 4 + 3, duration: 0.5, velocity: 85 });
        }
        break;
      }
      case 'walking': {
        // Walking bassline
        const walkNotes = [root, scaleNotes[(degree + 1) % scaleNotes.length], 
                          scaleNotes[(degree + 2) % scaleNotes.length], fifth];
        for (let i = 0; i < 4; i++) {
          notes.push({
            pitch: walkNotes[i] || root,
            startTime: bar * 4 + i,
            duration: 0.8,
            velocity: 90 + randInt(-5, 10),
          });
        }
        break;
      }
      case 'octave': {
        // Octave bass pattern (disco)
        for (let i = 0; i < 8; i++) {
          notes.push({
            pitch: i % 2 === 0 ? root : root + 12,
            startTime: bar * 4 + i * 0.5,
            duration: 0.35,
            velocity: i % 2 === 0 ? 100 : 80,
          });
        }
        break;
      }
      case 'syncopated': {
        // Syncopated bass
        const positions = [0, 0.75, 1.5, 2.5, 3.25];
        for (const pos of positions) {
          if (Math.random() < 0.7) {
            notes.push({
              pitch: pick([root, root, fifth]),
              startTime: bar * 4 + pos,
              duration: 0.4 + Math.random() * 0.3,
              velocity: 95 + randInt(-10, 10),
            });
          }
        }
        break;
      }
      case '808': {
        // 808-style long bass notes
        notes.push({
          pitch: root,
          startTime: bar * 4,
          duration: 2 + Math.random() * 1.5,
          velocity: 110,
        });
        if (Math.random() < 0.5) {
          const slideNote = pick([root - 2, root + 2, root - 1, root + 5]);
          notes.push({
            pitch: Math.max(24, slideNote),
            startTime: bar * 4 + 2.5 + Math.random(),
            duration: 1,
            velocity: 100,
          });
        }
        break;
      }
    }
  }
  
  return notes;
}

// --- DRUM GENERATOR ---
// MIDI drum mapping
const KICK = 36;
const SNARE = 38;
const CLAP = 39;
const CLOSED_HAT = 42;
const OPEN_HAT = 46;
const RIDE = 51;
const CONGA_HI = 62;
const CONGA_LO = 63;
const SHAKER = 70;
const RIM = 37;

function generateDrums(params: GenerationParams, genre: GenreProfile): NoteEvent[] {
  const notes: NoteEvent[] = [];
  if (!params.layers.drums) return notes;
  
  const totalBeats = params.bars * 4;
  
  for (let bar = 0; bar < params.bars; bar++) {
    const barStart = bar * 4;
    
    switch (genre.drumPattern) {
      case 'four_on_floor': {
        // Kick on every beat
        for (let beat = 0; beat < 4; beat++) {
          notes.push({ pitch: KICK, startTime: barStart + beat, duration: 0.2, velocity: 110 });
        }
        // Clap/snare on 2 and 4
        notes.push({ pitch: CLAP, startTime: barStart + 1, duration: 0.15, velocity: 95 });
        notes.push({ pitch: CLAP, startTime: barStart + 3, duration: 0.15, velocity: 100 });
        // Hats
        const hatDiv = genre.hatDensity === 16 ? 0.25 : 0.5;
        for (let i = 0; i < 4 / hatDiv; i++) {
          const pos = barStart + i * hatDiv;
          const isOffbeat = (i * hatDiv * 4) % 2 !== 0;
          if (Math.random() < 0.9) {
            const isOpen = isOffbeat && Math.random() < 0.15;
            notes.push({
              pitch: isOpen ? OPEN_HAT : CLOSED_HAT,
              startTime: pos + (genre.swingAmount > 0 && i % 2 === 1 ? genre.swingAmount * 0.1 : 0),
              duration: isOpen ? 0.3 : 0.05,
              velocity: isOffbeat ? 70 : 85 + randInt(-10, 10),
            });
          }
        }
        break;
      }
      case 'breakbeat': {
        // Funky breakbeat pattern
        const kickPositions = [0, 1.25, 2.5];
        const snarePositions = [1, 3, 3.5];
        for (const pos of kickPositions) {
          if (Math.random() < 0.85) {
            notes.push({ pitch: KICK, startTime: barStart + pos, duration: 0.2, velocity: 105 });
          }
        }
        for (const pos of snarePositions) {
          if (Math.random() < 0.8) {
            notes.push({ pitch: SNARE, startTime: barStart + pos, duration: 0.15, velocity: 95 });
          }
        }
        // Hats: 16th notes with ghost notes
        for (let i = 0; i < 16; i++) {
          if (Math.random() < 0.8) {
            notes.push({
              pitch: CLOSED_HAT,
              startTime: barStart + i * 0.25,
              duration: 0.05,
              velocity: i % 4 === 0 ? 90 : 55 + randInt(0, 20),
            });
          }
        }
        break;
      }
      case 'trap': {
        // Trap: sparse kick, snare on 3, rolling hats
        notes.push({ pitch: KICK, startTime: barStart, duration: 0.3, velocity: 115 });
        if (Math.random() < 0.5) {
          notes.push({ pitch: KICK, startTime: barStart + 2.75, duration: 0.3, velocity: 105 });
        }
        notes.push({ pitch: SNARE, startTime: barStart + 2, duration: 0.15, velocity: 100 });
        // Rolling hi-hats (32nd notes with velocity rolls)
        for (let i = 0; i < 32; i++) {
          const pos = barStart + i * 0.125;
          // Create hat rolls (bursts of 32nds)
          const inRoll = (i >= 8 && i < 14) || (i >= 24 && i < 30);
          if (inRoll || Math.random() < 0.4) {
            notes.push({
              pitch: CLOSED_HAT,
              startTime: pos,
              duration: 0.03,
              velocity: inRoll ? 60 + (i % 6) * 8 : 70,
            });
          }
        }
        // Open hat
        if (Math.random() < 0.5) {
          notes.push({ pitch: OPEN_HAT, startTime: barStart + 1.5, duration: 0.3, velocity: 80 });
        }
        break;
      }
      case 'halftime': {
        // Half-time: kick on 1, snare on 3
        notes.push({ pitch: KICK, startTime: barStart, duration: 0.25, velocity: 110 });
        if (Math.random() < 0.4) {
          notes.push({ pitch: KICK, startTime: barStart + 1.5, duration: 0.2, velocity: 90 });
        }
        notes.push({ pitch: SNARE, startTime: barStart + 2, duration: 0.15, velocity: 100 });
        // Hats
        for (let i = 0; i < 8; i++) {
          if (Math.random() < 0.75) {
            notes.push({
              pitch: CLOSED_HAT,
              startTime: barStart + i * 0.5 + (genre.swingAmount > 0 && i % 2 === 1 ? 0.08 : 0),
              duration: 0.05,
              velocity: 65 + randInt(-10, 15),
            });
          }
        }
        break;
      }
      case 'dnb': {
        // DnB: two-step kick, snare on 2 and 4, fast hats
        notes.push({ pitch: KICK, startTime: barStart, duration: 0.2, velocity: 115 });
        notes.push({ pitch: KICK, startTime: barStart + 2.5, duration: 0.2, velocity: 105 });
        notes.push({ pitch: SNARE, startTime: barStart + 1, duration: 0.15, velocity: 105 });
        notes.push({ pitch: SNARE, startTime: barStart + 3, duration: 0.15, velocity: 100 });
        // Fast hats
        for (let i = 0; i < 16; i++) {
          if (Math.random() < 0.8) {
            notes.push({
              pitch: CLOSED_HAT,
              startTime: barStart + i * 0.25,
              duration: 0.04,
              velocity: 70 + randInt(-10, 15),
            });
          }
        }
        break;
      }
      case 'shuffle': {
        // Shuffle/swing groove
        notes.push({ pitch: KICK, startTime: barStart, duration: 0.2, velocity: 105 });
        notes.push({ pitch: KICK, startTime: barStart + 2, duration: 0.2, velocity: 100 });
        if (Math.random() < 0.4) {
          notes.push({ pitch: KICK, startTime: barStart + 3.5, duration: 0.15, velocity: 90 });
        }
        notes.push({ pitch: CLAP, startTime: barStart + 1, duration: 0.15, velocity: 90 });
        notes.push({ pitch: CLAP, startTime: barStart + 3, duration: 0.15, velocity: 95 });
        // Swung hats
        for (let i = 0; i < 8; i++) {
          const swing = i % 2 === 1 ? genre.swingAmount * 0.2 : 0;
          notes.push({
            pitch: CLOSED_HAT,
            startTime: barStart + i * 0.5 + swing,
            duration: 0.05,
            velocity: i % 2 === 0 ? 85 : 65,
          });
        }
        // Percussion: congas, shaker
        if (Math.random() < 0.5) {
          notes.push({ pitch: CONGA_HI, startTime: barStart + 0.75, duration: 0.1, velocity: 70 });
          notes.push({ pitch: CONGA_LO, startTime: barStart + 2.25, duration: 0.1, velocity: 65 });
        }
        break;
      }
    }
  }
  
  return notes;
}

// --- PROMPT PARSER ---
export function parsePrompt(prompt: string): Partial<GenerationParams> {
  const lower = prompt.toLowerCase();
  const result: Partial<GenerationParams> = {};
  
  // Detect genre
  for (const [key, genre] of Object.entries(GENRES)) {
    if (lower.includes(genre.name.toLowerCase()) || lower.includes(key.replace(/_/g, ' '))) {
      result.genre = key;
      break;
    }
  }
  // Shorthand detection
  if (!result.genre) {
    if (lower.includes('house')) result.genre = 'deep_house';
    if (lower.includes('techno')) result.genre = 'techno';
    if (lower.includes('trap')) result.genre = 'trap';
    if (lower.includes('hip hop') || lower.includes('hiphop')) result.genre = 'hiphop';
    if (lower.includes('lo-fi') || lower.includes('lofi')) result.genre = 'lofi_hiphop';
    if (lower.includes('trance')) result.genre = 'trance';
    if (lower.includes('garage')) result.genre = 'uk_garage';
    if (lower.includes('dnb') || lower.includes('drum and bass') || lower.includes('jungle')) result.genre = 'drum_and_bass';
    if (lower.includes('disco')) result.genre = 'disco_nu_disco';
    if (lower.includes('amapiano')) result.genre = 'amapiano';
    if (lower.includes('pop')) result.genre = 'pop';
    if (lower.includes('r&b') || lower.includes('rnb')) result.genre = 'rnb';
  }
  
  // Detect BPM
  const bpmMatch = lower.match(/(\d{2,3})\s*bpm/);
  if (bpmMatch) result.bpm = parseInt(bpmMatch[1]);
  
  // Detect key
  const keyMatch = lower.match(/\b([A-G][#b]?)\s*(m|min|minor|maj|major)?\b/i);
  if (keyMatch) {
    result.key = keyMatch[1].charAt(0).toUpperCase() + keyMatch[1].slice(1);
    if (keyMatch[2] && (keyMatch[2].startsWith('m') && !keyMatch[2].startsWith('maj'))) {
      result.scale = 'minor';
    } else if (keyMatch[2] && keyMatch[2].startsWith('maj')) {
      result.scale = 'major';
    }
  }
  
  // Detect scale
  for (const scaleName of Object.keys(SCALE_INTERVALS)) {
    if (lower.includes(scaleName.replace('_', ' '))) {
      result.scale = scaleName;
      break;
    }
  }
  
  // Detect bars
  const barMatch = lower.match(/(\d+)\s*bar/);
  if (barMatch) result.bars = parseInt(barMatch[1]);
  
  return result;
}

// --- STYLE TAG PRESETS ---
export const STYLE_TAGS: Record<string, Partial<GenerationParams>> = {
  'Jazzy UK Deep': { genre: 'deep_house', scale: 'dorian' },
  'Euphoric Melodic': { genre: 'melodic_house', scale: 'minor' },
  'Dark Hypnotic Dub': { genre: 'techno', scale: 'phrygian' },
  'Pumping Festival Tech': { genre: 'tech_house', scale: 'minor' },
  'Groovy Seoul House': { genre: 'deep_house', scale: 'dorian' },
  'Peak-Time Industrial': { genre: 'hard_techno', scale: 'phrygian' },
  'Quirky Minimal': { genre: 'minimal_tech', scale: 'minor' },
  'Ethereal Melodic': { genre: 'melodic_techno', scale: 'minor' },
  'Funky R&B Beats': { genre: 'rnb', scale: 'dorian' },
  'Dusty Boom-Bap': { genre: 'hiphop', scale: 'minor' },
  'Organic Afro Groove': { genre: 'afro_house', scale: 'dorian' },
  'Acid Warehouse': { genre: 'techno', scale: 'phrygian' },
  'Progressive Journey': { genre: 'progressive_house', scale: 'minor' },
  'Nu-Disco Funk': { genre: 'disco_nu_disco', scale: 'dorian' },
  'Liquid DnB': { genre: 'drum_and_bass', scale: 'minor' },
};

// --- MAIN GENERATION FUNCTION ---
export function generateTrack(params: GenerationParams): GenerationResult {
  const genre = GENRES[params.genre] || GENRES.deep_house;
  
  return {
    melody: generateMelody(params, genre),
    chords: generateChords(params, genre),
    bass: generateBass(params, genre),
    drums: generateDrums(params, genre),
    params,
  };
}

// --- DEFAULT PARAMS ---
export function getDefaultParams(genreKey?: string): GenerationParams {
  const genre = GENRES[genreKey || 'deep_house'] || GENRES.deep_house;
  return {
    genre: genreKey || 'deep_house',
    key: 'C',
    scale: genre.preferredScale,
    bpm: genre.defaultBpm,
    bars: 4,
    layers: { melody: true, chords: true, bass: true, drums: true },
  };
}
