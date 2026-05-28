// GDPR account-deletion helpers.
//
// Flow:
//   1. User clicks "Delete account" → POST /api/account/delete-request
//      → createDeletionToken() → email with confirm link
//   2. User clicks email link → GET /api/account/confirm-delete?token=...
//      → consumeDeletionToken() → scheduleDeletion()
//   3. Daily cron hard-deletes when deletionScheduledAt < now()
//
// Grace window = max(now + 30 days, current subscription period end). For
// paid users this means they keep access until the period they paid for
// is over, then 30 days minimum on top.
//
// Token security: only the SHA-256 hash is stored. The raw 32-byte token
// lives in the email URL only. Single-use (consumedAt) and 1-hour expiry.

import { createHash, randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

export const GRACE_PERIOD_DAYS = 30;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// Creates a deletion-confirmation token. Returns the raw token (for the
// email URL); the DB stores only the hash so a leaked DB row can't be
// used to confirm someone else's deletion.
export async function createDeletionToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.accountDeletionToken.create({
    data: { userId, tokenHash, expiresAt },
  });
  return rawToken;
}

// Looks up + consumes (marks consumedAt) a deletion token. Returns the
// userId if the token is valid, null otherwise. Single-use: a consumed
// token cannot be re-used.
export async function consumeDeletionToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.accountDeletionToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  });
  if (!token) return null;
  if (token.consumedAt) return null;
  if (token.expiresAt < new Date()) return null;

  await prisma.accountDeletionToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  });
  return token.userId;
}

// Computes the hard-deletion date: max(now + GRACE_PERIOD_DAYS, subscriptionEndsAt).
// Paid users keep access until the period they paid for ends, plus the 30-day
// grace minimum on top.
export function computeScheduledDeletionDate(subscriptionEndsAt: Date | null): Date {
  const graceEnd = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  if (!subscriptionEndsAt) return graceEnd;
  return subscriptionEndsAt > graceEnd ? subscriptionEndsAt : graceEnd;
}
