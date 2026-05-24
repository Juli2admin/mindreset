import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { safeEqual } from '@/lib/encrypt';

export const dynamic = 'force-dynamic';

const RETENTION_MONTHS = 12;

// Vercel Cron: runs daily at 02:00 UTC (see vercel.json).
// Deletes Conversation rows inactive for more than RETENTION_MONTHS months.
// Messages cascade (onDelete: Cascade on Message.conversationId).
// WellbeingSnapshot is per-user and NOT touched — it survives account-lifetime.
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
    const { count } = await prisma.conversation.deleteMany({
      where: { lastActivityAt: { lt: cutoff } },
    });

    console.log(`[cron/retention] deleted ${count} conversation(s) older than ${cutoff.toISOString()}`);
    return NextResponse.json({ deleted: count, cutoff: cutoff.toISOString() });
  } catch (err) {
    console.error('[cron/retention] sweep failed:', err);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}
