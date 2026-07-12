// Pilot invitation lifecycle — create, redeem, revoke, list.
//
// Simple 4-week pilot programme (spec locked 2026-07-12):
//   - Julia creates codes in /admin/pilot
//   - Tester redeems at /redeem/[code]
//   - Trial lasts trialDays (default 30) from redemption
//   - Journey access is fully free during the trial
//   - MiniMind stays on its normal free 50-msg lifetime tier
//   - Post-trial: 50% off via Stripe promo code (env-driven)
//
// One code → one tester (@@unique on redeemedByUserId enforces this).

import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

export const DEFAULT_TRIAL_DAYS = 30;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 confusion
export const CODE_LENGTH = 10;
export const CODE_PREFIX = 'PILOT-';

/**
 * Generate an unambiguous invitation code. Prefix + 10 alphanumeric chars,
 * no vowels or lookalikes so it's safe to speak aloud / hand-write.
 * The uniqueness constraint on PilotInvitation.code makes accidental
 * collisions a 409 at create time — we don't bother pre-checking here.
 */
export function generateInviteCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${CODE_PREFIX}${out}`;
}

export type CreateInvitationInput = {
  createdByEmail: string;
  notes?: string | null;
  trialDays?: number;
  expiresAt?: Date | null;
};

/** Create a fresh invitation. Returns the created row. */
export async function createInvitation(input: CreateInvitationInput) {
  return prisma.pilotInvitation.create({
    data: {
      code: generateInviteCode(),
      createdByEmail: input.createdByEmail,
      notes: input.notes ?? null,
      trialDays: input.trialDays ?? DEFAULT_TRIAL_DAYS,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

/** Bulk create N invitations with the same metadata. */
export async function createInvitationBulk(
  n: number,
  input: CreateInvitationInput,
) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(await createInvitation(input));
  }
  return rows;
}

export type RedeemResult =
  | { ok: true; alreadyRedeemedByThisUser: boolean; trialEndsAt: Date }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'invitation_expired'
        | 'invitation_revoked'
        | 'already_redeemed_by_other'
        | 'user_already_pilot';
    };

/**
 * Redeem an invitation code for the given user. Idempotent — if the same
 * user redeems the same code twice, returns ok:true with
 * alreadyRedeemedByThisUser:true. If a different user tries to redeem
 * an already-claimed code, returns already_redeemed_by_other.
 */
export async function redeemInvitation(
  code: string,
  userId: string,
): Promise<RedeemResult> {
  const invitation = await prisma.pilotInvitation.findUnique({
    where: { code },
  });
  if (!invitation) return { ok: false, reason: 'not_found' };
  if (invitation.revokedAt) return { ok: false, reason: 'invitation_revoked' };
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    return { ok: false, reason: 'invitation_expired' };
  }

  // Idempotent same-user redeem
  if (invitation.redeemedByUserId === userId) {
    return {
      ok: true,
      alreadyRedeemedByThisUser: true,
      trialEndsAt:
        (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { pilotTrialEndsAt: true },
          })
        )?.pilotTrialEndsAt ?? new Date(),
    };
  }

  if (invitation.redeemedByUserId && invitation.redeemedByUserId !== userId) {
    return { ok: false, reason: 'already_redeemed_by_other' };
  }

  // Refuse a user who already has a pilot invitation attached — one pilot
  // per user, so a tester can't stack multiple redemptions to extend their
  // trial. Rare but worth being explicit about.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pilotInvitationId: true },
  });
  if (user?.pilotInvitationId) {
    return { ok: false, reason: 'user_already_pilot' };
  }

  const now = new Date();
  const trialEndsAt = new Date(
    now.getTime() + invitation.trialDays * 24 * 60 * 60 * 1000,
  );

  // All the writes in one transaction:
  //   - stamp the invitation's redeemedAt / redeemedByUserId
  //   - set user's pilotTrialStartedAt / pilotTrialEndsAt / pilotInvitationId
  //   - create a completed Purchase(productType='recode') so the existing
  //     Journey access gate finds a grant. amount=0 marks it as a comp.
  await prisma.$transaction([
    prisma.pilotInvitation.update({
      where: { id: invitation.id },
      data: { redeemedAt: now, redeemedByUserId: userId },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        pilotTrialStartedAt: now,
        pilotTrialEndsAt: trialEndsAt,
        pilotInvitationId: invitation.id,
      },
    }),
    prisma.purchase.create({
      data: {
        userId,
        productType: 'recode',
        amount: 0,
        currency: 'GBP',
        status: 'completed',
        completedAt: now,
      },
    }),
  ]);

  console.log('[pilot] invitation redeemed', {
    userId,
    code: invitation.code,
    trialEndsAt: trialEndsAt.toISOString(),
  });

  return { ok: true, alreadyRedeemedByThisUser: false, trialEndsAt };
}

/**
 * Revoke an invitation (or a redeemed pilot). Sets revokedAt so
 * checkJourneyAccess treats it as expired. Does NOT delete the row —
 * we keep it for the clinical evidence trail.
 */
export async function revokeInvitation(id: string, reason: string) {
  return prisma.pilotInvitation.update({
    where: { id },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

/**
 * Mutate one of Julia's per-invite tracking checkboxes
 * (before form filled, after form filled, 3-month follow-up, quote OK).
 */
export type TrackingFlag =
  | 'beforeFormFilled'
  | 'afterFormFilled'
  | 'followUp3mSent'
  | 'quoteApproved';

export async function setTrackingFlag(
  id: string,
  flag: TrackingFlag,
  value: boolean,
) {
  return prisma.pilotInvitation.update({
    where: { id },
    data: { [flag]: value },
  });
}

export type InvitationStatus =
  | 'pending'
  | 'active'
  | 'expired_invitation'
  | 'expired_trial'
  | 'revoked'
  | 'completed';

/**
 * Derive the status from row state + current time. Used by the admin UI.
 * - pending: no redeemedAt, not expired, not revoked
 * - active: redeemed, trial ongoing
 * - expired_trial: redeemed, pilotTrialEndsAt in the past
 * - expired_invitation: never redeemed, but expiresAt in the past
 * - revoked: revokedAt set
 * - completed: redeemed AND afterFormFilled (Julia's success signal)
 */
export function deriveStatus(row: {
  redeemedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  afterFormFilled: boolean;
  redeemedByUser?: { pilotTrialEndsAt: Date | null } | null;
}): InvitationStatus {
  if (row.revokedAt) return 'revoked';
  if (!row.redeemedAt) {
    if (row.expiresAt && row.expiresAt < new Date()) return 'expired_invitation';
    return 'pending';
  }
  if (row.afterFormFilled) return 'completed';
  const trialEnd = row.redeemedByUser?.pilotTrialEndsAt;
  if (trialEnd && trialEnd < new Date()) return 'expired_trial';
  return 'active';
}
