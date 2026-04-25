import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://wakqmkbdeottfvgtezym.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indha3Fta2JkZW90dGZ2Z3RlenltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njk3MjYsImV4cCI6MjA5MTE0NTcyNn0.CYTv96nzXN3e6nQSdhNZBKz4DkRYeZaBfcieM0nZeI4',
  { auth: { persistSession: false, autoRefreshToken: false } }
);
import { getAudioContext } from './audio-context';
import type { SampleSet } from './sample-sets';

const PUBLIC_BASE = 'https://wakqmkbdeottfvgtezym.supabase.co/storage/v1/object/public/pulp';
const BUCKET = 'pulp';

// Supabase Storage paths (bucket-relative)
const FOLDERS = {
  kicks:      'afro_house/afrohouse_drums/afrohouse_kicks',
  snares:     'afro_house/afrohouse_drums/afrohouse_snares',
  claps:      'afro_house/afrohouse_drums/afrohouse_claps',
  closedHats: 'afro_house/afrohouse_drums/afrohouse_hi_hats_-_closed',
  openHats:   'afro_house/afrohouse_drums/afrohouse_hi_hats_-_open',
  percussion: 'afro_house/afrohouse_drums/afrohouse_percussion',
  shakers:    'afro_house/afrohouse_drums/afrohouse_shakers',
  bass:       'afro_house/afrohouse_bass',
  synth:      'afro_house/afrohouse_synth',
} as const;

// ─── OVERRIDE MECHANISM ───────────────────────────────────────────────────────
// The sound selector UI sets these to pin specific samples for playback.
// Empty string / absent = use random pick.

export type AfroHouseSlot = 'kick' | 'snare' | 'closedHat' | 'bass' | 'synth';

const sampleOverrides = new Map<AfroHouseSlot, string>();

export function setAfroHouseOverride(slot: AfroHouseSlot, filename: string | null): void {
  if (filename) sampleOverrides.set(slot, filename);
  else sampleOverrides.delete(slot);
}

// ─── FILE LIST CACHE ──────────────────────────────────────────────────────────

const folderListCache = new Map<string, string[]>();

async function listFolder(path: string): Promise<string[]> {
  const cached = folderListCache.get(path);
  if (cached) return cached;

  const { data, error } = await supabase.storage.from(BUCKET).list(path, { limit: 500 });
  if (error) {
    console.error('[afro-house] Storage list error for', path, error.message);
    folderListCache.set(path, []);
    return [];
  }
  const files = (data ?? [])
    .filter(f => f.name.endsWith('.wav'))
    .map(f => f.name);

  if (files.length === 0) {
    console.warn('[afro-house] No .wav files found in', path);
  }

  folderListCache.set(path, files);
  return files;
}

// ─── SOUND SELECTOR API ───────────────────────────────────────────────────────

function cleanFilename(filename: string): string {
  // ZEN_SHAV_{category...}_one_shot_{name}[_C].wav → name (spaces instead of _)
  const m = filename.match(/^ZEN_SHAV_.*?_one_shot_(.+?)(?:_C)?\.wav$/i);
  if (m?.[1]) return m[1].replace(/_/g, ' ');
  return filename.replace(/\.wav$/i, '');
}

export type AfroHouseSampleOptions = {
  synth:      { label: string; value: string }[];
  bass:       { label: string; value: string }[];
  kicks:      { label: string; value: string }[];
  snares:     { label: string; value: string }[];
  closedHats: { label: string; value: string }[];
};

export async function getAfroHouseSampleOptions(): Promise<AfroHouseSampleOptions> {
  const [synth, bass, kicks, snares, closedHats] = await Promise.all([
    listFolder(FOLDERS.synth),
    listFolder(FOLDERS.bass),
    listFolder(FOLDERS.kicks),
    listFolder(FOLDERS.snares),
    listFolder(FOLDERS.closedHats),
  ]);
  const toOpts = (files: string[]) => [
    { value: '', label: '— random —' },
    ...files.map(f => ({ value: f, label: cleanFilename(f) })),
  ];
  return {
    synth:      toOpts(synth),
    bass:       toOpts(bass),
    kicks:      toOpts(kicks),
    snares:     toOpts(snares),
    closedHats: toOpts(closedHats),
  };
}

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

function pick(arr: string[]): string | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)] ?? null;
}

