import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN must be set');
    }
    _redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
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

// Newsletter signup is an anonymous public endpoint. Same posture as
// screening (fail-open on Redis blip; modest IP cap to deter spam
// without blocking legitimate users sharing networks).
let _newsletterIp: Ratelimit | null = null;
function getNewsletterIpLimiter(): Ratelimit {
  if (!_newsletterIp) {
    _newsletterIp = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'rl:newsletter:ip',
    });
  }
  return _newsletterIp;
}

// Voice transcription rate limit. Slightly looser than chat (20/min vs
// 10/min) so users can retake a recording without hitting the limit, but
// tight enough to keep Groq API spend predictable. IP limiter at 60/min
// is defence against credential leak / abuse from a single source.
let _transcribeUser: Ratelimit | null = null;
function getTranscribeUserLimiter(): Ratelimit {
  if (!_transcribeUser) {
    _transcribeUser = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'rl:transcribe:user',
    });
  }
  return _transcribeUser;
}

let _transcribeIp: Ratelimit | null = null;
function getTranscribeIpLimiter(): Ratelimit {
  if (!_transcribeIp) {
    _transcribeIp = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'rl:transcribe:ip',
    });
  }
  return _transcribeIp;
}

export type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfter: number };

// In production, missing Upstash env vars = fail-closed (throw).
// In dev/test, missing env vars = skip silently (fail-open by design).
function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function assertRedisInProd(): void {
  if (process.env.NODE_ENV === 'production' && !isRedisConfigured()) {
    throw new Error(
      'Rate limiting is not configured: KV_REST_API_URL and KV_REST_API_TOKEN must be set in production.',
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

export async function checkNewsletterRateLimit(ip: string): Promise<RateLimitResult> {
  assertRedisInProd();
  if (!isRedisConfigured()) {
    return { limited: false };
  }

  try {
    const result = await getNewsletterIpLimiter().limit(ip);
    if (!result.success) {
      return { limited: true, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) };
    }
    return { limited: false };
  } catch (err) {
    // Fail-open like screening — newsletter signup is low-stakes; a Redis
    // outage shouldn't keep a willing prospect from joining the list.
    console.error('[rateLimit] Upstash error on newsletter check — failing open:', err);
    return { limited: false };
  }
}

// Voice transcribe rate limit — mirrors chat's fail-closed posture because
// each transcription call is paid (Groq API). Dual user+IP guard matches
// the chat limiter shape so abuse can't bypass via different accounts on
// the same IP or vice versa.
export async function checkTranscribeRateLimit(
  userId: string,
  ip: string,
): Promise<RateLimitResult> {
  assertRedisInProd();
  if (!isRedisConfigured()) {
    return { limited: false };
  }

  try {
    const [userResult, ipResult] = await Promise.all([
      getTranscribeUserLimiter().limit(userId),
      getTranscribeIpLimiter().limit(ip),
    ]);

    if (!userResult.success) {
      return { limited: true, retryAfter: Math.ceil((userResult.reset - Date.now()) / 1000) };
    }
    if (!ipResult.success) {
      return { limited: true, retryAfter: Math.ceil((ipResult.reset - Date.now()) / 1000) };
    }
    return { limited: false };
  } catch (err) {
    console.error('[rateLimit] Upstash error on transcribe check — failing closed with 503:', err);
    return { limited: true, retryAfter: 60 };
  }
}
