// /api/journey/request-review
//
// Day 1 audit fix item 4.3 — paying user's path out of a frozen
// Journey state. Previously the only way to unfreeze was Julia
// running manual SQL. A user who tripped a false positive on the
// freeze gate had no recourse.
//
// Flow:
//   1. Auth check.
//   2. Verify the user has Journey access and is currently frozen
//      (don't accept requests from non-frozen users — this isn't
//      a general contact form).
//   3. Rate-limit: 1 request per user per 24 hours (caps spam).
//   4. Fetch frozen metadata (when, why) + user email from Clerk.
//   5. Send email to owner via sendJourneyReviewRequest helper.
//   6. Return ok/error to the client.
//
// Failure modes:
//   - Resend error or env not configured: return 503 so the UI can
//     show the user a "couldn't send" message instead of swallowing.
//   - User isn't frozen: 400 (defensive — UI should never call this
//     unless the user is in the frozen view).

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { checkJourneyReviewRateLimit } from '@/lib/rateLimit';
import { sendJourneyReviewRequest } from '@/lib/email/sendJourneyReviewRequest';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit: 1/day/user — fails open on Redis blip so users always
  // have a path to ask for help, even during a transient outage.
  const rate = await checkJourneyReviewRateLimit(userId);
  if (rate.limited) {
    return NextResponse.json(
      { error: 'Already requested', retryAfter: rate.retryAfter },
      { status: 429 },
    );
  }

  // Access gate: must own the Journey product.
  const purchase = await prisma.purchase.findFirst({
    where: { userId, productType: 'recode', status: 'completed' },
    select: { id: true },
  });
  if (!purchase) {
    return NextResponse.json({ error: 'No Journey access' }, { status: 403 });
  }

  // Verify the user is actually frozen — this endpoint isn't a
  // general contact form.
  const progress = await prisma.recodeProgress.findUnique({
    where: { userId },
    select: { frozenForReview: true, frozenAt: true, frozenReason: true },
  });
  if (!progress?.frozenForReview) {
    return NextResponse.json({ error: 'Not frozen' }, { status: 400 });
  }

  // Pull the user's email from Clerk — same pattern as the account
  // deletion flow. Falls through to null if Clerk can't provide one;
  // the email still sends with userId so the owner can look the user
  // up in Supabase directly.
  const clerkUser = await currentUser();
  const userEmail =
    clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    null;

  const result = await sendJourneyReviewRequest({
    userId,
    userEmail,
    frozenAt: progress.frozenAt,
    frozenReason: progress.frozenReason,
  });

  if (result.ok === false) {
    console.error('[journey/request-review] email send failed:', result.error);
    return NextResponse.json(
      { error: 'Could not send right now' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
