// State module access gate.
//
// A user has access to a state module iff they have ANY completed Purchase
// row with:
//   - productType = 'state_module'
//   - productId = <moduleId>
//   - status = 'completed'
//   - accessExpiresAt > now
//
// Multiple overlapping purchases are additive — user gets access whenever
// the LATEST accessExpiresAt is in the future. A user who re-purchases
// during an active window effectively extends their access (we take the
// latest completedAt + 30 days on the fresh row; the code doesn't merge
// rows, but the access gate uses `max` and it works out).

import prisma from '@/lib/prisma';
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
