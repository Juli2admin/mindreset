import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
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
//      Purchase cascade was added in the PR that introduced the
//      access-window schema (2026-07-03) — previously it was RESTRICT,
//      which took down the entire nightly batch on the first paying
//      user.
//
//      Clerk-side deletion is now integrated: after the DB rows are
//      gone, we call clerkClient.users.deleteUser for each id. This
//      closes the resurrection loop flagged by the audit (E3): a
//      deleted user's Clerk session used to survive the DB delete, and
//      their next /home visit would re-create the User row via the
//      defensive upsert with a fresh timestamp — right-to-erasure
//      defeated silently. Clerk deletion invalidates the session, so
//      the next request lands on /sign-in instead.
//
//      Clerk deletion is best-effort per-user (Promise.allSettled).
//      A failure logs the id so the owner can manually clean up in the
//      Clerk dashboard; DB deletion is still authoritative.
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

    // Two-phase user delete: read the IDs, delete the DB rows in one
    // atomic call, then fire per-id Clerk deletes.
    // deleteMany doesn't return the deleted rows, so we snapshot the
    // ids upfront. Deletion is race-tolerant: any row that appears
    // between the findMany and the deleteMany still deletes cleanly
    // (deleteMany matches by the same where clause); any Clerk id in
    // the snapshot that later re-signs-up is a different user in
    // Clerk's eyes.
    const usersToDelete = await prisma.user.findMany({
      where: { deletionScheduledAt: { lt: now } },
      select: { id: true },
    });
    const clerkIds = usersToDelete.map((u) => u.id);

    const { count: usersDeleted } = await prisma.user.deleteMany({
      where: { deletionScheduledAt: { lt: now } },
    });

    let clerkDeleted = 0;
    let clerkFailed = 0;
    if (clerkIds.length > 0) {
      const clerk = await clerkClient();
      const results = await Promise.allSettled(
        clerkIds.map((id) => clerk.users.deleteUser(id)),
      );
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
          clerkDeleted += 1;
        } else {
          clerkFailed += 1;
          console.error(
            `[cron/retention] Clerk delete failed for id=${clerkIds[i]}:`,
            r.reason,
          );
        }
      }
    }

    if (usersDeleted > 0) {
      console.log(
        `[cron/retention] hard-deleted ${usersDeleted} user(s) past scheduled deletion; Clerk: ${clerkDeleted} deleted, ${clerkFailed} failed`,
      );
    }

    return NextResponse.json({
      conversationsDeleted,
      usersDeleted,
      clerkDeleted,
      clerkFailed,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    console.error('[cron/retention] sweep failed:', err);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}
