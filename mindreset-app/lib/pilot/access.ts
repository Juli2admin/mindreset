// Shared "is this user an active pilot tester" check.
//
// Reused by the States and Themes access gates. The Journey gate has its
// own inline pilot check (with additional paid-purchase graduation logic
// that States/Themes don't need) so it doesn't call this — but the
// semantic of "active pilot" is the same across all three gates.
//
// Active pilot = a User row with:
//   - pilotTrialEndsAt set to a future timestamp AND
//   - the linked PilotInvitation is not revoked
//
// When the trial has expired or the invitation has been revoked, this
// returns { active: false, reason } and the calling gate falls through
// to its normal (paid-purchase) access check. That preserves any real
// purchases a former pilot tester made after their pilot ended.

import prisma from '@/lib/prisma';

export type ActivePilotOk = {
  active: true;
  trialEndsAt: Date;
};

export type ActivePilotDenied = {
  active: false;
  reason: 'no_pilot' | 'expired' | 'revoked';
};

export type ActivePilotCheck = ActivePilotOk | ActivePilotDenied;

export async function checkActivePilot(
  userId: string,
): Promise<ActivePilotCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pilotTrialEndsAt: true,
      pilotInvitation: {
        select: { revokedAt: true },
      },
    },
  });

  // Not a pilot tester at all — no `pilotTrialEndsAt` was ever stamped.
  if (!user || !user.pilotTrialEndsAt) {
    return { active: false, reason: 'no_pilot' };
  }

  // Revocation takes precedence over natural expiry — an admin-revoked
  // pilot should read as revoked regardless of whether the trial window
  // had also already elapsed.
  if (user.pilotInvitation?.revokedAt) {
    return { active: false, reason: 'revoked' };
  }

  if (user.pilotTrialEndsAt.getTime() < Date.now()) {
    return { active: false, reason: 'expired' };
  }

  return { active: true, trialEndsAt: user.pilotTrialEndsAt };
}
