import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { supabaseAdmin } from '@/lib/supabase-admin';

const redis = Redis.fromEnv();

const freeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 d'),
  analytics: true,
  prefix: 'rl:free',
});

const proLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 d'),
  analytics: true,
  prefix: 'rl:pro',
});

function getIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]!.trim();
  const xr = req.headers.get('x-real-ip');
  if (xr) return xr.trim();
  return 'unknown';
}

export async function isProUser(userId: string): Promise<boolean> {
  try {
    if (!supabaseAdmin) return false;
    const { data } = await supabaseAdmin
      .from('user_credits')
      .select('is_pro')
      .eq('user_id', userId)
      .maybeSingle();
    return Boolean(data?.is_pro);
  } catch {
    return false;
  }
}

export async function enforceRateLimit(opts: {
  req: Request;
  userId: string | null;
  isPro?: boolean;
}): Promise<
  | { ok: true; limit: number; remaining: number; reset: number }
  | { ok: false; limit: number; remaining: number; reset: number; retryAfter: number }
> {
  const { req, userId } = opts;
  const isPro = opts.isPro ?? (userId ? await isProUser(userId) : false);

  const key = isPro && userId ? `user:${userId}` : `ip:${getIp(req)}`;
  const r = isPro ? await proLimiter.limit(key) : await freeLimiter.limit(key);

  const reset = typeof r.reset === 'number' ? r.reset : Date.now() + 60_000;
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

  if (!r.success) {
    return { ok: false, limit: r.limit, remaining: r.remaining, reset, retryAfter };
  }
  return { ok: true, limit: r.limit, remaining: r.remaining, reset };
}

