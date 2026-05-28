import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { safeEqual } from '@/lib/encrypt';

export const dynamic = 'force-dynamic';

const RETENTION_MONTHS = 12;

// Vercel Cron: runs daily at 02:00 UTC (see vercel.json).
//
// Two sweeps in one route:
//   1. Conversation retention — deletes Conversation rows inactive for
//      more than RETENTION_MONTHS months. Messages cascade.
//      WellbeingSnapshot is per-user and NOT touched — it survives
//      account-lifetime.
//   2. GDPR hard-delete — deletes User rows whose deletionScheduledAt
//      has passed. All child rows cascade (Conversation, Message,
//      ScreeningResponse, WellbeingSnapshot, Purchase, ModuleProgress,
//      RecodeProgress, Practice, SafetyEvent, AccountDeletionToken).
//      Clerk user must be deleted out-of-band — we don't have admin
//      credentials here. (Future: hit Clerk's admin API; for soft-launch
//      Julia can clean up Clerk manually after the cron run, since the
//      orphaned Clerk user can no longer reach any data anyway.)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/retention] CRON_SECRET env var is not set — refusing to run');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (!safeEqual(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  try {
    const { count: conversationsDeleted } = await prisma.conversation.deleteMany({
      where: { lastActivityAt: { lt: cutoff } },
    });
    console.log(
      `[cron/retention] deleted ${conversationsDeleted} conversation(s) older than ${cutoff.toISOString()}`,
    );

    const now = new Date();
    const { count: usersDeleted } = await prisma.user.deleteMany({
      where: { deletionScheduledAt: { lt: now } },
    });
    if (usersDeleted > 0) {
      console.log(`[cron/retention] hard-deleted ${usersDeleted} user(s) past scheduled deletion`);
    }

    return NextResponse.json({
      conversationsDeleted,
      usersDeleted,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    console.error('[cron/retention] sweep failed:', err);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}
