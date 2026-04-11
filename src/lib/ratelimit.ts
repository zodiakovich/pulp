import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getIsPro } from '@/lib/credits';

const redis = Redis.fromEnv();

/** Signed-out: by IP, 3 requests per day. */
const guestLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 d'),
  analytics: true,
  prefix: 'rl:guest',
});

/** Signed-in free: 15 req/day (above 10/mo credit cap to avoid false blocks). */
const freeSignedLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, '1 d'),
  analytics: true,
  prefix: 'rl:free-signed',
});

/** Pro: 50 req/day. */
const proLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 d'),
  analytics: true,
  prefix: 'rl:pro',
});

export function getIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]!.trim();
  const xr = req.headers.get('x-real-ip');
  if (xr) return xr.trim();
  return 'unknown';
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

  if (!userId) {
    const key = `ip:${getIp(req)}`;
    const r = await guestLimiter.limit(key);
    const reset = typeof r.reset === 'number' ? r.reset : Date.now() + 60_000;
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    if (!r.success) {
      return { ok: false, limit: r.limit, remaining: r.remaining, reset, retryAfter };
    }
    return { ok: true, limit: r.limit, remaining: r.remaining, reset };
  }

  const isPro = opts.isPro ?? (await getIsPro(userId));
  const key = `user:${userId}`;
  const r = isPro ? await proLimiter.limit(key) : await freeSignedLimiter.limit(key);
  const reset = typeof r.reset === 'number' ? r.reset : Date.now() + 60_000;
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

  if (!r.success) {
    return { ok: false, limit: r.limit, remaining: r.remaining, reset, retryAfter };
  }
  return { ok: true, limit: r.limit, remaining: r.remaining, reset };
}
