// Idempotent pilot-tester grants. Called from both the Clerk `user.created`
// webhook and the `/home` defensive upsert so grants converge on the same
// state regardless of which User-creation path fires first.
//
// What this does:
//   - Journey: creates a completed `recode` Purchase row (amount 0, GBP)
//     if none exists. That opens `/journey` immediately.
//   - MiniMind: sets `currentTier: 'extended'` and a 30-day cycle window
//     if the user isn't already on Extended. Real testers can send the
//     full 800–1,200 msg/cycle without hitting a paywall.
//
// What this does NOT do:
//   - Involve Stripe. No customer, no session, no charge.
//   - Extend the 1-year Journey access window (that's set by the schema
//     defaults + stamped on `firstAccessedAt` on the first turn — same
//     as a paying user).
//   - Re-run grants if they're already in place. Both queries are
//     shortcut-guarded so re-invocations are cheap no-ops.
//
// Safety:
//   - Failures are caught and logged by the caller (callers use
//     waitUntil-with-catch); the /home page renders regardless.
//   - The upstream double-buy guard in /api/checkout/create (#217) means
//     a tester who later tries to buy Journey gets a 409, not a
//     double-charge.

import prisma from '@/lib/prisma';
import { isPilotTester } from './testers';

const EXTENDED_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

export async function ensurePilotGrants(
  userId: string,
  email: string | null,
): Promise<void> {
  const isTester = isPilotTester(email);
  // Loud log so Vercel search surfaces every grant attempt. Distinguishes
  // "grant path never fired for this user" from "grant path fired but
  // Prisma write silently failed" during pilot-tester debugging.
  console.log('[pilot-grants] check', {
    userId,
    emailLower: email ? email.trim().toLowerCase() : null,
    isTester,
  });
  if (!isTester) return;

  // 1. Journey Purchase (idempotent by existing-row check)
  const existingRecode = await prisma.purchase.findFirst({
    where: { userId, productType: 'recode', status: 'completed' },
    select: { id: true },
  });
  if (!existingRecode) {
    console.log('[pilot-grants] creating Journey Purchase', { userId });
    await prisma.purchase.create({
      data: {
        userId,
        productType: 'recode',
        amount: 0,
        currency: 'GBP',
        status: 'completed',
        completedAt: new Date(),
      },
    });
  } else {
    console.log('[pilot-grants] Journey Purchase already exists', {
      userId,
      purchaseId: existingRecode.id,
    });
  }

  // 2. MiniMind Extended tier (idempotent by tier check)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentTier: true },
  });
  if (user && user.currentTier !== 'extended') {
    console.log('[pilot-grants] upgrading tier to extended', {
      userId,
      priorTier: user.currentTier,
    });
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentTier: 'extended',
        cycleResetAt: new Date(Date.now() + EXTENDED_CYCLE_MS),
        messagesUsedThisCycle: 0,
      },
    });
  }
}
