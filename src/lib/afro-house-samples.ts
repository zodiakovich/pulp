import { supabase } from './supabase';
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

// Cache file listings once per session per folder path
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

// Silence buffer used as a safe no-op fallback when a folder is empty
function makeSilence(ctx: AudioContext, duration = 0.1): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  return buf;
}

export async function loadAfroHouseSampleSet(): Promise<SampleSet> {
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

  const ctx = getAudioContext();

  // snare: alternate between snares and claps
  const useClap = claps.length > 0 && Math.random() < 0.5;
  const snareFolder = useClap ? FOLDERS.claps : FOLDERS.snares;
  const snarePool = useClap ? claps : (snares.length > 0 ? snares : claps);

  // perc: alternate across percussion and shakers
  const percPool = Math.random() < 0.5 && shakers.length > 0 ? shakers : percussion;
  const percFolder = percPool === shakers ? FOLDERS.shakers : FOLDERS.percussion;

  const kickFile   = pick(kicks.length      > 0 ? kicks      : snares);
  const snareFile  = pick(snarePool.length  > 0 ? snarePool  : kicks);
  const cHatFile   = pick(closedHats.length > 0 ? closedHats : openHats);
  const oHatFile   = pick(openHats.length   > 0 ? openHats   : closedHats);
  const percFile   = pick(percPool.length   > 0 ? percPool   : kicks);
  const bassFile   = pick(bassFiles.length  > 0 ? bassFiles  : synthFiles);
  const synthFile1 = pick(synthFiles.length > 0 ? synthFiles : bassFiles);
  const synthFile2 = pick(synthFiles.length > 0 ? synthFiles : bassFiles);

  async function decode(folderPath: string, file: string | null): Promise<AudioBuffer> {
    if (!file) return makeSilence(ctx);
    try {
      return await fetchAndDecode(buildUrl(folderPath, file));
    } catch (e) {
      console.error('[afro-house] decode failed', e);
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
}
