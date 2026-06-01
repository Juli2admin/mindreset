import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { safeEqual } from '@/lib/encrypt';
import { sendSupportReply } from '@/lib/email/sendSupportReply';

export const dynamic = 'force-dynamic';

// Vercel Cron — runs every minute (see vercel.json). Picks up any
// SupportEmail rows where status='auto_queued' AND autoSendAt <= now()
// and dispatches the AI draft via Resend.
//
// The 60-second hold from the inbound webhook gives the admin a window
// to either cancel the auto-send (by editing the row in /admin/support)
// or do nothing and let the cron fire. Each batch is capped to keep a
// single Vercel function invocation under the time limit.
//
// Idempotency: rows are claimed via updateMany with the auto_queued
// status as a guard so two concurrent cron runs cannot double-send.
// If Resend send fails, the row is moved to 'drafted' so the admin
// sees it in the manual queue (rather than silently retrying forever).

const AUTOSEND_BATCH_LIMIT = 25;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return safeEqual(match[1], secret);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.supportEmail.findMany({
    where: {
      status: 'auto_queued',
      autoSendAt: { lte: now },
    },
    orderBy: { autoSendAt: 'asc' },
    take: AUTOSEND_BATCH_LIMIT,
    select: {
      id: true,
      fromEmail: true,
      fromName: true,
      subject: true,
      draftReply: true,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    if (!row.draftReply) {
      // Defensive: auto_queued without a draft should not happen, but if
      // it did, kick to manual review.
      await prisma.supportEmail.update({
        where: { id: row.id },
        data: { status: 'drafted', autoSendAt: null },
      });
      failed++;
      continue;
    }

    // Claim the row by flipping to a transient status first — prevents
    // a second concurrent cron from picking the same row.
    const claim = await prisma.supportEmail.updateMany({
      where: { id: row.id, status: 'auto_queued' },
      data: { status: 'auto_sending' },
    });
    if (claim.count === 0) continue;

    const send = await sendSupportReply({
      toEmail: row.fromEmail,
      toName: row.fromName,
      subject: row.subject,
      body: row.draftReply,
      inboundSubject: row.subject,
    });

    if (send.ok === false) {
      console.error('[cron/support-autosend] send failed', {
        id: row.id,
        error: send.error,
      });
      await prisma.supportEmail.update({
        where: { id: row.id },
        data: { status: 'drafted', autoSendAt: null },
      });
      failed++;
      continue;
    }

    await prisma.$transaction([
      prisma.supportEmailReply.create({
        data: {
          supportEmailId: row.id,
          toEmail: row.fromEmail,
          subject: `Re: ${row.subject}`,
          body: row.draftReply,
          sentByAdminId: null,
          resendId: send.resendId,
          autoSent: true,
        },
      }),
      prisma.supportEmail.update({
        where: { id: row.id },
        data: { status: 'replied', autoSendAt: null },
      }),
    ]);
    sent++;
  }

  return NextResponse.json({ sent, failed, considered: due.length });
}
