// Freeze / clear helpers for the Journey Red Flag protocol.
//
// "Frozen-for-review" is the held state per Shared Core §7. While frozen:
//   - Every turn endpoint call returns the canned crisis response, no LLM.
//   - No method work happens.
//   - The journey's persistent landscape (anchor, parts, etc.) is preserved.
//
// Clearing a freeze is a deliberate human action. For phase 1, the human is
// Julia and the action is a manual SQL update in Supabase (see
// docs/operations/journey-safety-runbook.md). A reviewer UI is phase 2.

import prisma from '@/lib/prisma';
import type { RedFlagType } from './keywords';

export type FreezeSource = 'keyword_scan' | 'verifier' | 'state_report';

export type FreezeArgs = {
  userId: string;
  source: FreezeSource;
  redFlagType?: RedFlagType | null;
  reasoning?: string;
};

/**
 * Set frozen-for-review on a user's RecodeProgress. Idempotent — if already
 * frozen, the original freezeAt / freezeReason are preserved; the new freeze
 * is logged as an additional Sentry breadcrumb only.
 */
export async function freezeJourney(args: FreezeArgs): Promise<void> {
  const reason = composeReason(args.source, args.redFlagType, args.reasoning);

  // Read current state first so we don't overwrite an existing freeze.
  const current = await prisma.recodeProgress.findUnique({
    where: { userId: args.userId },
    select: { frozenForReview: true },
  });
  if (!current) return; // user has no Journey row — nothing to freeze

  if (current.frozenForReview) {
    // Already frozen — record the new signal in console but don't overwrite.
    console.warn('[journey/freeze] already frozen, additional signal:', {
      userId: args.userId,
      reason,
    });
    return;
  }

  await prisma.recodeProgress.update({
    where: { userId: args.userId },
    data: {
      frozenForReview: true,
      frozenAt: new Date(),
      frozenReason: reason,
    },
  });

  console.warn('[journey/freeze] FROZEN', { userId: args.userId, reason });
}

function composeReason(
  source: FreezeSource,
  redFlagType: RedFlagType | null | undefined,
  reasoning: string | undefined,
): string {
  const parts: string[] = [`source:${source}`];
  if (redFlagType) parts.push(`type:${redFlagType}`);
  if (reasoning && reasoning.length > 0) {
    // Sanitise + cap the free-text reasoning for the stored field.
    const safe = reasoning.replace(/[\r\n]+/g, ' ').slice(0, 300);
    parts.push(`r:${safe}`);
  }
  return parts.join(' | ');
}

/**
 * Clear a user's freeze. NOT exposed to any API surface — meant for manual
 * use by a clinical reviewer via the Supabase SQL editor or an admin route.
 * Included here as a code-side helper so the admin runbook can document the
 * one canonical way of clearing.
 */
export async function clearFreezeForReview(userId: string): Promise<boolean> {
  const r = await prisma.recodeProgress.updateMany({
    where: { userId, frozenForReview: true },
    data: { frozenForReview: false, frozenAt: null, frozenReason: null },
  });
  return r.count > 0;
}
