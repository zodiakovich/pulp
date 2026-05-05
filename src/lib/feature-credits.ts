import { supabaseAdmin } from '@/lib/supabase-admin';

export type FeatureType = 'build' | 'midi' | 'audio';
export type PlanType = 'free' | 'pro' | 'studio';

export type WindowCheckResult = {
  allowed: boolean;
  daily_cost: number;
  daily_limit: number;
  monthly_cost: number;
  monthly_limit: number;
  daily_pct: number;
  monthly_pct: number;
  blocked_by: 'daily' | 'monthly' | null;
};

export type FeatureUsageState = {
  daily_cost: number;
  daily_limit: number;
  monthly_cost: number;
  monthly_limit: number;
  daily_pct: number;
  monthly_pct: number;
  plan_type: PlanType;
  blocked_by: 'daily' | 'monthly' | null;
  allowed: boolean;
};

export const FEATURE_CAPS = {
  free: { daily: 0.005, monthly: 0.15 },
  pro: { daily: 0.10, monthly: 3.25 },
  studio: { daily: 0.30, monthly: 9.00 },
} as const;

const FEATURE_COLUMNS = {
  build: {
    dailyCost: 'build_daily_cost',
    dailyResetAt: 'build_daily_reset_at',
    monthlyCost: 'build_monthly_cost',
    monthlyResetAt: 'build_monthly_reset_at',
  },
  midi: {
    dailyCost: 'midi_daily_cost',
    dailyResetAt: 'midi_daily_reset_at',
    monthlyCost: 'midi_monthly_cost',
    monthlyResetAt: 'midi_monthly_reset_at',
  },
  audio: {
    dailyCost: 'audio_daily_cost',
    dailyResetAt: 'audio_daily_reset_at',
    monthlyCost: 'audio_monthly_cost',
    monthlyResetAt: 'audio_monthly_reset_at',
  },
} as const;

type CostColumn =
  | 'build_daily_cost'
  | 'build_monthly_cost'
  | 'midi_daily_cost'
  | 'midi_monthly_cost'
  | 'audio_daily_cost'
  | 'audio_monthly_cost';

type ResetColumn =
  | 'build_daily_reset_at'
  | 'build_monthly_reset_at'
  | 'midi_daily_reset_at'
  | 'midi_monthly_reset_at'
  | 'audio_daily_reset_at'
  | 'audio_monthly_reset_at';

type FeatureCreditRow = {
  user_id: string;
  plan_type: string | null;
  is_pro: boolean | null;
} & Record<CostColumn, number | null> & Record<ResetColumn, string | null>;

function requireAdmin() {
  if (!supabaseAdmin) {
    throw new Error('supabase_admin_unavailable');
  }
  return supabaseAdmin;
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function resolvePlanType(row: Pick<FeatureCreditRow, 'plan_type' | 'is_pro'>): PlanType {
  if (row.plan_type === 'studio') return 'studio';
  if (row.plan_type === 'pro') return 'pro';
  if (row.is_pro) return 'pro';
  return 'free';
}

function pct(cost: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, (cost / limit) * 100);
}

function cents(value: number): number {
  return Number(Math.max(0, value).toFixed(8));
}

function defaultWindowValues(now: Date) {
  return {
    build_daily_cost: 0,
    build_daily_reset_at: addDays(now, 1),
    build_monthly_cost: 0,
    build_monthly_reset_at: addDays(now, 30),
    midi_daily_cost: 0,
    midi_daily_reset_at: addDays(now, 1),
    midi_monthly_cost: 0,
    midi_monthly_reset_at: addDays(now, 30),
    audio_daily_cost: 0,
    audio_daily_reset_at: addDays(now, 1),
    audio_monthly_cost: 0,
    audio_monthly_reset_at: addDays(now, 30),
  };
}

