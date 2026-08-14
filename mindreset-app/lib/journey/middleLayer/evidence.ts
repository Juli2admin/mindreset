// Middle Layer PR 4b (2026-08-13) — code-owned evidence exchanges.
//
// This module is the ONLY writer of JourneyEvidenceExchange. Everything it
// stamps is a fact code observed; everything the model sent is a claim.
//
// The lifecycle is the one already proven in this codebase for symbolic
// release (lib/journey/state/save.ts:394-490, journey-master.md:197):
//
//     turn N     the clinician OFFERS a proposition   → offeredAt
//     turn N+k   the user answers it                  → confirmedAt
//                                                     or contradictedAt
//
// A confirmation can never land on the same turn as its offer. That rule is
// the whole reason any of this is trustworthy: the model authors its state
// report after its own reply, so it can say anything about the present, but
// it cannot manufacture the user's next turn.
//
// Routing an outcome to its offer is by exact subject match — the only
// cross-turn matcher this repository has (parts, foreign files, images and
// patterns all use it). Owner decision 4 forbids wording being load-bearing
// for LICENSING, and this is not that: a failed match withholds credit and
// nothing else. Rewording can lose you evidence; it can never gain you any.
// Contradictions are exempt even from that risk — see recordContradiction.

import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encrypt';
import type { StateReport } from '../stateReport/schema';

