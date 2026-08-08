// The ONE place a ClosureProcess is written to the database.
//
// WHY THIS MODULE EXISTS.
// The full twelve-column payload used to be spelled out by hand in two
// unrelated writers — the orchestrator's pre-LLM persist and the route's
// post-stabilisation advance. That is a silent data-loss shape: a new
// ClosureProcess field added to one writer and missed in the other would be
// dropped on write while memory believed it persisted. The orchestrator's own
// comment warned about exactly that, but the warning could only bind the file
// it was written in.
//
// The field-to-column mapping below is now the single definition, and
// `satisfies Record<keyof ClosureProcess, ...>` makes an omission a COMPILE
// ERROR rather than a runtime surprise: add a field to ClosureProcess and this
// object stops type-checking until the column is named here.
//
// LAYERING. process.ts stays pure — it is the state-transition model and must
// remain testable and importable without a database. This module is the thin
// persistence layer beneath it: it imports process.ts, never the reverse, and
// both callers (orchestrator.ts, route.ts) depend on it.

import type { Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';
import type { ClosureProcess } from './process';

/**
 * Field-to-column mapping. The single source of truth for what gets written.
 *
 * `satisfies` checks BOTH directions at compile time:
 *   - every key of ClosureProcess must appear (no field can be forgotten);
 *   - every value must be a real RecodeProgress column (no typo can survive).
 */
const CLOSURE_COLUMNS = {
  state: 'closureProcessState',
  route: 'closureRoute',
  enteredAt: 'closureEnteredAt',
  transitionedAt: 'closureTransitionedAt',
  roundCount: 'closureRoundCount',
  completedAt: 'closureCompletedAt',
  incompleteAt: 'closureIncompleteAt',
  initialScore: 'closureInitialScore',
  initialScoreAt: 'closureInitialScoreAt',
  postScore: 'closurePostScore',
  postScoreAt: 'closurePostScoreAt',
  freezeInterruptedAt: 'closureFreezeInterruptedAt',
} as const satisfies Record<
  keyof ClosureProcess,
  keyof Prisma.RecodeProgressUncheckedUpdateInput
>;

/** The columns this module owns. Nothing outside the map can be written. */
export type ClosureColumn = (typeof CLOSURE_COLUMNS)[keyof typeof CLOSURE_COLUMNS];

export type ClosureProcessWriteData = Pick<
  Prisma.RecodeProgressUncheckedUpdateInput,
  ClosureColumn
>;

/**
 * Build the update payload for a ClosureProcess. Pure — exported so tests can
 * assert the payload covers every field without touching a database.
 *
 * Derived from CLOSURE_COLUMNS rather than written out, so there is exactly one
 * list of fields in the codebase.
 */
export function closureProcessWriteData(
  process: ClosureProcess,
): ClosureProcessWriteData {
  const data: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(CLOSURE_COLUMNS)) {
    data[column] = process[field as keyof ClosureProcess];
  }
  // Safe by construction: the keys come from CLOSURE_COLUMNS, whose values are
  // constrained to real column names by the `satisfies` clause above, and the
  // values come from ClosureProcess, whose types match those columns.
  return data as ClosureProcessWriteData;
}

/** Every ClosureProcess field name, in write order. Exported for tests. */
export const CLOSURE_PROCESS_FIELDS = Object.keys(CLOSURE_COLUMNS) as Array<
  keyof ClosureProcess
>;

export type ClosurePersistResult = {
  /** What the store actually holds now. */
  process: ClosureProcess;
  persisted: boolean;
};

/**
 * Persist a ClosureProcess. Returns what the store actually holds.
 *
 * FAIL-SAFE ON WRITE ERROR, unchanged from the original orchestrator
 * behaviour: return the record as it still stands in the database rather than
 * an in-memory value the database does not hold. The process state is
 * server-owned; memory must never claim a transition the store refused. Never
 * throws — a failure here must not cost the user a turn.
 */
export async function persistClosureProcess(
  userId: string,
  from: ClosureProcess,
  next: ClosureProcess,
  reason: string | null,
): Promise<ClosurePersistResult> {
  try {
    await prisma.recodeProgress.update({
      where: { userId },
      data: closureProcessWriteData(next),
    });
    console.info('[journey/closure-process] transition', {
      userId,
      from: from.state,
      to: next.state,
      reason,
    });
    return { process: next, persisted: true };
  } catch (err) {
    console.error('[journey/closure-process] persist failed; keeping stored state', {
      userId,
      from: from.state,
      to: next.state,
      error: err instanceof Error ? err.message : String(err),
    });
    return { process: from, persisted: false };
  }
}
