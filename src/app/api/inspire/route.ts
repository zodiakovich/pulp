import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { enforceRateLimit } from '@/lib/ratelimit';
import { logAnthropicUsage } from '@/lib/ai-usage';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const rl = await enforceRateLimit({ req, userId: userId ?? null });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 });
    }

    const { inspiration } = await req.json() as { inspiration: string };

    if (!inspiration?.trim()) {
      return NextResponse.json({ error: 'No inspiration provided' }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are a music expert. The user wants to create music inspired by a song or artist.
Extract musical characteristics and return ONLY valid JSON:
{
  "genre": "string (from our 20 genres list)",
  "bpm": "number (60-180)",
  "key": "string (C/C#/D/D#/E/F/F#/G/G#/A/A#/B)",
  "scale": "string (Major/Minor/Dorian/Phrygian/Lydian/Mixolydian/Harmonic Minor)",
  "mood": "string",
  "styleTag": "string or null",
  "promptSuggestion": "string (a short prompt describing the vibe)"
}`,
      messages: [{ role: 'user', content: inspiration }],
    });
    void logAnthropicUsage({
      userId,
      endpoint: 'inspire',
      model: 'claude-haiku-4-5-20251001',
      usage: message.usage,
      metadata: { inspirationLength: inspiration.length },
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Failed to inspire' }, { status: 500 });
  }
}
