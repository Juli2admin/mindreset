// Theme module access gate.
//
// PR χ1 (2026-07-13). Mirror of lib/states/access.ts but keyed to
// productType='theme_module'.
//
// A user has access to a theme if EITHER:
//   1. They are an active pilot tester (pilot access grants all modules
//      for the duration of the trial window). Introduced 2026-07-17
//      alongside the same short-circuit on States.
//   2. They have any completed Purchase row with:
//       - productType = 'theme_module'
//       - productId = <moduleId>
//       - status = 'completed'
//       - accessExpiresAt > now
//
// Re-purchase extends access — the gate takes the max accessExpiresAt
// across all completed rows for that (user, theme) pair.

import prisma from '@/lib/prisma';
import { checkActivePilot } from '@/lib/pilot/access';
import { isValidThemeModuleId } from './modules';

export type ThemeAccessCheck =
  | { allowed: true; expiresAt: Date }
  | { allowed: false; reason: 'not_purchased' | 'expired' | 'invalid_module' };

export async function checkThemeModuleAccess(
  userId: string,
  moduleId: string,
): Promise<ThemeAccessCheck> {
  if (!isValidThemeModuleId(moduleId)) {
    return { allowed: false, reason: 'invalid_module' };
  }

  const pilot = await checkActivePilot(userId);
  if (pilot.active) {
    return { allowed: true, expiresAt: pilot.trialEndsAt };
  }

  const latest = await prisma.purchase.findFirst({
    where: {
      userId,
      productType: 'theme_module',
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
