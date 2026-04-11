import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { enforceRateLimit } from '@/lib/ratelimit';

const BodySchema = z.object({
  prompt: z.string().max(800).trim(),
});

const ResponseSchema = z.object({
  genres: z.array(z.string()),
  bpm_range: z.tuple([z.number(), z.number()]),
  energy: z.enum(['low', 'medium', 'high']),
  density: z.enum(['sparse', 'normal', 'dense']),
  mood_tags: z.array(z.string()),
  swing: z.boolean(),
  cleaned_prompt: z.string(),
});

const SYSTEM = `You are a music genre classifier. The user may have mentioned a DJ or music producer name.
Extract the musical style of that artist and return ONLY JSON — no explanation, no markdown.
NEVER include artist names, real names, stage names, or any identifying information in your response.
Return only musical descriptors.

{
  "genres": string[],
  "bpm_range": [number, number],
  "energy": "low" | "medium" | "high",
  "density": "sparse" | "normal" | "dense",
  "mood_tags": string[],
  "swing": boolean,
  "cleaned_prompt": string
}

cleaned_prompt must be the user's idea with any performer reference removed and replaced by a short genre/mood paraphrase (still no names).`;

function passthrough(prompt: string) {
  return NextResponse.json({
    genres: [] as string[],
    bpm_range: [100, 128] as [number, number],
    energy: 'medium' as const,
    density: 'normal' as const,
    mood_tags: [] as string[],
    swing: false,
    cleaned_prompt: prompt,
  });
}

export async function POST(req: NextRequest) {
  let safePrompt = '';
  try {
    const { userId } = await auth();
    const rl = await enforceRateLimit({ req, userId: userId ?? null });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success || !parsed.data.prompt.length) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const prompt = parsed.data.prompt;
    safePrompt = prompt;
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return passthrough(prompt);

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let raw: unknown;
    try {
      raw = JSON.parse(cleaned) as unknown;
    } catch {
      return passthrough(prompt);
    }

    const out = ResponseSchema.safeParse(raw);
    if (!out.success) return passthrough(prompt);

    return NextResponse.json(out.data);
  } catch {
    return passthrough(safePrompt);
  }
}
