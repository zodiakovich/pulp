import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/ratelimit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NOTE_NAMES, SCALE_INTERVALS, type NoteEvent } from '@/lib/music-engine';
import { calculateAnthropicCostUsd, logAnthropicUsage, normalizeAnthropicUsage } from '@/lib/ai-usage';
import { checkFeatureAllowed, incrementFeatureUsage } from '@/lib/feature-credits';

const MODEL = 'claude-haiku-4-5-20251001';

const TRACK_TYPES = ['melody', 'arp', 'bass', 'counter-melody', 'pad', 'drums', 'chords', 'lead', 'pluck'] as const;
const KEY_WHITELIST = NOTE_NAMES as readonly string[];
const SCALE_WHITELIST = Object.keys(SCALE_INTERVALS);

const MidiSingleSchema = z.object({
  prompt: z.string().min(3).max(1000).transform((s) => s.replace(/<[^>]*>/g, '').trim()),
  key: z.string().refine((k) => KEY_WHITELIST.includes(k), { message: 'Invalid key' }).optional().default('C'),
  scale: z.string().refine((s) => SCALE_WHITELIST.includes(s), { message: 'Invalid scale' }).optional().default('minor'),
  bpm: z.number().int().min(60).max(220).optional().default(124),
  bars: z.number().int().min(1).max(16).optional().default(4),
  trackType: z.enum(TRACK_TYPES).optional().default('melody'),
});

const ClaudeNoteSchema = z.object({
  pitch: z.number().int().min(0).max(127),
  startBeat: z.number().min(0),
  durationBeats: z.number().positive().max(16),
  velocity: z.number().int().min(1).max(127),
});

const ClaudeResponseSchema = z.object({
  notes: z.array(ClaudeNoteSchema).min(1).max(256),
});

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function toNoteEvents(notes: z.infer<typeof ClaudeNoteSchema>[], totalBeats: number): NoteEvent[] {
  return notes
    .map((note) => {
      const startTime = Math.max(0, Math.min(totalBeats - 0.125, Number(note.startBeat.toFixed(3))));
      const duration = Math.max(0.125, Math.min(totalBeats - startTime, Number(note.durationBeats.toFixed(3))));
      return {
        pitch: Math.max(0, Math.min(127, Math.round(note.pitch))),
        startTime,
        duration,
        velocity: Math.max(1, Math.min(127, Math.round(note.velocity))),
      };
    })
    .filter((note) => note.duration > 0 && note.startTime < totalBeats)
    .sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);
}

function buildSystemPrompt() {
  return `You are pulp's specialist single-track MIDI composer for professional music producers.
Return ONLY valid JSON. No markdown, no commentary.

Create a musically coherent single MIDI part for the requested track type. It must be DAW-ready, loopable, and editable.

JSON shape:
{
  "notes": [
    { "pitch": 60, "startBeat": 0, "durationBeats": 0.5, "velocity": 96 }
  ]
}

Rules:
- pitch is MIDI note number 0-127.
- startBeat and durationBeats are in quarter-note beats.
- Quantize most starts to 0.25 beat steps unless the prompt asks for loose timing.
- Keep all notes inside the requested number of bars.
- For drums, use General MIDI drum pitches: kick 36, snare/clap 38/39, closed hat 42, open hat 46, percussion 45-51.
- For bass, mostly use C1-C3 style register depending on key.
- For melody/lead/arp/counter-melody, use strong chord tones on important beats and tasteful passing notes.
- For pads/chords, create sustained chord tones as overlapping notes.
- Velocity should feel performed, usually 55-118.
- Prefer memorable musical motifs over random notes.`;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const rl = await enforceRateLimit({ req, userId: userId ?? null });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'Sign in to generate MIDI' }, { status: 401 });
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

  const parsed = MidiSingleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const input = parsed.data;
  const totalBeats = input.bars * 4;
  const featureCheck = await checkFeatureAllowed(userId, 'midi');
  if (!featureCheck.allowed) {
    return NextResponse.json(
      {
        error: featureCheck.blocked_by === 'daily'
          ? 'Daily midi limit reached'
          : 'Monthly midi limit reached',
        blocked_by: featureCheck.blocked_by,
        daily_used: featureCheck.daily_used,
        daily_limit: featureCheck.daily_limit,
        monthly_used: featureCheck.monthly_used,
        monthly_limit: featureCheck.monthly_limit,
      },
      { status: 429 },
    );
  }
  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 3200,
      temperature: 0.72,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            prompt: input.prompt,
            key: input.key,
            scale: input.scale,
            bpm: input.bpm,
            bars: input.bars,
            trackType: input.trackType,
            totalBeats,
          }),
        },
      ],
    });

    const block = message.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const raw = JSON.parse(stripCodeFence(text)) as unknown;
    const parsedResponse = ClaudeResponseSchema.safeParse(raw);
    if (!parsedResponse.success) {
      return NextResponse.json({ error: 'Claude returned invalid MIDI JSON', details: parsedResponse.error.issues }, { status: 502 });
    }

    const notes = toNoteEvents(parsedResponse.data.notes, totalBeats);
    if (notes.length === 0) {
      return NextResponse.json({ error: 'Claude returned no usable notes' }, { status: 502 });
    }

    const usage = message.usage;
    const normalizedUsage = normalizeAnthropicUsage(usage);
    const costUsd = calculateAnthropicCostUsd(usage);
    await logAnthropicUsage({
      userId,
      endpoint: 'generate-midi-single',
      model: MODEL,
      usage,
      metadata: {
        trackType: input.trackType,
        bars: input.bars,
        bpm: input.bpm,
        noteCount: notes.length,
      },
    });

    let generationId: string | null = null;
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('midi_generations')
        .insert({
          user_id: userId,
          prompt: input.prompt,
          key: input.key,
          scale: input.scale,
          bpm: input.bpm,
          bars: input.bars,
          track_type: input.trackType,
          notes,
          model: MODEL,
          input_tokens: normalizedUsage.input_tokens,
          output_tokens: normalizedUsage.output_tokens,
          cache_creation_input_tokens: normalizedUsage.cache_creation_input_tokens,
          cache_read_input_tokens: normalizedUsage.cache_read_input_tokens,
          cost_usd: Number(costUsd.toFixed(8)),
          raw_response: raw,
        })
        .select('id')
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to save MIDI generation' }, { status: 500 });
      }
      generationId = data?.id ?? null;
    }
    await incrementFeatureUsage(userId, 'midi');

    return NextResponse.json({
      id: generationId,
      prompt: input.prompt,
      params: input,
      notes,
      model: MODEL,
      usage: {
        input_tokens: normalizedUsage.input_tokens,
        output_tokens: normalizedUsage.output_tokens,
        cache_creation_input_tokens: normalizedUsage.cache_creation_input_tokens,
        cache_read_input_tokens: normalizedUsage.cache_read_input_tokens,
      },
      cost_usd: Number(costUsd.toFixed(8)),
      feature_usage: {
        daily_used: featureCheck.daily_used + 1,
        daily_limit: featureCheck.daily_limit,
        monthly_used: featureCheck.monthly_used + 1,
        monthly_limit: featureCheck.monthly_limit,
        blocked_by: null,
        allowed: true,
      },
    });
  } catch (error) {
    console.error('[generate-midi-single]', error);
    return NextResponse.json({ error: 'Single MIDI generation failed' }, { status: 500 });
  }
}
