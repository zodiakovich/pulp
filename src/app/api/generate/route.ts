import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { auth, currentUser } from '@clerk/nextjs/server';
import { enforceRateLimit, getIp } from '@/lib/ratelimit';
import { sendEmail } from '@/lib/email';
import {
  checkCreditsAllowed,
  checkGuestAllowed,
  GUEST_DAILY_LIMIT,
  incrementCredits,
  incrementGuest,
} from '@/lib/credits';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAnthropicUsage } from '@/lib/ai-usage';
import { checkFeatureAllowed, incrementFeatureUsage, type WindowCheckResult } from '@/lib/feature-credits';
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

async function extractWithAnthropic(userPrompt: string, userId?: string | null): Promise<Extracted | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;

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

  const block = message.content[0];
  const text = block?.type === 'text' ? block.text : '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned) as unknown;
  } catch {
    return null;
  }
  const parsed = EXTRACTED_SCHEMA.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
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

  const guestIp = getIp(req);
  let featureCheck: WindowCheckResult | null = null;

  if (!userId && !supabaseAdmin) {
    return NextResponse.json({ error: 'Guest generation unavailable' }, { status: 503 });
  }

  if (userId) {
    try {
      const c = await checkCreditsAllowed(userId);
      if (!c.allowed) {
        return NextResponse.json(
          {
            error: 'Monthly limit reached',
            credits_used: c.credits_used,
            limit: c.limit,
            is_pro: c.is_pro,
          },
          { status: 429 },
        );
      }
      featureCheck = await checkFeatureAllowed(userId, 'build');
      if (!featureCheck.allowed) {
        return NextResponse.json(
          {
            error: featureCheck.blocked_by === 'daily'
              ? 'Daily build limit reached'
              : 'Monthly build limit reached',
            blocked_by: featureCheck.blocked_by,
            daily_used: featureCheck.daily_used,
            daily_limit: featureCheck.daily_limit,
            monthly_used: featureCheck.monthly_used,
            monthly_limit: featureCheck.monthly_limit,
          },
          { status: 429 },
        );
      }
    } catch {
      return NextResponse.json({ error: 'Credits check unavailable' }, { status: 503 });
    }
  } else {
    const g = await checkGuestAllowed(guestIp);
    if (!g.allowed) {
      return NextResponse.json(
        {
          error: 'Guest limit reached',
          credits_used: g.count,
          limit: GUEST_DAILY_LIMIT,
          is_pro: false,
        },
        { status: 429 },
      );
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

  if (prompt.trim()) {
    const hints = parsePrompt(prompt);
    if (hints.bpm !== undefined) params.bpm = hints.bpm;
    if (hints.key !== undefined) params.key = hints.key;
    if (hints.scale !== undefined) params.scale = hints.scale;
    if (hints.bars !== undefined) params.bars = hints.bars;
    params.genre = genre;

    try {
      const ex = await extractWithAnthropic(prompt, userId);
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

  let creditsPayload: { credits_used: number; limit: number; is_pro: boolean; plan_type: string };
  try {
    if (userId) {
      await incrementCredits(userId);
      await incrementFeatureUsage(userId, 'build');
      const fin = await checkCreditsAllowed(userId);
      creditsPayload = {
        credits_used: fin.credits_used,
        limit: fin.limit,
        is_pro: fin.is_pro,
        plan_type: fin.plan_type,
      };

      // Send one-time low-gen warning when user just crossed 80% of their limit.
      const threshold = Math.floor(fin.limit * 0.8);
      if (fin.credits_used === threshold && supabaseAdmin) {
        void (async () => {
          try {
            const { data: row } = await supabaseAdmin
              .from('user_credits')
              .select('low_gen_warning_sent')
              .eq('user_id', userId)
              .maybeSingle();
            if (row && !row.low_gen_warning_sent) {
              await supabaseAdmin
                .from('user_credits')
                .update({ low_gen_warning_sent: true })
                .eq('user_id', userId);
              const user = await currentUser();
              const email = user?.emailAddresses?.[0]?.emailAddress;
              if (email) {
                await sendEmail({
                  to: email,
                  subject: "You're running low on generations",
                  html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090B;font-family:DM Sans,system-ui,sans-serif;color:#FAFAFA;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 40px 32px;">
        <tr><td>
          <p style="font-family:Syne,system-ui,sans-serif;font-size:28px;font-weight:700;color:#FF6D3F;margin:0 0 24px;">pulp.</p>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 16px;color:#FAFAFA;">Running low on generations.</h1>
          <p style="font-size:15px;line-height:1.7;color:#A1A1AA;margin:0 0 24px;">You've used <strong style="color:#FAFAFA;">${fin.credits_used} of ${fin.limit}</strong> monthly generations. Upgrade to Pro for 150/month and keep creating without limits.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="background:#FF6D3F;border-radius:10px;">
              <a href="https://pulp.bypapaya.com/pricing" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:-0.01em;">Upgrade now →</a>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#71717A;margin:0;">Your generations reset at the start of next month.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
                });
              }
            }
          } catch {
            // Never block the generation response for email failures.
          }
        })();
      }
    } else {
      const g = await incrementGuest(guestIp);
      creditsPayload = {
        credits_used: g.credits_used,
        limit: g.limit,
        is_pro: false,
        plan_type: 'free',
      };
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
    credits: creditsPayload,
    ...(featureCheck && {
      feature_usage: {
        daily_used: featureCheck.daily_used + 1,
        daily_limit: featureCheck.daily_limit,
        monthly_used: featureCheck.monthly_used + 1,
        monthly_limit: featureCheck.monthly_limit,
        blocked_by: null,
        allowed: true,
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
