import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { safeEqual } from '@/lib/encrypt';
import { sendPilotAfterFormEmail } from '@/lib/email/sendPilotAfterForm';

export const dynamic = 'force-dynamic';

// Vercel Cron — runs daily. See vercel.json.
//
// Finds pilot testers whose Before form was filled ≥ 30 days ago and
// who haven't submitted the After form yet, and fires the After-form
// nudge email once per invitation. Idempotent via
// sendPilotAfterFormEmail's atomic updateMany guard on
// afterFormEmailSentAt — a partial-failure Resend hiccup means the
// row stays eligible for tomorrow's run.
//
// Auth: CRON_SECRET Bearer header. Same pattern as /api/cron/drip.

const BATCH_LIMIT = 200; // per-cron-run cap; prevents runaway sends
const AFTER_FORM_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return safeEqual(match[1], secret);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/pilot-after-nudge] CRON_SECRET not set — refusing');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - AFTER_FORM_DELAY_MS);

  const candidates = await prisma.pilotInvitation.findMany({
    where: {
      revokedAt: null,
      beforeFormFilled: true,
      beforeFormFilledAt: { lte: cutoff },
      afterFormFilled: false,
      afterFormEmailSentAt: null,
    },
    select: {
      id: true,
      redeemedByUser: { select: { email: true, locale: true } },
    },
    take: BATCH_LIMIT,
  });

  let sent = 0;
  let skipped = 0;
  for (const c of candidates) {
    if (!c.redeemedByUser?.email) {
      skipped++;
      continue;
    }
    try {
      await sendPilotAfterFormEmail({
        invitationId: c.id,
        email: c.redeemedByUser.email,
        locale: c.redeemedByUser.locale ?? 'en',
      });
      sent++;
    } catch (err) {
      console.error('[cron/pilot-after-nudge] send failed', {
        invitationId: c.id,
        err: err instanceof Error ? err.message : String(err),
      });
      skipped++;
    }
  }

  const summary = {
    candidates: candidates.length,
    sent,
    skipped,
    cutoff: cutoff.toISOString(),
  };
  console.log('[cron/pilot-after-nudge] complete', summary);
  return NextResponse.json({ ok: true, summary });
}
