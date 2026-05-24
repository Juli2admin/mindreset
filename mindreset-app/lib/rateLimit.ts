import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
    }
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

let _chatUser: Ratelimit | null = null;
function getChatUserLimiter(): Ratelimit {
  if (!_chatUser) {
    _chatUser = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:chat:user',
    });
  }
  return _chatUser;
}

let _chatIp: Ratelimit | null = null;
function getChatIpLimiter(): Ratelimit {
  if (!_chatIp) {
    _chatIp = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      prefix: 'rl:chat:ip',
    });
  }
  return _chatIp;
}

let _screeningIp: Ratelimit | null = null;
function getScreeningIpLimiter(): Ratelimit {
  if (!_screeningIp) {
    _screeningIp = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'rl:screening:ip',
    });
  }
  return _screeningIp;
}

export type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfter: number };

// In production, missing Upstash env vars = fail-closed (throw).
// In dev/test, missing env vars = skip silently (fail-open by design).
function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function assertRedisInProd(): void {
  if (process.env.NODE_ENV === 'production' && !isRedisConfigured()) {
    throw new Error(
      'Rate limiting is not configured: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production.',
    );
  }
}

export async function checkChatRateLimit(
  userId: string,
  ip: string,
): Promise<RateLimitResult> {
  assertRedisInProd();
  if (!isRedisConfigured()) {
    return { limited: false };
  }

  try {
    const [userResult, ipResult] = await Promise.all([
      getChatUserLimiter().limit(userId),
      getChatIpLimiter().limit(ip),
    ]);

    if (!userResult.success) {
      return { limited: true, retryAfter: Math.ceil((userResult.reset - Date.now()) / 1000) };
    }
    if (!ipResult.success) {
      return { limited: true, retryAfter: Math.ceil((ipResult.reset - Date.now()) / 1000) };
    }
    return { limited: false };
  } catch (err) {
    console.error('[rateLimit] Upstash error — failing closed with 503:', err);
    return { limited: true, retryAfter: 60 };
  }
}

export async function checkScreeningRateLimit(ip: string): Promise<RateLimitResult> {
  assertRedisInProd();
  if (!isRedisConfigured()) {
    return { limited: false };
  }

  try {
    const result = await getScreeningIpLimiter().limit(ip);
    if (!result.success) {
      return { limited: true, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) };
    }
    return { limited: false };
  } catch (err) {
    // Screening is fail-open: a transient Redis error should never block a user
    // from completing the one-time screening flow. Chat stays fail-closed (cost).
    console.error('[rateLimit] Upstash error on screening check — failing open:', err);
    return { limited: false };
  }
}
