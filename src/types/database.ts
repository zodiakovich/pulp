import type { GenerationResult } from '@/lib/music-engine';

/** Row shape for the public.generations table. */
export interface GenerationRow {
  id: string;
  user_id: string;
  prompt: string;
  genre: string;
  bpm: number;
  /** Optional style preset tag (e.g. "Dark & Moody"). */
  style_tag: string | null;
  /** Full GenerationResult stored as JSONB. */
  layers: GenerationResult;
  /** Artist / inspiration artist name used when generating. */
  inspiration_source: string | null;
  /** Whether this generation is visible in the public gallery. */
  is_public: boolean;
  /** Whether the user has starred/favorited this generation. */
  is_favorite: boolean;
  /** Auto-generated descriptive tags (energy, mood, complexity). */
  tags: string[] | null;
  created_at: string;
}

/** Payload for inserting a new generation row. */
export type GenerationInsert = Omit<GenerationRow, 'id' | 'created_at' | 'is_public' | 'is_favorite' | 'inspiration_source'> & {
  is_public?: boolean;
  is_favorite?: boolean;
  inspiration_source?: string | null;
  tags?: string[] | null;
};
