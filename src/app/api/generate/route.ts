import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { enforceRateLimit } from '@/lib/ratelimit';
import { calculateAnthropicCostUsd, logAnthropicUsage } from '@/lib/ai-usage';
import { checkFeatureAllowed, incrementFeatureCost, type WindowCheckResult } from '@/lib/feature-credits';
import {
  generateTrack,
  getDefaultParams,
  GENRES,
  NOTE_NAMES,
  parsePrompt,
  type GenerationParams,
  type GenerationResult,
} from '@/lib/music-engine';

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

function noteTokenToKey(token: string): string | null {
  const t = token.trim().replace('♭', 'b').replace('♯', '#');
  if (!t) return null;
  const head = t.charAt(0).toUpperCase() + t.slice(1);
  if ((KEY_WHITELIST as readonly string[]).includes(head)) return head;
  const flatToSharp: Record<string, string> = {
    Db: 'C#',
    Eb: 'D#',
    Gb: 'F#',
    Ab: 'G#',
    Bb: 'A#',
    Cb: 'B',
    Fb: 'E',
  };
  const mapped = flatToSharp[head];
  if (mapped && (KEY_WHITELIST as readonly string[]).includes(mapped)) return mapped;
  return null;
}

const EXTRACTED_SCHEMA = z.object({
  bpm_modifier: z.number().min(-20).max(20).optional().default(0),
  density: z.enum(['sparse', 'normal', 'dense']).optional().default('normal'),
  energy: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  melody_octave: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional().default(0),
  swing: z.boolean().optional().default(false),
  notes_override: z.union([z.string(), z.null()]).optional().default(null),
  mood_tags: z.array(z.string()).optional().default([]),
});

const SYSTEM_PROMPT = `You are a music parameter extractor for a MIDI generator. 
Given a user's description, extract musical parameters as JSON.
Return ONLY valid JSON, no explanation, no markdown.

Return this exact shape:
{
  "bpm_modifier": number between -20 and +20 (offset from user's chosen BPM),
  "density": "sparse" | "normal" | "dense",
  "energy": "low" | "medium" | "high",
  "melody_octave": -1 | 0 | 1 (shift from default),
  "swing": boolean,
  "notes_override": null | string (comma-separated note names like "C,Eb,G,Bb" if user implies a specific chord/scale),
  "mood_tags": string[] (max 3, e.g. ["dark", "hypnotic", "minimal"])
}

Examples:
- "dark hypnotic minimal techno" → density: sparse, energy: medium, swing: false, mood_tags: ["dark","hypnotic","minimal"]
- "euphoric festival drop" → density: dense, energy: high, bpm_modifier: +10, mood_tags: ["euphoric","festival","uplifting"]
- "late night jazz vibes" → density: normal, energy: low, swing: true, mood_tags: ["jazz","late-night","smooth"]
- "aggressive trap banger" → density: dense, energy: high, melody_octave: -1, mood_tags: ["aggressive","trap","dark"]`;

type Extracted = z.infer<typeof EXTRACTED_SCHEMA>;
type ExtractedWithCost = { extracted: Extracted | null; costUsd: number };

function applyExtractedToParams(params: GenerationParams, ex: Extracted, barsBeforeDensity: number): void {
  params.bpm = Math.round(Math.min(200, Math.max(60, params.bpm + ex.bpm_modifier)));

  let nextBars = barsBeforeDensity;
  if (ex.density === 'sparse') nextBars = Math.max(1, Math.round(barsBeforeDensity * 0.7));
  else if (ex.density === 'dense') nextBars = Math.min(16, Math.round(barsBeforeDensity * 1.3));
  params.bars = nextBars;

  let h = ex.energy === 'low' ? 26 : ex.energy === 'high' ? 70 : 44;
  if (ex.swing) h = Math.min(100, h + 16);
  params.humanization = Math.round(h);

  if (ex.notes_override && typeof ex.notes_override === 'string') {
    const first = ex.notes_override.split(',')[0]?.trim();
    if (first) {
      const k = noteTokenToKey(first);
      if (k) params.key = k;
    }
  }
}

