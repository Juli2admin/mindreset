import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { safeEqual } from '@/lib/encrypt';
import { sendDrip1, sendDrip2 } from '@/lib/email/sendDrip';

export const dynamic = 'force-dynamic';

// Vercel Cron — runs daily at 10:00 UTC (see vercel.json).
//
// Sends the onboarding drip in two cohorts, each gated on user
// behaviour AND on marketingConsent=true (these are marketing emails
// under PECR/GDPR, not transactional):
//
//   Drip 1 — Day 1 nudge ("Something brought you here")
//     - User signed up 24-48 hours ago
//     - User has never sent a MiniMind message (lifetimeMessagesUsed = 0)
//     - drip1SentAt is null
//
//   Drip 2 — Day 7 re-engagement ("A gentle reminder")
//     - User signed up 7-14 days ago
//     - User has sent < 5 messages (lifetimeMessagesUsed < 5)
//     - drip2SentAt is null
//
// Both stamps are claimed via updateMany so the cron is idempotent —
// if Resend send succeeds, we write the stamp; if it fails, we don't,
// and tomorrow's run picks up the user again (still within the
// eligibility window). The 24-hour windows above are why the daily
// cadence works — a user is eligible for exactly one drip-1 day and
// roughly seven drip-2 days.
//
// Deletion and unsubscribe: filter deletedAt IS NULL and
// marketingConsent = true. Unsubscribed users have marketingConsent
// flipped to false at unsubscribe time, so they're excluded.

const DRIP_BATCH_LIMIT = 200; // per-cron-run cap; prevents runaway sends

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return safeEqual(match[1], secret);
}

type Candidate = {
  id: string;
  email: string;
  locale: string;
};

async function findDrip1Candidates(): Promise<Candidate[]> {
  const now = Date.now();
  const since = new Date(now - 48 * 60 * 60 * 1000);
  const until = new Date(now - 24 * 60 * 60 * 1000);
  return prisma.user.findMany({
    where: {
      marketingConsent: true,
      deletedAt: null,
      lifetimeMessagesUsed: 0,
      drip1SentAt: null,
      createdAt: { gte: since, lte: until },
      email: { not: '' },
    },
    select: { id: true, email: true, locale: true },
    take: DRIP_BATCH_LIMIT,
  });
}

async function findDrip2Candidates(): Promise<Candidate[]> {
  const now = Date.now();
  const since = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const until = new Date(now - 7 * 24 * 60 * 60 * 1000);
  return prisma.user.findMany({
    where: {
      marketingConsent: true,
      deletedAt: null,
      lifetimeMessagesUsed: { lt: 5 },
      drip2SentAt: null,
      createdAt: { gte: since, lte: until },
      email: { not: '' },
    },
    select: { id: true, email: true, locale: true },
    take: DRIP_BATCH_LIMIT,
  });
}

async function fireDrip1(u: Candidate): Promise<'sent' | 'failed'> {
  const result = await sendDrip1({ userId: u.id, email: u.email, userLocale: u.locale });
  if (result.ok === false) {
    console.error('[cron/drip] drip1 send failed', { userId: u.id, error: result.error });
    return 'failed';
  }
  await prisma.user.updateMany({
    where: { id: u.id, drip1SentAt: null },
    data: { drip1SentAt: new Date() },
  });
  return 'sent';
}

async function fireDrip2(u: Candidate): Promise<'sent' | 'failed'> {
  const result = await sendDrip2({ userId: u.id, email: u.email, userLocale: u.locale });
  if (result.ok === false) {
    console.error('[cron/drip] drip2 send failed', { userId: u.id, error: result.error });
    return 'failed';
  }
  await prisma.user.updateMany({
    where: { id: u.id, drip2SentAt: null },
    data: { drip2SentAt: new Date() },
  });
  return 'sent';
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/drip] CRON_SECRET env var is not set — refusing to run');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [drip1Candidates, drip2Candidates] = await Promise.all([
    findDrip1Candidates(),
    findDrip2Candidates(),
  ]);

  let drip1Sent = 0;
  let drip1Failed = 0;
  for (const u of drip1Candidates) {
    const r = await fireDrip1(u);
    if (r === 'sent') drip1Sent++;
    else drip1Failed++;
  }

  let drip2Sent = 0;
  let drip2Failed = 0;
  for (const u of drip2Candidates) {
    const r = await fireDrip2(u);
    if (r === 'sent') drip2Sent++;
    else drip2Failed++;
  }

  const summary = {
    drip1: {
      candidates: drip1Candidates.length,
      sent: drip1Sent,
      failed: drip1Failed,
    },
    drip2: {
      candidates: drip2Candidates.length,
      sent: drip2Sent,
      failed: drip2Failed,
    },
  };
  console.log('[cron/drip] complete', summary);
  return NextResponse.json({ ok: true, summary });
}
