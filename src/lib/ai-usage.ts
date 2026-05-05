import { supabaseAdmin } from '@/lib/supabase-admin';

export const ANTHROPIC_HAIKU_45_MODEL = 'claude-haiku-4-5-20251001';

const INPUT_USD_PER_MTOK = 1;
const OUTPUT_USD_PER_MTOK = 5;
const CACHE_WRITE_USD_PER_MTOK = 1.25;
const CACHE_READ_USD_PER_MTOK = 0.1;

export type AnthropicUsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export type NormalizedAnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

export type AiUsageSummary = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalTokens: number;
  costUsd: number;
};

export type AiUsageDashboard = {
  today: AiUsageSummary;
  week: AiUsageSummary;
  month: AiUsageSummary;
  byEndpoint: Array<AiUsageSummary & { endpoint: string }>;
};

function usageNumber(usage: unknown, key: keyof AnthropicUsageLike): number {
  if (!usage || typeof usage !== 'object') return 0;
  const value = (usage as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function normalizeAnthropicUsage(usage: unknown): NormalizedAnthropicUsage {
  return {
    input_tokens: usageNumber(usage, 'input_tokens'),
    output_tokens: usageNumber(usage, 'output_tokens'),
    cache_creation_input_tokens: usageNumber(usage, 'cache_creation_input_tokens'),
    cache_read_input_tokens: usageNumber(usage, 'cache_read_input_tokens'),
  };
}

export function calculateAnthropicCostUsd(usage: unknown): number {
  const u = normalizeAnthropicUsage(usage);
  return (
    (u.input_tokens * INPUT_USD_PER_MTOK) +
    (u.output_tokens * OUTPUT_USD_PER_MTOK) +
    (u.cache_creation_input_tokens * CACHE_WRITE_USD_PER_MTOK) +
    (u.cache_read_input_tokens * CACHE_READ_USD_PER_MTOK)
  ) / 1_000_000;
}

export async function logAnthropicUsage(opts: {
  userId?: string | null;
  endpoint: string;
  model?: string;
  usage: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!supabaseAdmin) return;
  const usage = normalizeAnthropicUsage(opts.usage);
  const costUsd = calculateAnthropicCostUsd(usage);
  try {
    await supabaseAdmin.from('ai_usage_events').insert({
      user_id: opts.userId ?? null,
      endpoint: opts.endpoint,
      model: opts.model ?? ANTHROPIC_HAIKU_45_MODEL,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens,
      cost_usd: Number(costUsd.toFixed(8)),
      metadata: opts.metadata ?? {},
    });
  } catch (error) {
    console.error('[ai-usage] failed to log Anthropic usage', error);
  }
}

function emptySummary(): AiUsageSummary {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };
}

function summarize(rows: Array<Record<string, unknown>>): AiUsageSummary {
  const out = emptySummary();
  out.calls = rows.length;
  for (const row of rows) {
    const input = Number(row.input_tokens ?? 0);
    const output = Number(row.output_tokens ?? 0);
    const cacheWrite = Number(row.cache_creation_input_tokens ?? 0);
    const cacheRead = Number(row.cache_read_input_tokens ?? 0);
    out.inputTokens += Number.isFinite(input) ? input : 0;
    out.outputTokens += Number.isFinite(output) ? output : 0;
    out.cacheCreationInputTokens += Number.isFinite(cacheWrite) ? cacheWrite : 0;
    out.cacheReadInputTokens += Number.isFinite(cacheRead) ? cacheRead : 0;
    const cost = Number(row.cost_usd ?? 0);
    out.costUsd += Number.isFinite(cost) ? cost : 0;
  }
  out.totalTokens = out.inputTokens + out.outputTokens + out.cacheCreationInputTokens + out.cacheReadInputTokens;
  out.costUsd = Number(out.costUsd.toFixed(8));
  return out;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function getAiUsageDashboard(userId: string): Promise<AiUsageDashboard> {
  if (!supabaseAdmin) {
    return { today: emptySummary(), week: emptySummary(), month: emptySummary(), byEndpoint: [] };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = daysAgo(30);

  const { data, error } = await supabaseAdmin
    .from('ai_usage_events')
    .select('endpoint,input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens,cost_usd,created_at')
    .eq('user_id', userId)
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !data) {
    return { today: emptySummary(), week: emptySummary(), month: emptySummary(), byEndpoint: [] };
  }

  const rows = data as Array<Record<string, unknown>>;
  const todayRows = rows.filter((row) => String(row.created_at ?? '') >= todayStart.toISOString());
  const weekStart = daysAgo(7);
  const weekRows = rows.filter((row) => String(row.created_at ?? '') >= weekStart);
  const endpointMap = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const endpoint = String(row.endpoint ?? 'unknown');
    endpointMap.set(endpoint, [...(endpointMap.get(endpoint) ?? []), row]);
  }

  return {
    today: summarize(todayRows),
    week: summarize(weekRows),
    month: summarize(rows),
    byEndpoint: [...endpointMap.entries()]
      .map(([endpoint, endpointRows]) => ({ endpoint, ...summarize(endpointRows) }))
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, 6),
  };
}
