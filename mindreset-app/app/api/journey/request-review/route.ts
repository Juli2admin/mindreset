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
import { decrypt } from '@/lib/encrypt';
import { checkJourneyReviewRateLimit } from '@/lib/rateLimit';
import { sendJourneyReviewRequest } from '@/lib/email/sendJourneyReviewRequest';
import { runJourneyVerifier } from '@/lib/journey/safety/verifier';
import { clearFreezeForReview } from '@/lib/journey/safety/freeze';
import { evaluateAutoUnfreeze, extractSource, type VerifierOutcome } from '@/lib/journey/safety/auto-unfreeze';

export const dynamic = 'force-dynamic';

// How much recent context to hand the verifier on re-check — same shape as
// the live turn path uses (verifier.ts:RECENT_CONTEXT_LIMIT).
const RECHECK_CONTEXT_MESSAGES = 6;

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

  // Auto-unfreeze path — only for freeze sources we consider recoverable
  // (keyword_scan and state_report). The verifier is re-run on the user's
  // most recent message; only `clear_safe` lifts the freeze. See
  // lib/journey/safety/auto-unfreeze.ts for the safety-decision rationale.
  const source = extractSource(progress.frozenReason);
  if (source === 'keyword_scan' || source === 'state_report') {
    const outcome = await recheckWithVerifier(userId);
    const decision = evaluateAutoUnfreeze(progress.frozenReason, outcome);
    if (decision.action === 'auto_unfreeze') {
      const cleared = await clearFreezeForReview(userId);
      console.warn('[journey/request-review] auto-unfrozen', {
        userId,
        source,
        verifierOutcome: outcome,
        cleared,
      });
      if (cleared) {
        return NextResponse.json({ ok: true, unfrozen: true });
      }
      // Race condition: freeze already cleared between the checks. Treat as
      // idempotent success.
      return NextResponse.json({ ok: true, unfrozen: true });
    }
    console.warn('[journey/request-review] auto-unfreeze declined; falling through to human review', {
      userId,
      source,
      verifierOutcome: outcome,
      declineReason: decision.reason,
    });
    // Fall through to the existing email flow below.
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

  return NextResponse.json({ ok: true, unfrozen: false });
}

// Fetch the user's most recent message + a short recent-context window,
// decrypt both, and ask the Haiku verifier to re-classify. Returns the
// verifier verdict, or 'unavailable' on any failure (missing message,
// decrypt error, verifier timeout). Fail-closed by design — a re-check that
// can't be completed reliably must NOT unfreeze.
async function recheckWithVerifier(userId: string): Promise<VerifierOutcome> {
  try {
    const messages = await prisma.journeyMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: RECHECK_CONTEXT_MESSAGES + 1,
      select: { role: true, contentEncrypted: true, createdAt: true },
    });
    // Find the most recent USER message — that's the one that likely
    // triggered the freeze. Skip trailing assistant / canned-crisis rows.
    const latestUserIdx = messages.findIndex((m) => m.role === 'user');
    if (latestUserIdx < 0) return 'unavailable';
    const trigger = messages[latestUserIdx];
    // Context = the messages BEFORE the trigger, oldest-first.
    const contextRows = messages.slice(latestUserIdx + 1).reverse();

    const triggerText = decrypt(trigger.contentEncrypted);
    const contextDecoded = contextRows.map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: decrypt(m.contentEncrypted),
    }));

    const result = await runJourneyVerifier(triggerText, contextDecoded);
    return result.verdict;
  } catch (err) {
    console.error('[journey/request-review] verifier re-check failed', err);
    return 'unavailable';
  }
}
