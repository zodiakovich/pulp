import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/ratelimit';
import { NOTE_NAMES, SCALE_INTERVALS, type NoteEvent } from '@/lib/music-engine';
import { logAnthropicUsage } from '@/lib/ai-usage';

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
  key: z.string().refine((k) => KEY_WHITELIST.includes(k), { message: 'Invalid key' }),
  scale: z.string().refine((s) => SCALE_WHITELIST.includes(s), { message: 'Invalid scale' }),
  bpm: z.number().int().min(60).max(220),
  bars: z.number().int().min(1).max(32),
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

  const client = new Anthropic({ apiKey });
  const system = `You are pulp's MIDI transcription cleanup engineer.
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
}`;

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
    void logAnthropicUsage({
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

    const block = message.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const raw = JSON.parse(stripCodeFence(text)) as unknown;
    const parsedOut = OutSchema.safeParse(raw);
    if (!parsedOut.success) {
      return NextResponse.json({ error: 'Claude returned invalid cleanup JSON', details: parsedOut.error.issues }, { status: 502 });
    }

    const notes = parsedOut.data.notes
      .map((note) => clampNote(note, totalBeats))
      .filter((note): note is NoteEvent => note !== null)
      .sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);

    if (notes.length === 0) {
      return NextResponse.json({ error: 'Claude returned no usable notes' }, { status: 502 });
    }

    return NextResponse.json({
      notes,
      suggestions: parsedOut.data.suggestions.slice(0, 5),
      model: MODEL,
      usage: message.usage,
    });
  } catch (error) {
    console.error('[postprocess-transcription]', error);
    return NextResponse.json({ error: 'Transcription cleanup failed' }, { status: 500 });
  }
}
