import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const TOPICS = [
  'How to generate Tech House MIDI with AI',
  'Afro House chord progressions guide',
  'Importing AI MIDI into FL Studio',
  'Sidechain-friendly basslines: MIDI patterns that pump',
  'Writing better drum grooves with velocity and swing',
  'Melodic techno: building tension with 2-chord loops',
  'Chord voicings for house music (simple but rich)',
  'How to turn one MIDI loop into a full arrangement',
  'Top 5 MIDI mistakes that make a beat feel robotic',
  'Using call-and-response in MIDI melodies',
  'Garage hats and shuffles: a producer-friendly guide',
  'Minimal techno: pattern variation without changing chords',
  'How to layer MIDI: lead + counter melody',
  'Turning a chord progression into a bassline that works',
  'Writing fills and transitions with MIDI drums',
  'Harmonic minor vs minor: when to use it in dance music',
  'Creating tension with chromatic passing notes',
  'How to humanize MIDI for better groove',
  'Building chord progressions around a vocal hook (MIDI-first)',
  'Mix-ready MIDI: arranging for headroom and clarity',
];

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { topic: null };
  const idx = args.findIndex(a => a === '--topic');
  if (idx !== -1) out.topic = args[idx + 1] ?? null;
  return out;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const { topic: topicArg } = parseArgs();
  const topic = topicArg || pickRandom(TOPICS);

  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );

  const anthropic = new Anthropic({ apiKey: requiredEnv('ANTHROPIC_API_KEY') });

  const prompt = `Write a 400 word blog post for pulp, an AI MIDI generator tool.
Topic: ${topic}
Include practical tips for music producers.
Return JSON ONLY with this shape:
{
  "slug": "string",
  "title": "string",
  "excerpt": "string",
  "content": "string (markdown)",
  "read_time": "string"
}`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
  const cleaned = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);

  const slug = String(parsed.slug || '').trim();
  const title = String(parsed.title || '').trim();
  const excerpt = String(parsed.excerpt || '').trim();
  const content = String(parsed.content || '').trim();
  const read_time = String(parsed.read_time || '').trim();

  if (!slug || !title || !excerpt || !content || !read_time) {
    throw new Error('Claude returned invalid JSON payload (missing required fields)');
  }

  // Skip if slug exists
  const { data: existing } = await supabase.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
  if (existing?.id) {
    console.log('Skip: slug already exists:', slug);
    return;
  }

  const { error } = await supabase.from('blog_posts').insert({
    slug,
    title,
    excerpt,
    content,
    read_time,
    published_at: new Date().toISOString(),
  });

  if (error) throw error;

  console.log('Inserted post:', { slug, title, topic });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

