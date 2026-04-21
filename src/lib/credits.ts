import { supabaseAdmin } from '@/lib/supabase-admin';

/** Free tier monthly cap (must match product copy unless changed together). */
export const FREE_MONTHLY_LIMIT = 20;
/** Pro tier monthly cap. */
export const PRO_MONTHLY_LIMIT = 150;
/** Studio tier monthly cap. */
export const STUDIO_MONTHLY_LIMIT = 600;
/** Signed-out: max generations per IP per UTC calendar day. */
export const GUEST_DAILY_LIMIT = 3;

export type PlanType = 'free' | 'pro' | 'studio';

export type UserCreditsRow = {
  user_id: string;
  credits_used: number;
  is_pro: boolean;
  plan_type: PlanType | null;
  created_at: string;
};

function firstOfCurrentMonthISO(): string {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
}

export function resolvePlanType(row: UserCreditsRow): PlanType {
  if (!row.is_pro) return 'free';
  if (row.plan_type === 'studio') return 'studio';
  return 'pro';
}

export function monthlyLimitForRow(row: UserCreditsRow): number {
  const t = resolvePlanType(row);
  if (t === 'studio') return STUDIO_MONTHLY_LIMIT;
  if (t === 'pro') return PRO_MONTHLY_LIMIT;
  return FREE_MONTHLY_LIMIT;
}

/**
 * Ensures a row exists, applies calendar-month rollover on `created_at`, returns current row.
 * Server-only (service role).
 */
export async function getOrCreateCredits(userId: string): Promise<UserCreditsRow> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin not configured');
  }

  const { data: existing, error: selErr } = await supabaseAdmin
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (selErr && selErr.code !== 'PGRST116') {
    throw selErr;
  }

  if (!existing) {
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('user_credits')
      .insert({ user_id: userId, credits_used: 0, is_pro: false, plan_type: 'free' })
      .select('*')
      .single();
    if (insErr || !inserted) throw insErr ?? new Error('user_credits insert failed');
    return inserted as UserCreditsRow;
  }

  const row = existing as UserCreditsRow;
  const now = new Date();
  const created = new Date(row.created_at);
  if (created.getMonth() !== now.getMonth() || created.getFullYear() !== now.getFullYear()) {
    const iso = firstOfCurrentMonthISO();
    const { error: upErr } = await supabaseAdmin
      .from('user_credits')
      .update({ credits_used: 0, created_at: iso })
      .eq('user_id', userId);
    if (upErr) throw upErr;
    return { ...row, credits_used: 0, created_at: iso };
  }

  return row;
}

export async function checkCreditsAllowed(userId: string): Promise<{
  allowed: boolean;
  credits_used: number;
  is_pro: boolean;
  limit: number;
  plan_type: PlanType;
}> {
  const row = await getOrCreateCredits(userId);
  const plan_type = resolvePlanType(row);
  const limit = monthlyLimitForRow(row);
  const allowed = row.credits_used < limit;
  return { allowed, credits_used: row.credits_used, is_pro: row.is_pro, limit, plan_type };
}

/** Increments monthly usage by 1. Does not change `created_at`. Call once per successful multi-variation generate. */
export async function incrementCredits(userId: string): Promise<void> {
  if (!supabaseAdmin) throw new Error('Supabase admin not configured');
  const row = await getOrCreateCredits(userId);
  const { error } = await supabaseAdmin
    .from('user_credits')
    .update({ credits_used: row.credits_used + 1 })
    .eq('user_id', userId);
  if (error) throw error;
}

/** For rate-limit tier selection (Upstash). */
export async function getIsPro(userId: string): Promise<boolean> {
  try {
    const row = await getOrCreateCredits(userId);
    return Boolean(row.is_pro);
  } catch {
    return false;
  }
}

export function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function checkGuestAllowed(ip: string): Promise<{ allowed: boolean; count: number }> {
  if (!supabaseAdmin) {
    return { allowed: true, count: 0 };
  }
  const date = utcDateString();
  const { data, error } = await supabaseAdmin
    .from('guest_usage')
    .select('count')
    .eq('ip', ip)
    .eq('date', date)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    return { allowed: true, count: 0 };
  }
  const count = typeof data?.count === 'number' ? data.count : 0;
  return { allowed: count < GUEST_DAILY_LIMIT, count };
}

export async function incrementGuest(ip: string): Promise<{ credits_used: number; limit: number }> {
  if (!supabaseAdmin) {
    return { credits_used: 0, limit: GUEST_DAILY_LIMIT };
  }
  const date = utcDateString();
  const { data } = await supabaseAdmin
    .from('guest_usage')
    .select('count')
    .eq('ip', ip)
    .eq('date', date)
    .maybeSingle();
  const next = (typeof data?.count === 'number' ? data.count : 0) + 1;
  await supabaseAdmin.from('guest_usage').upsert(
    { ip, date, count: next },
    { onConflict: 'ip,date' },
  );
  return { credits_used: next, limit: GUEST_DAILY_LIMIT };
}
