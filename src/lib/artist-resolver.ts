import type { GenerationParams } from '@/lib/music-engine';
import { GENRES } from '@/lib/music-engine';
import {
  findArtistInPrompt,
  stripArtistKeyFromPrompt,
  profileToDescriptorSuffix,
  type ArtistProfile,
} from '@/lib/artist-map';

type EngineGenreKey = keyof typeof GENRES;

const ENGINE_KEYS = new Set(Object.keys(GENRES) as EngineGenreKey[]);

export interface ParseArtistApiResponse {
  genres: string[];
  bpm_range: [number, number];
  energy: 'low' | 'medium' | 'high';
  density: 'sparse' | 'normal' | 'dense';
  mood_tags: string[];
  swing: boolean;
  cleaned_prompt: string;
}

/** Map free-text genre labels to a valid music-engine genre key. */
export function mapArtistGenresToEngineKey(
  genres: string[],
  bpmRange?: [number, number],
): EngineGenreKey | null {
  const blob = genres.join(' ').toLowerCase();
  const hi = bpmRange?.[1] ?? 130;
  const lo = bpmRange?.[0] ?? 110;

  if (blob.includes('drum and bass') || blob.includes('dnb') || hi >= 168) return 'drum_and_bass';
  if (blob.includes('dubstep') || blob.includes('wobble') || (blob.includes('bass music') && hi >= 150))
    return 'trap';
  if (blob.includes('trance') || blob.includes('uplifting trance') || blob.includes('progressive trance'))
    return 'trance';
  if (blob.includes('tech house') || blob.includes('groovy house')) return 'tech_house';
  if (blob.includes('melodic house') || blob.includes('organic house')) return 'melodic_house';
  if (blob.includes('afro house') || blob.includes('tribal house')) return 'afro_house';
  if (blob.includes('hard techno') || blob.includes('industrial techno')) return 'hard_techno';
  if (blob.includes('minimal techno') || blob.includes('detroit techno') || blob.includes('peak techno'))
    return 'techno';
  if (blob.includes('melodic techno')) return 'melodic_techno';
  if (blob.includes('techno')) return hi >= 138 ? 'techno' : 'melodic_techno';
  if (blob.includes('progressive house')) return 'progressive_house';
  if (blob.includes('deep house') || blob.includes('nu disco')) return 'deep_house';
  if (blob.includes('disco') || blob.includes('french house')) return 'disco_nu_disco';
  if (blob.includes('future bass') || blob.includes('tropical house') || blob.includes('electronic pop'))
    return 'pop';
  if (blob.includes('hip hop') || blob.includes('hip-hop')) return 'hiphop';
  if (blob.includes('trap')) return 'trap';
  if (blob.includes('r&b') || blob.includes('rnb')) return 'rnb';
  if (blob.includes('lo-fi') || blob.includes('lofi')) return 'lofi_hiphop';
  if (blob.includes('amapiano')) return 'amapiano';
  if (blob.includes('uk garage')) return 'uk_garage';
  if (blob.includes('big beat') || blob.includes('breakbeat') || blob.includes('electronic rock'))
    return lo < 125 ? 'uk_garage' : 'techno';
  if (blob.includes('big room') || blob.includes('edm') || blob.includes('festival')) {
    return hi > 132 ? 'trance' : 'tech_house';
  }
  if (blob.includes('dance music')) return 'melodic_house';
  return null;
}

export function mapArtistProfileToHints(profile: ArtistProfile): Partial<GenerationParams> {
  const [a, b] = profile.bpm_range;
  const bpm = Math.round((a + b) / 2);
  const genre = mapArtistGenresToEngineKey(profile.genres, profile.bpm_range);
  const out: Partial<GenerationParams> = { bpm: Math.max(60, Math.min(200, bpm)) };
  if (genre && ENGINE_KEYS.has(genre as EngineGenreKey)) out.genre = genre as EngineGenreKey;
  return out;
}

function coerceProfile(data: ParseArtistApiResponse): ArtistProfile {
  let lo = Math.max(60, Math.min(200, Math.round(Number(data.bpm_range?.[0]) || 110)));
  let hi = Math.max(60, Math.min(200, Math.round(Number(data.bpm_range?.[1]) || 128)));
  if (lo > hi) [lo, hi] = [hi, lo];
  return {
    genres: Array.isArray(data.genres) ? data.genres.filter((g) => typeof g === 'string').slice(0, 8) : [],
    bpm_range: [lo, hi],
    energy: data.energy === 'low' || data.energy === 'high' ? data.energy : 'medium',
    density: data.density === 'sparse' || data.density === 'dense' ? data.density : 'normal',
    mood_tags: Array.isArray(data.mood_tags)
      ? data.mood_tags.filter((t) => typeof t === 'string').slice(0, 12)
      : [],
    swing: Boolean(data.swing),
  };
}

/**
 * Client-only: resolve known artists locally (no network); unknown artists go to
 * `/api/parse-artist`. Returns a prompt safe to persist and send downstream (no names when matched).
 */
export async function resolveArtistPromptChain(rawPrompt: string): Promise<{
  sanitizedPrompt: string;
  profile?: ArtistProfile;
}> {
  const raw = rawPrompt.trim();
  if (!raw) return { sanitizedPrompt: '' };

  const local = findArtistInPrompt(raw);
  if (local) {
    const stripped = stripArtistKeyFromPrompt(raw, local.matchedKey).trim();
    const suffix = profileToDescriptorSuffix(local.profile);
    const merged = [stripped, suffix].filter(Boolean).join(' ').trim();
    return { sanitizedPrompt: merged || suffix, profile: local.profile };
  }

  try {
    const res = await fetch('/api/parse-artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: raw }),
    });
    if (!res.ok) return { sanitizedPrompt: raw };

    const data = (await res.json()) as Partial<ParseArtistApiResponse>;
    if (!data || typeof data.cleaned_prompt !== 'string') return { sanitizedPrompt: raw };

    const cleaned = data.cleaned_prompt.trim();
    if (!cleaned) return { sanitizedPrompt: raw };

    const hasMusical =
      Array.isArray(data.genres) &&
      data.genres.length > 0 &&
      Array.isArray(data.bpm_range) &&
      data.bpm_range.length === 2;

    if (!hasMusical) return { sanitizedPrompt: cleaned };

    return {
      sanitizedPrompt: cleaned,
      profile: coerceProfile(data as ParseArtistApiResponse),
    };
  } catch {
    return { sanitizedPrompt: raw };
  }
}
