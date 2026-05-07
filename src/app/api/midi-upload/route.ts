import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { enforceRateLimit } from '@/lib/ratelimit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { GENRES, NOTE_NAMES, type GenerationParams, type GenerationResult, type NoteEvent } from '@/lib/music-engine';
import { bucketNotesForPrompt, parseMidiToAnalysis, sampleNotesForPrompt } from '@/lib/midi-upload-parse';
import { calculateAnthropicCostUsd, logAnthropicUsage } from '@/lib/ai-usage';
import { checkFeatureAllowed, incrementFeatureCost } from '@/lib/feature-credits';

export const runtime = 'nodejs';

const GENRE_KEYS = Object.keys(GENRES) as string[];
const KEY_WHITELIST = NOTE_NAMES as readonly string[];

const BodySchema = z.object({
  fileBase64: z.string().min(32),
  mode: z.enum(['continue', 'vary']),
});

const NoteEventSchema = z.object({
  pitch: z.number(),
  startTime: z.number(),
  duration: z.number(),
  velocity: z.number(),
});

const LayersSchema = z.object({
  melody: z.array(NoteEventSchema).max(1400),
  chords: z.array(NoteEventSchema).max(1400),
  bass: z.array(NoteEventSchema).max(1400),
  drums: z.array(NoteEventSchema).max(1400),
});

const OutSchema = z.object({
  params: z.object({
    genre: z.string(),
    key: z.string(),
    scale: z.string(),
    bpm: z.number(),
    bars: z.number().int(),
    humanization: z.number().optional(),
  }),
  variations: z.tuple([LayersSchema, LayersSchema, LayersSchema]),
});

const MAX_BYTES = 2 * 1024 * 1024;

function stripDataUrl(b64: string): string {
  const i = b64.indexOf('base64,');
  return i >= 0 ? b64.slice(i + 7) : b64;
}

function isMidiHeader(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x4d && buf[1] === 0x54 && buf[2] === 0x68 && buf[3] === 0x64;
}

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

function normalizeKey(raw: string): string {
  const k = noteTokenToKey(raw);
  return k ?? 'A';
}

function clampNote(n: z.infer<typeof NoteEventSchema>): NoteEvent {
  return {
    pitch: Math.max(0, Math.min(127, Math.round(n.pitch))),
    startTime: Math.max(0, n.startTime),
    duration: Math.min(32, Math.max(0.02, n.duration)),
    velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
  };
}

function buildParams(parsed: z.infer<typeof OutSchema>['params']): GenerationParams {
  const genre = GENRE_KEYS.includes(parsed.genre) ? parsed.genre : 'tech_house';
  const key = normalizeKey(parsed.key);
  const scale = typeof parsed.scale === 'string' && parsed.scale.length > 0 ? parsed.scale : 'minor';
  const bpm = Math.round(Math.min(200, Math.max(60, parsed.bpm)));
  const bars = Math.round(Math.min(16, Math.max(4, parsed.bars)));
  const humanization = Math.round(
    Math.min(100, Math.max(0, parsed.humanization ?? 44)),
  );
  return {
    genre,
    key,
    scale,
    bpm,
    bars,
    humanization,
    layers: { melody: true, chords: true, bass: true, drums: true },
  };
}

function layersToResult(layers: z.infer<typeof LayersSchema>, p: GenerationParams): GenerationResult {
  return {
    melody: layers.melody.map(clampNote),
    chords: layers.chords.map(clampNote),
    bass: layers.bass.map(clampNote),
    drums: layers.drums.map(clampNote),
    params: p,
  };
}

