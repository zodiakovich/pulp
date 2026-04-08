import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { enforceRateLimit } from '@/lib/ratelimit';
import { generateTrack, getDefaultParams, GENRES, NOTE_NAMES, type GenerationParams } from '@/lib/music-engine';

const GENRE_KEYS = Object.keys(GENRES) as Array<keyof typeof GENRES>;
const KEY_WHITELIST = NOTE_NAMES as readonly string[];

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');

const GenerateSchema = z.object({
  bpm: z.number().min(60).max(200),
  genre: z.string().refine((g) => (GENRE_KEYS as readonly string[]).includes(g), {
    message: 'Invalid genre',
  }),
  key: z.string().refine((k) => KEY_WHITELIST.includes(k), {
    message: 'Invalid key',
  }),
  bars: z.number().int().min(1).max(16),
  prompt: z.string().max(500).transform((s) => stripHtml(s).trim()),
});

export async function POST(req: NextRequest) {
  // Rate limit (free: per IP, pro: per userId) + validate all inputs.
  const { userId } = await auth();
  const rl = await enforceRateLimit({ req, userId: userId ?? null });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input', details: [{ message: 'Invalid JSON body' }] }, { status: 400 });
  }

  const parsed = GenerateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const { bpm, genre, key, bars, prompt } = parsed.data;

  const params: GenerationParams = {
    ...getDefaultParams(),
    bpm,
    genre,
    key,
    bars,
    // Force all layers on for API generation.
    layers: { melody: true, chords: true, bass: true, drums: true },
  };

  const result = generateTrack(params);
  return NextResponse.json({
    prompt,
    params,
    result,
  });
}