async function extractWithAnthropic(userPrompt: string, userId?: string | null): Promise<ExtractedWithCost> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { extracted: null, costUsd: 0 };

  const client = new Anthropic({ apiKey: key });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  await logAnthropicUsage({
    userId,
    endpoint: 'generate.extract',
    model: 'claude-haiku-4-5-20251001',
    usage: message.usage,
    metadata: { promptLength: userPrompt.length },
  });
  const costUsd = calculateAnthropicCostUsd(message.usage);

  const block = message.content[0];
  const text = block?.type === 'text' ? block.text : '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned) as unknown;
  } catch {
    return { extracted: null, costUsd };
  }
  const parsed = EXTRACTED_SCHEMA.safeParse(raw);
  if (!parsed.success) return { extracted: null, costUsd };
  return { extracted: parsed.data, costUsd };
}

export async function POST(req: NextRequest) {
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

  let featureCheck: WindowCheckResult | null = null;

  if (userId) {
    try {
      featureCheck = await checkFeatureAllowed(userId, 'build');
      if (!featureCheck.allowed) {
        return NextResponse.json(
          {
            error: featureCheck.blocked_by === 'daily'
              ? 'Daily build limit reached'
              : 'Monthly build limit reached',
            blocked_by: featureCheck.blocked_by,
            daily_cost: featureCheck.daily_cost,
            daily_limit: featureCheck.daily_limit,
            monthly_cost: featureCheck.monthly_cost,
            monthly_limit: featureCheck.monthly_limit,
            daily_pct: featureCheck.daily_pct,
            monthly_pct: featureCheck.monthly_pct,
          },
          { status: 429 },
        );
      }
    } catch {
      return NextResponse.json({ error: 'Usage check unavailable' }, { status: 503 });
    }
  }

  const params: GenerationParams = {
    ...getDefaultParams(genre),
    bpm,
    genre,
    key,
    bars,
    layers: { melody: true, chords: true, bass: true, drums: true },
  };

  let mood_tags: string[] | undefined;
  let density: string | undefined;
  let energy: string | undefined;
  let swing: boolean | undefined;
  let melody_octave: number | undefined;
  let notes_override: string | null | undefined;
  let buildCost = 0;

  if (prompt.trim()) {
    const hints = parsePrompt(prompt);
    if (hints.bpm !== undefined) params.bpm = hints.bpm;
    if (hints.key !== undefined) params.key = hints.key;
    if (hints.scale !== undefined) params.scale = hints.scale;
    if (hints.bars !== undefined) params.bars = hints.bars;
    params.genre = genre;

    try {
      const { extracted: ex, costUsd } = await extractWithAnthropic(prompt, userId);
      buildCost = costUsd;
      if (ex) {
        const barsBase = params.bars;
        applyExtractedToParams(params, ex, barsBase);
        mood_tags = ex.mood_tags.slice(0, 3);
        density = ex.density;
        energy = ex.energy;
        swing = ex.swing;
        melody_octave = ex.melody_octave;
        notes_override = ex.notes_override ?? null;
      }
    } catch {
      // Silent fallthrough — generation still runs
    }
  }

  const p1: GenerationParams = { ...params };
  const p2: GenerationParams = { ...params, bpm: Math.min(200, params.bpm + 4) };
  const p3: GenerationParams = { ...params, bpm: Math.max(60, params.bpm - 4) };

  let gen1: GenerationResult;
  let gen2: GenerationResult;
  let gen3: GenerationResult;
  try {
    gen1 = generateTrack(p1);
    gen2 = generateTrack(p2);
    gen3 = generateTrack(p3);
  } catch {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }

  try {
    if (userId) {
      await incrementFeatureCost(userId, 'build', buildCost);
    }
  } catch {
    return NextResponse.json({ error: 'Usage accounting failed' }, { status: 500 });
  }

  return NextResponse.json({
    prompt,
    params: p1,
    variations: [
      { result: gen1, params: p1 },
      { result: gen2, params: p2 },
      { result: gen3, params: p3 },
    ],
    ...(featureCheck && {
      feature_usage: {
        daily_cost: featureCheck.daily_cost + buildCost,
        daily_limit: featureCheck.daily_limit,
        monthly_cost: featureCheck.monthly_cost + buildCost,
        monthly_limit: featureCheck.monthly_limit,
        daily_pct: Math.min(100, ((featureCheck.daily_cost + buildCost) / featureCheck.daily_limit) * 100),
        monthly_pct: Math.min(100, ((featureCheck.monthly_cost + buildCost) / featureCheck.monthly_limit) * 100),
      },
    }),
    ...(mood_tags !== undefined && { mood_tags }),
    ...(density !== undefined && { density }),
    ...(energy !== undefined && { energy }),
    ...(swing !== undefined && { swing }),
    ...(melody_octave !== undefined && { melody_octave }),
    ...(notes_override !== undefined && { notes_override }),
  });
}
