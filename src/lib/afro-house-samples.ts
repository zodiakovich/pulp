import { supabase } from './supabase';
import { getAudioContext } from './audio-context';
import type { SampleSet } from './sample-sets';

const STORAGE_BASE = 'https://wakqmkbdeottfvgtezym.supabase.co/storage/v1/object/public/pulp/afro_house';
const BUCKET = 'pulp';
const PREFIX = 'afro_house';

// Cache Supabase Storage file listings — fetched once per session per folder
const folderListCache = new Map<string, string[]>();

async function listFolder(folder: string): Promise<string[]> {
  const cached = folderListCache.get(folder);
  if (cached) return cached;
  const { data } = await supabase.storage.from(BUCKET).list(`${PREFIX}/${folder}`);
  const files = (data ?? []).filter(f => f.name.endsWith('.wav')).map(f => f.name);
  folderListCache.set(folder, files);
  return files;
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0] ?? '';
}

async function fetchAndDecode(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return ctx.decodeAudioData(buf);
}

function buildUrl(folder: string, file: string): string {
  return `${STORAGE_BASE}/${folder}/${file}`;
}

export async function loadAfroHouseSampleSet(): Promise<SampleSet> {
  const [
    kicks, snares, claps, closedHats, openHats,
    percussion, shakers, bongos, bassFiles, synthFiles,
  ] = await Promise.all([
    listFolder('afrohouse_drums/afrohouse_kicks'),
    listFolder('afrohouse_drums/afrohouse_snares'),
    listFolder('afrohouse_drums/afrohouse_claps'),
    listFolder('afrohouse_drums/afrohouse_hi_hats_-_closed'),
    listFolder('afrohouse_drums/afrohouse_hi_hats_-_open'),
    listFolder('afrohouse_drums/afrohouse_percussion'),
    listFolder('afrohouse_drums/afrohouse_shakers'),
    listFolder('afrohouse_drums/afrohouse_bongos'),
    listFolder('afrohouse_bass'),
    listFolder('afrohouse_synth'),
  ]);

  // snare: randomly pick from snares or claps
  const useClap = claps.length > 0 && Math.random() < 0.5;
  const snareFolder = useClap ? 'afrohouse_drums/afrohouse_claps' : 'afrohouse_drums/afrohouse_snares';
  const snarePool = useClap ? claps : (snares.length > 0 ? snares : claps);

  // perc: rotate across percussion, shakers, bongos
  const percRoll = Math.random();
  let percFolder: string;
  let percPool: string[];
  if (percRoll < 0.33 && percussion.length > 0) {
    percFolder = 'afrohouse_drums/afrohouse_percussion'; percPool = percussion;
  } else if (percRoll < 0.66 && shakers.length > 0) {
    percFolder = 'afrohouse_drums/afrohouse_shakers'; percPool = shakers;
  } else if (bongos.length > 0) {
    percFolder = 'afrohouse_drums/afrohouse_bongos'; percPool = bongos;
  } else {
    percFolder = 'afrohouse_drums/afrohouse_percussion';
    percPool = percussion.length > 0 ? percussion : shakers.length > 0 ? shakers : bongos;
  }

  const fallback = (arr: string[], fb: string[]): string[] => arr.length > 0 ? arr : fb;

  const kickFile   = pick(fallback(kicks, snares));
  const snareFile  = pick(fallback(snarePool, kicks));
  const cHatFile   = pick(fallback(closedHats, openHats));
  const oHatFile   = pick(fallback(openHats, closedHats));
  const percFile   = pick(fallback(percPool, percussion.length > 0 ? percussion : kicks));
  const bassFile   = pick(fallback(bassFiles, synthFiles));
  const synthFile1 = pick(fallback(synthFiles, bassFiles));
  const synthFile2 = pick(fallback(synthFiles, bassFiles));

  const [kick, snare, closedHat, openHat, perc, bass, lead, pad] = await Promise.all([
    fetchAndDecode(buildUrl('afrohouse_drums/afrohouse_kicks', kickFile)),
    fetchAndDecode(buildUrl(snareFolder, snareFile)),
    fetchAndDecode(buildUrl('afrohouse_drums/afrohouse_hi_hats_-_closed', cHatFile)),
    fetchAndDecode(buildUrl('afrohouse_drums/afrohouse_hi_hats_-_open', oHatFile)),
    fetchAndDecode(buildUrl(percFolder, percFile)),
    fetchAndDecode(buildUrl('afrohouse_bass', bassFile)),
    fetchAndDecode(buildUrl('afrohouse_synth', synthFile1)),
    fetchAndDecode(buildUrl('afrohouse_synth', synthFile2)),
  ]);

  return { kick, snare, 'closed-hat': closedHat, 'open-hat': openHat, perc, bass, lead, pad };
}
