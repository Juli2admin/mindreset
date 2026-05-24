import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Lazy singleton — Redis client only created when first rate-limit check fires.
// Avoids import-time errors when UPSTASH_REDIS_REST_URL is not set (e.g. in
// unit tests or local dev without Redis).
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

// Chat: 10 requests/min per authenticated user
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

// Chat: 30 requests/min per IP (blocks cheap-account-creation attacks)
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

// Screening: 5 submissions/hour per IP
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

// Returns { limited: false } when both checks pass.
// Returns { limited: true, retryAfter } on first violation (doesn't charge
// the other limiter, saving Redis writes on already-blocked requests).
export async function checkChatRateLimit(
  userId: string,
  ip: string,
): Promise<RateLimitResult> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    // Redis not configured — skip silently (local dev / test environments).
    return { limited: false };
  }

  const [userResult, ipResult] = await Promise.all([
    getChatUserLimiter().limit(userId),
    getChatIpLimiter().limit(ip),
  ]);

  if (!userResult.success) {
    const retryAfter = Math.ceil((userResult.reset - Date.now()) / 1000);
    return { limited: true, retryAfter };
  }
  if (!ipResult.success) {
    const retryAfter = Math.ceil((ipResult.reset - Date.now()) / 1000);
    return { limited: true, retryAfter };
  }
  return { limited: false };
}

export async function checkScreeningRateLimit(ip: string): Promise<RateLimitResult> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { limited: false };
  }

  const result = await getScreeningIpLimiter().limit(ip);
  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return { limited: true, retryAfter };
  }
  return { limited: false };
}
