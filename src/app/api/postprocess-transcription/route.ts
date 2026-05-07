import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/ratelimit';
import { NOTE_NAMES, SCALE_INTERVALS, type NoteEvent } from '@/lib/music-engine';
import { calculateAnthropicCostUsd, logAnthropicUsage, normalizeAnthropicUsage } from '@/lib/ai-usage';
import { checkFeatureAllowed, incrementFeatureCost } from '@/lib/feature-credits';

export const runtime = 'nodejs';

const MODEL = 'claude-haiku-4-5-20251001';
const KEY_WHITELIST = NOTE_NAMES as readonly string[];
const SCALE_WHITELIST = Object.keys(SCALE_INTERVALS);

const NoteEventSchema = z.object({
  pitch: z.number().int().min(0).max(127),
  startTime: z.number().min(0),
  duration: z.number().positive().max(32),
  velocity: z.number().int().min(1).max(127),
});

const BodySchema = z.object({
  notes: z.array(NoteEventSchema).min(1).max(1000),
  key: z.string().optional().default('C').refine((k) => KEY_WHITELIST.includes(k), { message: 'Invalid key' }),
  scale: z.string().optional().default('minor').refine((s) => SCALE_WHITELIST.includes(s), { message: 'Invalid scale' }),
  bpm: z.number().int().min(60).max(220).optional().default(120),
  bars: z.number().int().min(1).max(32).optional().default(4),
  sourceName: z.string().max(200).optional().default('audio'),
});

const OutSchema = z.object({
  notes: z.array(NoteEventSchema).min(1).max(1000),
  suggestions: z.array(z.string()).max(5).optional().default([]),
});

function clampNote(note: z.infer<typeof NoteEventSchema>, totalBeats: number): NoteEvent | null {
  const startTime = Math.max(0, Math.min(totalBeats - 0.125, Number(note.startTime.toFixed(3))));
  const duration = Math.max(0.125, Math.min(totalBeats - startTime, Number(note.duration.toFixed(3))));
  if (!Number.isFinite(startTime) || !Number.isFinite(duration) || duration <= 0) return null;
  return {
    pitch: Math.max(0, Math.min(127, Math.round(note.pitch))),
    startTime,
    duration,
    velocity: Math.max(1, Math.min(127, Math.round(note.velocity))),
  };
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJsonObject(text: string): unknown | null {
  const cleaned = stripCodeFence(text);
  const attempts = [
    cleaned,
    cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1),
  ].filter((candidate) => candidate.trim().startsWith('{') && candidate.trim().endsWith('}'));

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try next extraction
    }
  }
  return null;
}

function quantizeBeat(value: number, step = 0.25): number {
  return Number((Math.round(value / step) * step).toFixed(3));
}

