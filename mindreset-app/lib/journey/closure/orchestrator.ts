// Activated Closure — pre-LLM orchestration hook. Phase 1 (2026-08-05).
//
// Structural only. This hook exists so that later protocol phases can be
// implemented HERE instead of by adding another branch to the turn route
// every time the clinical sequence grows.
//
// What Phase 1 does:
//   * reads the persisted, server-owned closure process state;
//   * applies the two automatic non-clinical transitions (interrupted-process
//     expiry, CLOSED re-arm) via the central transition model;
//   * persists the result when it changed;
//   * returns a typed decision.
//
// What Phase 1 deliberately does NOT do:
//   * enter Activated Closure (nothing sets a state other than NONE yet);
//   * detect exit or pause intent;
//   * emit or alter any user-visible response;
//   * short-circuit into a canned response;
//   * touch the clinician prompt or prompt assembly.
//
// Consequence: on production data every process is NONE, so the resolver
// reports "unchanged", no write is issued, and the turn proceeds exactly as
// it did before this hook existed.
//
// Placement mirrors the established frozenForReview pre-LLM control pattern:
// persisted flag → read before the model call → typed decision. The freeze
// path short-circuits; this one does not, yet.

import prisma from '@/lib/prisma';
import {
  resolveClosureProcessForTurn,
  type ClosureProcess,
  type ProcessResolution,
} from './process';

/**
 * The typed orchestration decision. Phase 1 has exactly one variant: proceed
 * with the ordinary model turn. Later phases add variants here (deliver a
 * code-authored step, await a score, escalate) — call sites switch on `kind`
 * so adding one is a compile-time-visible change rather than a new branch in
 * the route handler.
 */
export type ClosureOrchestrationDecision = {
  kind: 'proceed';
  /** Authoritative process record for the remainder of this turn. */
  process: ClosureProcess;
  /** Non-null when the resolver moved the process this turn. */
  resolved: ProcessResolution['reason'];
};

/**
 * Pure half — decide, given the persisted record and a server clock.
 * Exported for tests; the route calls runClosureOrchestration.
 */
export function decideClosureOrchestration(
  current: ClosureProcess,
  now: Date,
): { decision: ClosureOrchestrationDecision; resolution: ProcessResolution } {
  const resolution = resolveClosureProcessForTurn(current, now);
  return {
    decision: {
      kind: 'proceed',
      process: resolution.process,
      resolved: resolution.reason,
    },
    resolution,
  };
}

/**
 * Impure half — persist the resolved record when it changed.
 *
 * Fail-safe on write error: return the record as it still stands in the
 * database rather than an in-memory value the database does not hold. The
 * process state is server-owned; memory must never claim a transition the
 * store refused. Never throws — a failure here must not cost the user a turn.
 */
export async function runClosureOrchestration(
  userId: string,
  current: ClosureProcess,
  now: Date = new Date(),
): Promise<ClosureOrchestrationDecision> {
  const { decision, resolution } = decideClosureOrchestration(current, now);
  if (!resolution.changed) return decision;

  try {
    await prisma.recodeProgress.update({
      where: { userId },
      data: {
        closureProcessState: resolution.process.state,
        closureRoute: resolution.process.route,
        closureEnteredAt: resolution.process.enteredAt,
        closureTransitionedAt: resolution.process.transitionedAt,
        closureRoundCount: resolution.process.roundCount,
        closureCompletedAt: resolution.process.completedAt,
        closureIncompleteAt: resolution.process.incompleteAt,
        closureFreezeInterruptedAt: resolution.process.freezeInterruptedAt,
      },
    });
    console.info('[journey/closure-process] transition', {
      userId,
      from: current.state,
      to: resolution.process.state,
      reason: resolution.reason,
    });
    return decision;
  } catch (err) {
    console.error('[journey/closure-process] persist failed; keeping stored state', {
      userId,
      from: current.state,
      to: resolution.process.state,
      error: err instanceof Error ? err.message : String(err),
    });
    return { kind: 'proceed', process: current, resolved: null };
  }
}
