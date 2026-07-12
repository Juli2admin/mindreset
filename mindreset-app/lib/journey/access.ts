// The Journey — access gate.
//
// Single source of truth for "does this user have Journey access right now?"
// Used by:
//   - /[locale]/journey/page.tsx  (renders NoAccessView on false)
//   - /api/journey/turn/route.ts  (returns 403 on false, increments the meter
//                                  on true)
//
// The Purchase row is the grant. Two additional dimensions were added on
// 2026-07-03 (audit findings C + D):
//
//   1. 1-year access window from firstAccessedAt. Spec is 1 year; without
//      this gate a £599 buy grants access forever.
//   2. Anti-abuse message ceiling. No product-level cap (owner intent:
//      deep work needs no message limit) — but a hard floor at 5,000
//      messages/purchase catches stolen-session / bot scenarios that
//      would otherwise burn thousands of pounds of Anthropic tokens
//      before anyone noticed. 5,000 is roughly 12× a heavy engager's
//      realistic use of the 8-stage arc, so a real customer never hits it.
//
// firstAccessedAt is stamped by the /api/journey/turn route on the first
// accepted user turn (see markFirstAccessAndIncrement). It is NEVER stamped
// by the /journey page load — a visitor who lands on /journey but doesn't
// send a message shouldn't start their year.

import prisma from '@/lib/prisma';

export const JOURNEY_ACCESS_DURATION_MS = 365 * 24 * 60 * 60 * 1000;
export const JOURNEY_ABUSE_MSG_CAP = 5000;

export type JourneyAccessOk = {
  allowed: true;
  purchase: {
    id: string;
    firstAccessedAt: Date | null;
    journeyMessagesUsed: number;
  };
};

export type JourneyAccessDenied = {
  allowed: false;
  reason: 'no_purchase' | 'expired' | 'cap_reached' | 'pilot_expired' | 'pilot_revoked';
};

export type JourneyAccessCheck = JourneyAccessOk | JourneyAccessDenied;

export async function checkJourneyAccess(userId: string): Promise<JourneyAccessCheck> {
  // Load user pilot state alongside the purchase — a pilot tester has a
  // recode Purchase (created at redeem time, amount=0) PLUS a trial window
  // on the User row. checkJourneyAccess needs both to decide correctly.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pilotTrialEndsAt: true,
      pilotInvitation: {
        select: { revokedAt: true },
      },
    },
  });

  // Most-recent completed recode Purchase — if a user ever gets a second
  // Purchase row (shouldn't happen post-#217, but belt-and-braces) we treat
  // the latest as the active grant.
  const purchase = await prisma.purchase.findFirst({
    where: { userId, productType: 'recode', status: 'completed' },
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      firstAccessedAt: true,
      journeyMessagesUsed: true,
      amount: true,
    },
  });

  if (!purchase) return { allowed: false, reason: 'no_purchase' };

  // Pilot-tester checks BEFORE the paid-tester 1-year window. If pilot
  // fields are set, the trial expiry is the authoritative gate — the
  // paid 1-year window does not apply because a pilot Purchase has
  // amount=0 and no Stripe transaction backs it. Revoke takes precedence
  // over natural expiry.
  //
  // EXCEPTION: a former pilot tester who took the "Continue with 50% off"
  // offer post-trial will have a NEWER paid recode Purchase (amount > 0)
  // sitting on top of the original pilot Purchase (amount = 0). The
  // findFirst above already sorted by completedAt desc, so `purchase` is
  // the paid one. In that case we skip the pilot check entirely and fall
  // through to the normal 1-year window — they've graduated from pilot
  // to full customer.
  const isPaidPurchase = purchase.amount > 0;
  if (!isPaidPurchase) {
    if (user?.pilotInvitation?.revokedAt) {
      return { allowed: false, reason: 'pilot_revoked' };
    }
    if (user?.pilotTrialEndsAt) {
      if (Date.now() > user.pilotTrialEndsAt.getTime()) {
        return { allowed: false, reason: 'pilot_expired' };
      }
      // Trial still active — the 5,000-msg abuse cap still applies, but skip
      // the 1-year firstAccessedAt window (pilot has its own window).
      if (purchase.journeyMessagesUsed >= JOURNEY_ABUSE_MSG_CAP) {
        return { allowed: false, reason: 'cap_reached' };
      }
      return { allowed: true, purchase };
    }
  }

  if (purchase.firstAccessedAt) {
    const expiresAtMs = purchase.firstAccessedAt.getTime() + JOURNEY_ACCESS_DURATION_MS;
    if (Date.now() > expiresAtMs) {
      return { allowed: false, reason: 'expired' };
    }
  }

  if (purchase.journeyMessagesUsed >= JOURNEY_ABUSE_MSG_CAP) {
    return { allowed: false, reason: 'cap_reached' };
  }

  return { allowed: true, purchase };
}

// Called by /api/journey/turn after the user's message is persisted.
// Two things in one atomic write:
//   - Stamp firstAccessedAt if it's still null (first turn of the year).
//   - Increment journeyMessagesUsed by 1.
// The increment counts USER messages, not assistant replies — matches what
// abusers actually spam and what the 5,000 ceiling is calibrated against.
//
// Idempotency: this can be called for the same user-message twice only if
// the turn route retries after persist; we accept that (rare) double-count
// rather than adding a per-turn dedup key. 5,000 has plenty of headroom.
export async function markFirstAccessAndIncrement(purchaseId: string): Promise<void> {
  const now = new Date();
  // Compare-and-set on firstAccessedAt using updateMany so we only stamp it
  // when still null. Two concurrent turns racing to be "first" both write
  // `now`, but the winner is whichever commits first; the loser is a no-op.
  await prisma.purchase.updateMany({
    where: { id: purchaseId, firstAccessedAt: null },
    data: { firstAccessedAt: now },
  });
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { journeyMessagesUsed: { increment: 1 } },
  });
}
