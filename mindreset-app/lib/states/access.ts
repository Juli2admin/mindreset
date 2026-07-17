// State module access gate.
//
// A user has access to a state module if EITHER:
//   1. They are an active pilot tester (pilot access grants all modules
//      for the duration of the trial window). Introduced 2026-07-17
//      alongside the same short-circuit on Themes — pilot testers should
//      not be locked out of the full product surface during their trial.
//   2. They have a completed Purchase row with:
//       - productType = 'state_module'
//       - productId = <moduleId>
//       - status = 'completed'
//       - accessExpiresAt > now
//
// Multiple overlapping purchases are additive — user gets access whenever
// the LATEST accessExpiresAt is in the future. A user who re-purchases
// during an active window effectively extends their access (we take the
// latest completedAt + 30 days on the fresh row; the code doesn't merge
// rows, but the access gate uses `max` and it works out).
//
// A former pilot tester whose pilot ended after they made a real
// purchase still keeps that purchase — the pilot short-circuit runs
// FIRST but returns { active: false } when the pilot has expired /
// revoked, and then we fall through to the Purchase check. So a former
// pilot with a paid module keeps it.

import prisma from '@/lib/prisma';
import { checkActivePilot } from '@/lib/pilot/access';
import { isValidStateModuleId } from './modules';

export type StateAccessCheck =
  | { allowed: true; expiresAt: Date }
  | { allowed: false; reason: 'not_purchased' | 'expired' | 'invalid_module' };

export async function checkStateModuleAccess(
  userId: string,
  moduleId: string,
): Promise<StateAccessCheck> {
  if (!isValidStateModuleId(moduleId)) {
    return { allowed: false, reason: 'invalid_module' };
  }

  const pilot = await checkActivePilot(userId);
  if (pilot.active) {
    return { allowed: true, expiresAt: pilot.trialEndsAt };
  }

  const latest = await prisma.purchase.findFirst({
    where: {
      userId,
      productType: 'state_module',
      productId: moduleId,
      status: 'completed',
    },
    orderBy: { accessExpiresAt: 'desc' },
    select: { accessExpiresAt: true },
  });

  if (!latest || !latest.accessExpiresAt) {
    return { allowed: false, reason: 'not_purchased' };
  }
  if (latest.accessExpiresAt.getTime() < Date.now()) {
    return { allowed: false, reason: 'expired' };
  }
  return { allowed: true, expiresAt: latest.accessExpiresAt };
}
