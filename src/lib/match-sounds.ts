import { createClient } from '@supabase/supabase-js';
import type { AfroHouseSlot } from './afro-house-samples';

const supabase = createClient(
  'https://wakqmkbdeottfvgtezym.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indha3Fta2JkZW90dGZ2Z3RlenltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njk3MjYsImV4cCI6MjA5MTE0NTcyNn0.CYTv96nzXN3e6nQSdhNZBKz4DkRYeZaBfcieM0nZeI4',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const BUCKET = 'pulp';
const PUBLIC_BASE = 'https://wakqmkbdeottfvgtezym.supabase.co/storage/v1/object/public/pulp';

const FOLDERS = {
  kicks:      'afro_house/afrohouse_drums/afrohouse_kicks',
  snares:     'afro_house/afrohouse_drums/afrohouse_snares',
  claps:      'afro_house/afrohouse_drums/afrohouse_claps',
  closedHats: 'afro_house/afrohouse_drums/afrohouse_hi_hats_-_closed',
  percussion: 'afro_house/afrohouse_drums/afrohouse_percussion',
  bass:       'afro_house/afrohouse_bass',
  synth:      'afro_house/afrohouse_synth',
} as const;

export type SampleCategory = 'kick' | 'snare' | 'hat' | 'bass' | 'synth' | 'perc' | 'clap';

export interface MatchedSample {
  filename: string;
  displayName: string;
  url: string;
  category: SampleCategory;
  /** Which AfroHouseSlot this maps to, or null if no direct slot (perc, clap, open-hat). */
  afroHouseSlot: AfroHouseSlot | null;
}

export type MatchLayer = 'melody' | 'chords' | 'bass' | 'drums';

const listCache = new Map<string, string[]>();

async function listFolder(path: string): Promise<string[]> {
  const cached = listCache.get(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from(BUCKET).list(path, { limit: 500 });
  const files = (data ?? []).filter(f => f.name.endsWith('.wav')).map(f => f.name);
  listCache.set(path, files);
  return files;
}

function cleanName(filename: string): string {
  const m = filename.match(/^ZEN_SHAV_.*?_one_shot_(.+?)(?:_C)?\.wav$/i);
  if (m?.[1]) return m[1].replace(/_/g, ' ');
  return filename.replace(/\.wav$/i, '').replace(/_/g, ' ');
}

function sampleUrl(folder: string, filename: string): string {
  return `${PUBLIC_BASE}/${folder}/${filename}`;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function toSamples(
  files: string[],
  folder: string,
  category: SampleCategory,
  slot: AfroHouseSlot | null,
  count: number,
): MatchedSample[] {
  return pickRandom(files, count).map(f => ({
    filename: f,
    displayName: cleanName(f),
    url: sampleUrl(folder, f),
    category,
    afroHouseSlot: slot,
  }));
}

export async function matchSounds(
  _genre: string,
  layer: MatchLayer,
  count = 8,
): Promise<MatchedSample[]> {
  if (layer === 'drums') {
    const perSlot = Math.ceil(count / 4);
    const [kicks, snares, hats, claps] = await Promise.all([
      listFolder(FOLDERS.kicks),
      listFolder(FOLDERS.snares),
      listFolder(FOLDERS.closedHats),
      listFolder(FOLDERS.claps),
    ]);
    return [
      ...toSamples(kicks,  FOLDERS.kicks,      'kick',  'kick',       perSlot),
      ...toSamples(snares, FOLDERS.snares,      'snare', 'snare',      perSlot),
      ...toSamples(hats,   FOLDERS.closedHats,  'hat',   'closedHat',  perSlot),
      ...toSamples(claps,  FOLDERS.claps,       'clap',  null,         perSlot),
    ].slice(0, count);
  }

  if (layer === 'bass') {
    const files = await listFolder(FOLDERS.bass);
    return toSamples(files, FOLDERS.bass, 'bass', 'bass', count);
  }

  // melody / chords → synth samples
  const files = await listFolder(FOLDERS.synth);
  return toSamples(files, FOLDERS.synth, 'synth', 'synth', count);
}
