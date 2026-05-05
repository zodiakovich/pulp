import { supabaseAdmin } from '@/lib/supabase-admin';

export type FeatureType = 'build' | 'midi' | 'audio';

export type PlanType = 'free' | 'pro' | 'studio';

export type WindowCheckResult = {
  allowed: boolean;
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
  blocked_by: 'daily' | 'monthly' | null;
};

export const FEATURE_CAPS = {
  build: {
    free: { daily: 3, monthly: 20 },
    pro: { daily: 20, monthly: 300 },
    studio: { daily: 60, monthly: 800 },
  },
  midi: {
    free: { daily: 1, monthly: 5 },
    pro: { daily: 8, monthly: 80 },
    studio: { daily: 25, monthly: 200 },
  },
  audio: {
    free: { daily: 1, monthly: 3 },
    pro: { daily: 5, monthly: 50 },
    studio: { daily: 15, monthly: 150 },
  },
} as const;

type FeatureCreditRow = {
  user_id: string;
  plan_type: string | null;
  is_pro: boolean | null;
  build_daily_used: number;
  build_daily_reset_at: string;
  build_monthly_used: number;
  build_monthly_reset_at: string;
  midi_daily_used: number;
  midi_daily_reset_at: string;
  midi_monthly_used: number;
  midi_monthly_reset_at: string;
  audio_daily_used: number;
  audio_daily_reset_at: string;
  audio_monthly_used: number;
  audio_monthly_reset_at: string;
};

type FeatureUsageState = {
  build: WindowCheckResult;
  midi: WindowCheckResult;
  audio: WindowCheckResult;
  plan_type: PlanType;
};

const FEATURE_COLUMNS = {
  build: {
    dailyUsed: 'build_daily_used',
    dailyResetAt: 'build_daily_reset_at',
    monthlyUsed: 'build_monthly_used',
    monthlyResetAt: 'build_monthly_reset_at',
  },
  midi: {
    dailyUsed: 'midi_daily_used',
    dailyResetAt: 'midi_daily_reset_at',
    monthlyUsed: 'midi_monthly_used',
    monthlyResetAt: 'midi_monthly_reset_at',
  },
  audio: {
    dailyUsed: 'audio_daily_used',
    dailyResetAt: 'audio_daily_reset_at',
    monthlyUsed: 'audio_monthly_used',
    monthlyResetAt: 'audio_monthly_reset_at',
  },
} as const;

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

function defaultWindowValues(now: Date) {
  return {
    build_daily_used: 0,
    build_daily_reset_at: addDays(now, 1),
    build_monthly_used: 0,
    build_monthly_reset_at: addDays(now, 30),
    midi_daily_used: 0,
    midi_daily_reset_at: addDays(now, 1),
    midi_monthly_used: 0,
    midi_monthly_reset_at: addDays(now, 30),
    audio_daily_used: 0,
    audio_daily_reset_at: addDays(now, 1),
    audio_monthly_used: 0,
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
    if (now > new Date(row[columns.dailyResetAt])) {
      update[columns.dailyUsed] = 0;
      update[columns.dailyResetAt] = addDays(now, 1);
    }
    if (now > new Date(row[columns.monthlyResetAt])) {
      update[columns.monthlyUsed] = 0;
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

function buildWindowResult(row: FeatureCreditRow, feature: FeatureType, planType: PlanType): WindowCheckResult {
  const columns = FEATURE_COLUMNS[feature];
  const caps = FEATURE_CAPS[feature][planType];
  const dailyUsed = Number(row[columns.dailyUsed] ?? 0);
  const monthlyUsed = Number(row[columns.monthlyUsed] ?? 0);
  const blockedBy = dailyUsed >= caps.daily ? 'daily' : monthlyUsed >= caps.monthly ? 'monthly' : null;

  return {
    allowed: blockedBy === null,
    daily_used: dailyUsed,
    daily_limit: caps.daily,
    monthly_used: monthlyUsed,
    monthly_limit: caps.monthly,
    blocked_by: blockedBy,
  };
}

export async function checkFeatureAllowed(userId: string, feature: FeatureType): Promise<WindowCheckResult> {
  const row = await resetExpiredWindows(await getOrCreateFeatureCreditRow(userId));
  const planType = resolvePlanType(row);
  return buildWindowResult(row, feature, planType);
}

export async function incrementFeatureUsage(userId: string, feature: FeatureType): Promise<void> {
  const db = requireAdmin();
  await getOrCreateFeatureCreditRow(userId);
  const { error } = await db.rpc('increment_feature_usage', {
    target_user_id: userId,
    target_feature: feature,
  });

  if (error) throw error;
}

export async function getFeatureUsage(userId: string): Promise<FeatureUsageState> {
  const row = await resetExpiredWindows(await getOrCreateFeatureCreditRow(userId));
  const planType = resolvePlanType(row);
  return {
    build: buildWindowResult(row, 'build', planType),
    midi: buildWindowResult(row, 'midi', planType),
    audio: buildWindowResult(row, 'audio', planType),
    plan_type: planType,
  };
}