async function runMidiAnthropic(opts: {
  mode: 'continue' | 'vary';
  analysisJson: string;
  userId?: string | null;
}): Promise<{ parsed: z.infer<typeof OutSchema>; costUsd: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error('no_anthropic');

  const system = [
    {
      type: 'text' as const,
      text: `You are an expert MIDI arranger for electronic music DAWs.
You receive JSON describing a parsed MIDI file (tempo, key guess, rough layer buckets, sampled notes).
Return ONLY valid JSON (no markdown) with this exact shape:
{
  "params": {
    "genre": string (prefer: ${GENRE_KEYS.slice(0, 8).join(', ')}, … or "tech_house" if unsure),
    "key": string (single letter or accidental like C, F#, Bb — must be a valid chromatic key),
    "scale": string (e.g. minor, major, dorian),
    "bpm": number 60-200,
    "bars": integer 4-16,
    "humanization": number 0-100 optional
  },
  "variations": [
    { "melody": NoteEvent[], "chords": NoteEvent[], "bass": NoteEvent[], "drums": NoteEvent[] },
    { ... same },
    { ... same }
  ]
}
Each NoteEvent: {"pitch":0-127,"startTime":beats from 0,"duration":beats>0.02,"velocity":1-127}.
All note startTime must be within [0, params.bars * 4) beats. Use four-on-floor style drums on channel-style GM drums pitches when possible.

The mode is specified in the input JSON:
- continue: write the NEXT musical section (8–16 bars in params.bars) that feels like a natural continuation of the uploaded material (same BPM/key feel, coherent groove).
- vary: three DISTINCT reimaginings of the same core idea (different voicings/rhythms while keeping genre and approximate density).

The three variations must be musically different from each other.`,
      cache_control: { type: 'ephemeral' as const },
    },
  ];

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: `Input analysis JSON:\n${opts.analysisJson}` }],
  });
  await logAnthropicUsage({
    userId: opts.userId,
    endpoint: 'midi-upload',
    model: 'claude-haiku-4-5-20251001',
    usage: message.usage,
    metadata: {
      mode: opts.mode,
      analysisBytes: opts.analysisJson.length,
    },
  });
  const costUsd = calculateAnthropicCostUsd(message.usage);

  const block = message.content[0];
  const text = block?.type === 'text' ? block.text : '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned) as unknown;
  } catch {
    throw new Error('bad_json');
  }
  const parsed = OutSchema.safeParse(raw);
  if (!parsed.success) throw new Error('schema_fail');
  return { parsed: parsed.data, costUsd };
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const rl = await enforceRateLimit({ req, userId: userId ?? null });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!supabaseAdmin) throw new Error('supabase_admin_unavailable');
    const { data: row, error } = await supabaseAdmin
      .from('user_credits')
      .select('is_pro, plan_type')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!row?.is_pro || row.plan_type !== 'studio') {
      return NextResponse.json({ error: 'Studio plan required' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Plan check failed' }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsedBody = BodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsedBody.error.issues }, { status: 400 });
  }

  const { fileBase64, mode } = parsedBody.data;
  const b64 = stripDataUrl(fileBase64).replace(/\s/g, '');

  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch {
    return NextResponse.json({ error: 'Invalid base64' }, { status: 400 });
  }

  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 });
  }

  const u8 = new Uint8Array(buffer);
  if (!isMidiHeader(u8)) {
    return NextResponse.json({ error: 'Not a valid MIDI file' }, { status: 400 });
  }

  let analysis;
  try {
    analysis = parseMidiToAnalysis(u8);
  } catch {
    return NextResponse.json({ error: 'Failed to parse MIDI' }, { status: 400 });
  }

  if (analysis.notes.length === 0) {
    return NextResponse.json({ error: 'No notes found in MIDI' }, { status: 400 });
  }

  try {
    const usage = await checkFeatureAllowed(userId, 'midi');
    if (!usage.allowed) {
      return NextResponse.json(
        {
          error: usage.blocked_by === 'daily'
            ? 'Daily midi limit reached'
            : 'Monthly midi limit reached',
          blocked_by: usage.blocked_by,
          daily_cost: usage.daily_cost,
          daily_limit: usage.daily_limit,
          monthly_cost: usage.monthly_cost,
          monthly_limit: usage.monthly_limit,
          daily_pct: usage.daily_pct,
          monthly_pct: usage.monthly_pct,
        },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Usage check unavailable' }, { status: 503 });
  }

  const buckets = bucketNotesForPrompt(analysis.notes);
  const barsTarget = Math.round(
    Math.min(16, Math.max(8, Math.ceil(analysis.totalBeats / 4))),
  );

  const analysisPayload = {
    mode,
    bpm: analysis.bpm,
    keyGuess: analysis.keyGuess,
    scaleGuess: analysis.scaleGuess,
    totalBeats: analysis.totalBeats,
    noteDensity: Math.round(analysis.noteDensity * 1000) / 1000,
    barsTarget,
    sampleDrums: sampleNotesForPrompt(buckets.drums, 40),
    sampleBass: sampleNotesForPrompt(buckets.bass, 40),
    sampleChords: sampleNotesForPrompt(buckets.chords, 40),
    sampleMelody: sampleNotesForPrompt(buckets.melody, 60),
  };

  let out: z.infer<typeof OutSchema>;
  let costUsd = 0;
  try {
    const arranged = await runMidiAnthropic({ mode, analysisJson: JSON.stringify(analysisPayload), userId });
    out = arranged.parsed;
    costUsd = arranged.costUsd;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    if (msg === 'no_anthropic') {
      return NextResponse.json({ error: 'MIDI upload temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'AI arrangement failed' }, { status: 502 });
  }

  const baseParams = buildParams(out.params);
  const variations: { result: GenerationResult; params: GenerationParams }[] = out.variations.map((layers, i) => {
    const p: GenerationParams =
      i === 0
        ? baseParams
        : {
            ...baseParams,
            bpm: i === 1 ? Math.min(200, baseParams.bpm + 4) : Math.max(60, baseParams.bpm - 4),
          };
    return { result: layersToResult(layers, p), params: p };
  });

  try {
    await incrementFeatureCost(userId, 'midi', costUsd);
  } catch {
    return NextResponse.json({ error: 'Usage accounting failed' }, { status: 500 });
  }

  const promptTag = mode === 'continue' ? 'upload:continue' : 'upload:vary';
  const variationIds: (string | null)[] = [null, null, null];

  if (supabaseAdmin) {
    for (let i = 0; i < 3; i++) {
      const v = variations[i]!;
      try {
        const { data, error } = await supabaseAdmin
          .from('generations')
          .insert({
            user_id: userId,
            prompt: promptTag,
            genre: v.params.genre,
            bpm: v.params.bpm,
            style_tag: null,
            layers: v.result,
            is_public: false,
          })
          .select('id')
          .single();
        if (!error && data?.id) variationIds[i] = data.id;
      } catch {
        // continue without id
      }
    }
  }

  return NextResponse.json({
    prompt: promptTag,
    params: variations[0]!.params,
    variations,
    variationIds,
  });
}
