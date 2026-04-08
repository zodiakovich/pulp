import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { enforceRateLimit } from '@/lib/ratelimit';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const rl = await enforceRateLimit({ req, userId: userId ?? null });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 });
    }

    const { prompt } = await req.json() as { prompt: string };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You are a music production assistant for pulp, an AI MIDI generator.
Extract musical parameters from the user's prompt and return ONLY valid JSON with no explanation.
Return this exact structure:
{
  "genre": "string (one of: Deep House, Melodic House, Tech House, Minimal Tech, Techno, Melodic Techno, Hard Techno, Progressive House, Afro House, Organic House, Trance, UK Garage, Drum & Bass, Amapiano, Lo-Fi Hip-Hop, Hip-Hop, Trap, Pop, R&B, Disco/Nu-Disco)",
  "bpm": "number (between 60-180, appropriate for the genre)",
  "scale": "string (major, minor, dorian, phrygian, lydian, mixolydian)",
  "mood": "string (dark, euphoric, melancholic, energetic, groovy, minimal, hypnotic)",
  "density": "string (sparse, medium, dense)",
  "styleTag": "string or null (closest matching style tag or null)"
}`,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Failed to parse prompt' }, { status: 500 });
  }
}