function fallbackCleanup(notes: NoteEvent[], totalBeats: number): NoteEvent[] {
  const cleaned = notes
    .map((note) => {
      const startTime = Math.max(0, Math.min(totalBeats - 0.125, quantizeBeat(note.startTime)));
      const duration = Math.max(0.125, Math.min(totalBeats - startTime, quantizeBeat(note.duration)));
      return {
        pitch: Math.max(0, Math.min(127, Math.round(note.pitch))),
        startTime,
        duration,
        velocity: Math.max(1, Math.min(127, Math.round(note.velocity))),
      };
    })
    .filter((note) => note.duration > 0 && note.startTime < totalBeats)
    .sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);

  const deduped: NoteEvent[] = [];
  for (const note of cleaned) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.pitch === note.pitch &&
      Math.abs(prev.startTime - note.startTime) < 0.001 &&
      Math.abs(prev.duration - note.duration) < 0.001
    ) {
      prev.velocity = Math.max(prev.velocity, note.velocity);
      continue;
    }
    deduped.push(note);
  }
  return deduped;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const rl = await enforceRateLimit({ req, userId: userId ?? null });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'Sign in to post-process transcriptions' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key is not configured' }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const input = parsed.data;
  const totalBeats = input.bars * 4;
  const sourceNotes = input.notes
    .map((note) => clampNote(note, totalBeats))
    .filter((note): note is NoteEvent => note !== null)
    .slice(0, 260);

  if (sourceNotes.length === 0) {
    return NextResponse.json({ error: 'No usable notes to post-process' }, { status: 400 });
  }

  const featureCheck = await checkFeatureAllowed(userId, 'audio');
  if (!featureCheck.allowed) {
    return NextResponse.json(
      {
        error: featureCheck.blocked_by === 'daily'
          ? 'Daily transcription limit reached'
          : 'Monthly transcription limit reached',
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

  const client = new Anthropic({ apiKey });
  const system = [
    {
      type: 'text' as const,
      text: `You are pulp's MIDI transcription cleanup engineer.
Return ONLY valid JSON. No markdown.

You receive notes produced by Spotify Basic Pitch from an uploaded audio file.
Clean them for a producer:
- Quantize startTime and duration to useful musical values, usually 1/16 or 1/8.
- Correct obvious wrong pitches toward the requested key/scale.
- Preserve the musical phrase and do not invent a completely new melody.
- Merge tiny duplicated notes and remove glitch notes.
- Keep all notes inside bars * 4 beats.
- Keep velocities musical.

Return:
{
  "notes": [{"pitch": 60, "startTime": 0, "duration": 0.5, "velocity": 92}],
  "suggestions": ["short practical suggestion"]
}`,
      cache_control: { type: 'ephemeral' as const },
    },
  ];

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 5000,
      temperature: 0.25,
      system,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            sourceName: input.sourceName,
            key: input.key,
            scale: input.scale,
            bpm: input.bpm,
            bars: input.bars,
            totalBeats,
            notes: sourceNotes,
          }),
        },
      ],
    });
    await logAnthropicUsage({
      userId,
      endpoint: 'postprocess-transcription',
      model: MODEL,
      usage: message.usage,
      metadata: {
        sourceName: input.sourceName,
        sourceNotes: sourceNotes.length,
        bars: input.bars,
        bpm: input.bpm,
      },
    });
    const usage = normalizeAnthropicUsage(message.usage);

    const block = message.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const raw = extractJsonObject(text);
    if (!raw) {
      const notes = fallbackCleanup(sourceNotes, totalBeats);
      const costUsd = calculateAnthropicCostUsd(usage);
      await incrementFeatureCost(userId, 'audio', costUsd);
      return NextResponse.json({
        notes,
        suggestions: ['Claude returned invalid JSON, so pulp applied deterministic quantize cleanup.'],
        model: MODEL,
        usage,
        cost_usd: Number(costUsd.toFixed(8)),
        cleanup_mode: 'fallback',
        feature_usage: {
          daily_cost: featureCheck.daily_cost + costUsd,
          daily_limit: featureCheck.daily_limit,
          monthly_cost: featureCheck.monthly_cost + costUsd,
          monthly_limit: featureCheck.monthly_limit,
          daily_pct: Math.min(100, ((featureCheck.daily_cost + costUsd) / featureCheck.daily_limit) * 100),
          monthly_pct: Math.min(100, ((featureCheck.monthly_cost + costUsd) / featureCheck.monthly_limit) * 100),
        },
      });
    }
    const parsedOut = OutSchema.safeParse(raw);
    if (!parsedOut.success) {
      const notes = fallbackCleanup(sourceNotes, totalBeats);
      const costUsd = calculateAnthropicCostUsd(usage);
      await incrementFeatureCost(userId, 'audio', costUsd);
      return NextResponse.json({
        notes,
        suggestions: ['Claude cleanup schema failed, so pulp applied deterministic quantize cleanup.'],
        model: MODEL,
        usage,
        cost_usd: Number(costUsd.toFixed(8)),
        cleanup_mode: 'fallback',
        feature_usage: {
          daily_cost: featureCheck.daily_cost + costUsd,
          daily_limit: featureCheck.daily_limit,
          monthly_cost: featureCheck.monthly_cost + costUsd,
          monthly_limit: featureCheck.monthly_limit,
          daily_pct: Math.min(100, ((featureCheck.daily_cost + costUsd) / featureCheck.daily_limit) * 100),
          monthly_pct: Math.min(100, ((featureCheck.monthly_cost + costUsd) / featureCheck.monthly_limit) * 100),
        },
      });
    }

    const notes = parsedOut.data.notes
      .map((note) => clampNote(note, totalBeats))
      .filter((note): note is NoteEvent => note !== null)
      .sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);

    if (notes.length === 0) {
      return NextResponse.json({ error: 'Claude returned no usable notes' }, { status: 502 });
    }
    const costUsd = calculateAnthropicCostUsd(usage);
    await incrementFeatureCost(userId, 'audio', costUsd);
    return NextResponse.json({
      notes,
      suggestions: parsedOut.data.suggestions.slice(0, 5),
      model: MODEL,
      usage,
      cost_usd: Number(costUsd.toFixed(8)),
      feature_usage: {
        daily_cost: featureCheck.daily_cost + costUsd,
        daily_limit: featureCheck.daily_limit,
        monthly_cost: featureCheck.monthly_cost + costUsd,
        monthly_limit: featureCheck.monthly_limit,
        daily_pct: Math.min(100, ((featureCheck.daily_cost + costUsd) / featureCheck.daily_limit) * 100),
        monthly_pct: Math.min(100, ((featureCheck.monthly_cost + costUsd) / featureCheck.monthly_limit) * 100),
      },
    });
  } catch (error) {
    console.error('[postprocess-transcription]', error);
    return NextResponse.json({ error: 'Transcription cleanup failed' }, { status: 500 });
  }
}