async function getOrCreateFeatureCreditRow(userId: string): Promise<FeatureCreditRow> {
  const db = requireAdmin();
  const { data, error } = await db
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as FeatureCreditRow;

  const now = new Date();
  const { data: inserted, error: insertError } = await db
    .from('user_credits')
    .insert({
      user_id: userId,
      credits_used: 0,
      is_pro: false,
      plan_type: 'free',
      ...defaultWindowValues(now),
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted as FeatureCreditRow;
}

async function resetExpiredWindows(row: FeatureCreditRow): Promise<FeatureCreditRow> {
  const db = requireAdmin();
  const now = new Date();
  const update: Record<string, number | string> = {};

  for (const feature of Object.keys(FEATURE_COLUMNS) as FeatureType[]) {
    const columns = FEATURE_COLUMNS[feature];
    if (!row[columns.dailyResetAt] || now > new Date(row[columns.dailyResetAt] ?? 0)) {
      update[columns.dailyCost] = 0;
      update[columns.dailyResetAt] = addDays(now, 1);
    }
    if (!row[columns.monthlyResetAt] || now > new Date(row[columns.monthlyResetAt] ?? 0)) {
      update[columns.monthlyCost] = 0;
      update[columns.monthlyResetAt] = addDays(now, 30);
    }
  }

  if (Object.keys(update).length === 0) return row;

  const { data, error } = await db
    .from('user_credits')
    .update(update)
    .eq('user_id', row.user_id)
    .select('*')
    .single();

  if (error) throw error;
  return data as FeatureCreditRow;
}

function totalDailyCost(row: FeatureCreditRow): number {
  return cents(
    Number(row.build_daily_cost ?? 0) +
    Number(row.midi_daily_cost ?? 0) +
    Number(row.audio_daily_cost ?? 0),
  );
}

function totalMonthlyCost(row: FeatureCreditRow): number {
  return cents(
    Number(row.build_monthly_cost ?? 0) +
    Number(row.midi_monthly_cost ?? 0) +
    Number(row.audio_monthly_cost ?? 0),
  );
}

function buildWindowResult(row: FeatureCreditRow, planType: PlanType): WindowCheckResult {
  const caps = FEATURE_CAPS[planType];
  const dailyCost = totalDailyCost(row);
  const monthlyCost = totalMonthlyCost(row);
  const blockedBy = dailyCost >= caps.daily ? 'daily' : monthlyCost >= caps.monthly ? 'monthly' : null;

  return {
    allowed: blockedBy === null,
    daily_cost: dailyCost,
    daily_limit: caps.daily,
    monthly_cost: monthlyCost,
    monthly_limit: caps.monthly,
    daily_pct: pct(dailyCost, caps.daily),
    monthly_pct: pct(monthlyCost, caps.monthly),
    blocked_by: blockedBy,
  };
}

export async function checkFeatureAllowed(userId: string, _feature: FeatureType): Promise<WindowCheckResult> {
  const row = await resetExpiredWindows(await getOrCreateFeatureCreditRow(userId));
  const planType = resolvePlanType(row);
  return buildWindowResult(row, planType);
}

export async function incrementFeatureCost(userId: string, feature: FeatureType, costUsd: number): Promise<void> {
  const db = requireAdmin();
  const row = await resetExpiredWindows(await getOrCreateFeatureCreditRow(userId));
  const columns = FEATURE_COLUMNS[feature];
  const dailyCost = cents(Number(row[columns.dailyCost] ?? 0) + costUsd);
  const monthlyCost = cents(Number(row[columns.monthlyCost] ?? 0) + costUsd);

  const { error } = await db
    .from('user_credits')
    .update({
      [columns.dailyCost]: dailyCost,
      [columns.monthlyCost]: monthlyCost,
    })
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getFeatureUsage(userId: string): Promise<FeatureUsageState> {
  const row = await resetExpiredWindows(await getOrCreateFeatureCreditRow(userId));
  const planType = resolvePlanType(row);
  const result = buildWindowResult(row, planType);
  return {
    daily_cost: result.daily_cost,
    daily_limit: result.daily_limit,
    monthly_cost: result.monthly_cost,
    monthly_limit: result.monthly_limit,
    daily_pct: result.daily_pct,
    monthly_pct: result.monthly_pct,
    plan_type: planType,
    blocked_by: result.blocked_by,
    allowed: result.allowed,
  };
}