async function fetchAndDecode(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[afro-house] fetch failed ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  return ctx.decodeAudioData(buf);
}

function buildUrl(folderPath: string, filename: string): string {
  return `${PUBLIC_BASE}/${folderPath}/${filename}`;
}

function makeSilence(ctx: AudioContext, duration = 0.1): AudioBuffer {
  return ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
}

// ─── SAMPLE SET LOADER ────────────────────────────────────────────────────────

export async function loadAfroHouseSampleSet(): Promise<SampleSet> {
  try {
    console.log('[afro-house] starting load');

    const [
      kicks, snares, claps, closedHats, openHats,
      percussion, shakers, bassFiles, synthFiles,
    ] = await Promise.all([
      listFolder(FOLDERS.kicks),
      listFolder(FOLDERS.snares),
      listFolder(FOLDERS.claps),
      listFolder(FOLDERS.closedHats),
      listFolder(FOLDERS.openHats),
      listFolder(FOLDERS.percussion),
      listFolder(FOLDERS.shakers),
      listFolder(FOLDERS.bass),
      listFolder(FOLDERS.synth),
    ]);

    console.log('[afro-house] file counts:', {
      kicks: kicks.length,
      snares: snares.length,
      claps: claps.length,
      closedHats: closedHats.length,
      openHats: openHats.length,
      percussion: percussion.length,
      shakers: shakers.length,
      bassFiles: bassFiles.length,
      synthFiles: synthFiles.length,
    });

    const ctx = getAudioContext();

    // snare: if pinned by override always use snares folder; otherwise alternate claps
    const snareOverride = sampleOverrides.get('snare') ?? null;
    const useClap = !snareOverride && claps.length > 0 && Math.random() < 0.5;
    const snareFolder = snareOverride ? FOLDERS.snares : (useClap ? FOLDERS.claps : FOLDERS.snares);
    const snarePool   = useClap ? claps : (snares.length > 0 ? snares : claps);

    // perc: alternate across percussion and shakers (never overridden via selector)
    const percPool   = Math.random() < 0.5 && shakers.length > 0 ? shakers : percussion;
    const percFolder = percPool === shakers ? FOLDERS.shakers : FOLDERS.percussion;

    // Use pinned override if set, else random pick
    const kickFile   = sampleOverrides.get('kick')      ?? pick(kicks.length      > 0 ? kicks      : snares);
    const snareFile  = snareOverride                    ?? pick(snarePool.length  > 0 ? snarePool  : kicks);
    const cHatFile   = sampleOverrides.get('closedHat') ?? pick(closedHats.length > 0 ? closedHats : openHats);
    const oHatFile   = pick(openHats.length   > 0 ? openHats   : closedHats);
    const percFile   = pick(percPool.length   > 0 ? percPool   : kicks);
    const bassFile   = sampleOverrides.get('bass')      ?? pick(bassFiles.length  > 0 ? bassFiles  : synthFiles);
    const synthFile1 = sampleOverrides.get('synth')     ?? pick(synthFiles.length > 0 ? synthFiles : bassFiles);
    const synthFile2 = sampleOverrides.get('synth')     ?? pick(synthFiles.length > 0 ? synthFiles : bassFiles);

    async function decode(folderPath: string, file: string | null): Promise<AudioBuffer> {
      if (!file) return makeSilence(ctx);
      console.log('[afro-house] decoding:', buildUrl(folderPath, file));
      try {
        return await fetchAndDecode(buildUrl(folderPath, file));
      } catch (e) {
        console.error('[afro-house] decode error:', e);
        return makeSilence(ctx);
      }
    }

    const [kick, snare, closedHat, openHat, perc, bass, lead, pad] = await Promise.all([
      decode(FOLDERS.kicks,      kickFile),
      decode(snareFolder,        snareFile),
      decode(FOLDERS.closedHats, cHatFile),
      decode(FOLDERS.openHats,   oHatFile),
      decode(percFolder,         percFile),
      decode(FOLDERS.bass,       bassFile),
      decode(FOLDERS.synth,      synthFile1),
      decode(FOLDERS.synth,      synthFile2),
    ]);

    return { kick, snare, 'closed-hat': closedHat, 'open-hat': openHat, perc, bass, lead, pad };
  } catch (e) {
    console.error('[afro-house] top-level load error:', e);
    throw e;
  }
}