export const EVIDENCE_KINDS = ['mechanism', 'instance', 'recognition'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** One exchange, decrypted, as the pure validator sees it. */
export type EvidenceExchange = {
  kind: EvidenceKind;
  /** Decrypted subject. Routing only — never a licensing input. */
  subject: string;
  offeredAt: Date | null;
  confirmedAt: Date | null;
  contradictedAt: Date | null;
};

/** Everything the sufficiency validator needs, already decrypted. */
export type EvidenceSet = {
  exchanges: EvidenceExchange[];
};

export const EMPTY_EVIDENCE: EvidenceSet = { exchanges: [] };

type Row = {
  id: string;
  kind: string;
  subjectEncrypted: string;
  offeredAt: Date | null;
  confirmedAt: Date | null;
  contradictedAt: Date | null;
};

function decodeRow(row: Row): EvidenceExchange | null {
  if (!(EVIDENCE_KINDS as readonly string[]).includes(row.kind)) return null;
  try {
    return {
      kind: row.kind as EvidenceKind,
      subject: decrypt(row.subjectEncrypted),
      offeredAt: row.offeredAt,
      confirmedAt: row.confirmedAt,
      contradictedAt: row.contradictedAt,
    };
  } catch {
    // Undecryptable row — drop it. Missing evidence fails closed, which is
    // the safe direction; a row we cannot read must never license anything.
    return null;
  }
}

export async function loadEvidence(userId: string): Promise<EvidenceSet> {
  const rows = await prisma.journeyEvidenceExchange.findMany({
    where: { userId },
    select: {
      id: true,
      kind: true,
      subjectEncrypted: true,
      offeredAt: true,
      confirmedAt: true,
      contradictedAt: true,
    },
  });
  const exchanges: EvidenceExchange[] = [];
  for (const row of rows) {
    const decoded = decodeRow(row);
    if (decoded) exchanges.push(decoded);
  }
  return { exchanges };
}

/**
 * Find a standing offer awaiting an answer: offered, not yet answered, and
 * NOT offered during this same call.
 */
async function findStandingOffer(
  userId: string,
  kind: EvidenceKind,
  subject: string,
  offeredThisCall: ReadonlySet<string>,
): Promise<string | null> {
  if (offeredThisCall.has(`${kind}:${subject}`)) return null; // same-turn guard
  const rows = await prisma.journeyEvidenceExchange.findMany({
    where: { userId, kind, offeredAt: { not: null }, confirmedAt: null, contradictedAt: null },
    select: { id: true, subjectEncrypted: true },
  });
  for (const row of rows) {
    try {
      if (decrypt(row.subjectEncrypted) === subject) return row.id;
    } catch {
      // ignore undecryptable rows when routing
    }
  }
  return null;
}

async function recordOffer(
  userId: string,
  kind: EvidenceKind,
  subject: string,
  now: Date,
): Promise<void> {
  await prisma.journeyEvidenceExchange.create({
    data: { userId, kind, subjectEncrypted: encrypt(subject), offeredAt: now },
  });
}

async function recordConfirmation(
  userId: string,
  kind: EvidenceKind,
  subject: string,
  now: Date,
  offeredThisCall: ReadonlySet<string>,
): Promise<void> {
  const id = await findStandingOffer(userId, kind, subject, offeredThisCall);
  // No standing offer from an earlier turn → the confirmation is a NO-OP.
  // Same-turn offer+confirm, or a confirmation of something never put to the
  // user, must never become evidence.
  if (!id) return;
  await prisma.journeyEvidenceExchange.update({
    where: { id },
    data: { confirmedAt: now },
  });
}

/**
 * A contradiction is the one outcome that must never be lost.
 *
 * If it routes to a standing or already-confirmed offer, it stamps that row
 * and clears any confirmation. If it routes to nothing — because the model
 * reworded the subject, or contradicted something it never formally offered
 * — a row is created anyway. Refusing to record a user's contradiction
 * because our string matching failed would be exactly the failure the whole
 * gate exists to prevent.
 */
async function recordContradiction(
  userId: string,
  kind: EvidenceKind,
  subject: string,
  now: Date,
): Promise<void> {
  const rows = await prisma.journeyEvidenceExchange.findMany({
    where: { userId, kind, contradictedAt: null },
    select: { id: true, subjectEncrypted: true },
  });
  for (const row of rows) {
    try {
      if (decrypt(row.subjectEncrypted) === subject) {
        await prisma.journeyEvidenceExchange.update({
          where: { id: row.id },
          data: { contradictedAt: now, confirmedAt: null },
        });
        return;
      }
    } catch {
      // ignore undecryptable rows when routing
    }
  }
  await prisma.journeyEvidenceExchange.create({
    data: {
      userId,
      kind,
      subjectEncrypted: encrypt(subject),
      offeredAt: null,
      contradictedAt: now,
    },
  });
}

/**
 * Apply this turn's evidence emissions. Offers are written first so the
 * same-turn guard can see them; confirmations run next; contradictions last,
 * so a contradiction in the same report always wins over a confirmation of
 * the same material.
 */
export async function applyEvidenceExchanges(
  userId: string,
  report: StateReport,
): Promise<void> {
  const now = new Date();
  const offeredThisCall = new Set<string>();

  const offers: Array<[EvidenceKind, string | undefined]> = [
    ['mechanism', report.mechanismOffered?.reading],
    ['instance', report.instanceOffered?.instance],
    ['recognition', report.recognitionOffered?.recognition],
  ];
  for (const [kind, subject] of offers) {
    if (!subject) continue;
    offeredThisCall.add(`${kind}:${subject}`);
    await recordOffer(userId, kind, subject, now);
  }

  const confirmations: Array<[EvidenceKind, string | undefined]> = [
    ['mechanism', report.mechanismConfirmed?.reading],
    ['instance', report.instanceConfirmed?.instance],
    ['recognition', report.recognitionConfirmed?.recognition],
  ];
  for (const [kind, subject] of confirmations) {
    if (!subject) continue;
    await recordConfirmation(userId, kind, subject, now, offeredThisCall);
  }

  const contradictions: Array<[EvidenceKind, string | undefined]> = [
    ['mechanism', report.mechanismContradicted?.reading],
    ['recognition', report.recognitionContradicted?.recognition],
  ];
  for (const [kind, subject] of contradictions) {
    if (!subject) continue;
    await recordContradiction(userId, kind, subject, now);
  }
}
