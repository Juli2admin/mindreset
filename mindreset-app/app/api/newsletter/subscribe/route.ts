import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkNewsletterRateLimit } from '@/lib/rateLimit';

// POST /api/newsletter/subscribe
//
// Anonymous public endpoint — anyone visiting the Landing page can drop
// an email here. No Clerk session required, no CSRF token (the action
// is non-destructive: subscribing the same email twice is a no-op).
//
// Rate-limited per IP (5 per hour) to deter low-effort spam. Fail-open
// on Redis outage — a willing prospect shouldn't be blocked because
// Upstash blinked.
//
// Returns:
//   { ok: true } — subscribed (or already subscribed; we don't tell)
//   { ok: false, error: 'invalid' } — bad email
//   { ok: false, error: 'rate_limited' } — too many from this IP
//
// The "already subscribed" path returns ok=true on purpose. We never
// surface to a stranger that a particular email is in our list — same
// privacy posture as the unsubscribe endpoint.

export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const VALID_LOCALES = ['en', 'ru', 'fr', 'de', 'es', 'it', 'pl', 'pt'] as const;

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = clientIp(request);
  const rl = await checkNewsletterRateLimit(ip);
  if (rl.limited) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  let body: { email?: unknown; locale?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  const localeRaw = typeof body.locale === 'string' ? body.locale : 'en';
  const locale = (VALID_LOCALES as readonly string[]).includes(localeRaw) ? localeRaw : 'en';

  // Upsert pattern: if email already exists, do nothing (don't clobber
  // an earlier unsubscribedAt). If new, create.
  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {}, // intentional no-op on duplicate
      create: { email, locale },
    });
  } catch (err) {
    console.error('[newsletter] subscribe failed:', err);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
