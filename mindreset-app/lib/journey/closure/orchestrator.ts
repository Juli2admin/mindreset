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
  decideClosureOutcome,
  recordCapturedScore,
  resolveClosureProcessForTurn,
  transitionClosureProcess,
  type ClosureProcess,
  type ProcessResolution,
} from './process';
import { detectExitIntent } from './exit-intent';
import { captureStabilityScore } from './score-capture';
import { getStabilityQuestionForLocale } from './stability-question';
import {
  currentSessionTurns,
  findDestabilisation,
  STABILITY_CLOSE_THRESHOLD,
  type ClosureTurn,
} from './guard';

/**
 * The typed orchestration decision.
 *
 *   proceed — run the ordinary model turn.
 *   deliver — SHORT-CIRCUIT: send this code-authored text and do NOT call the
 *             model at all this turn.
 *
 * `deliver` is the whole point of the hook's position. The reply streams at
 * route.ts controller.enqueue, which is the irreversibility point — nothing
 * downstream can prevent a user-visible goodbye. So while the process is
 * awaiting a required measurement, the clinician must not be given the
 * opportunity to produce one. Enforcement is a short-circuit before prompt
 * assembly, never a hint in the prompt.
 */
export type ClosureOrchestrationDecision =
  | {
      kind: 'proceed';
      /** Authoritative process record for the remainder of this turn. */
      process: ClosureProcess;
      /** Non-null when the resolver moved the process this turn. */
      resolved: ProcessResolution['reason'];
    }
  | {
      kind: 'deliver';
      process: ClosureProcess;
      resolved: ProcessResolution['reason'];
      /** Code-authored user-visible text. Replaces the model turn entirely. */
      text: string;
      /** Why this step was delivered, for logs and audit. */
      step: 'stability_question' | 'stability_question_reask';
    };

export type ClosureOrchestrationInput = {
  current: ClosureProcess;
  /** This turn's raw user message — exit intent and score capture read it. */
  userMessage: string;
  locale: string | null;
  /**
   * Lazily loads recent audit turns. Called ONLY when an explicit session exit
   * has been detected and the process is idle, so ordinary turns pay nothing.
   */
  loadSessionTurns: () => Promise<ClosureTurn[]>;
  now: Date;
};

/**
 * Pure half of the automatic transitions — unchanged from Phase 1.
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
 * Measurement-first entry decision. Pure.
 *
 * Historical destabilisation answers ONE question — "does this close require a
 * current stability measurement?" — and nothing else. It does NOT say the user
 * is activated now; only the user's own current score says that, which is why
 * no route is chosen here.
 *
 * Owner decision 2026-08-08. Uses the methodology's own trigger
 * (journey-master.md:340, "DESTABILISED in this session at any point") via the
 * predicate the closure guard already implements. Note the guard's own limit,
 * unchanged: it evaluates the structured signals (intensity, safetyFlag); the
 * prose markers in :340 live in the user's words and remain the clinician's.
 */
export function measurementRequired(
  sessionTurns: ClosureTurn[],
  now: Date,
): boolean {
  const scoped = currentSessionTurns(sessionTurns, now.getTime());
  return findDestabilisation(scoped, null, null, now) !== null;
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
  input: ClosureOrchestrationInput,
): Promise<ClosureOrchestrationDecision> {
  const { current, userMessage, locale, loadSessionTurns, now } = input;

  // 1. Automatic, non-clinical transitions first (Phase 1, unchanged).
  const { decision, resolution } = decideClosureOrchestration(current, now);
  let process = resolution.process;
  // `resolved` must never claim a transition the store refused — same rule as
  // `process`. A failed write reports "nothing happened", not "we tried".
  let resolved = resolution.reason;
  if (resolution.changed) {
    const written = await persistProcess(
      userId,
      current,
      resolution.process,
      resolution.reason,
    );
    process = written.process;
    if (!written.persisted) resolved = null;
  }

  // 2. Awaiting the required measurement: read the user's own number.
  if (process.state === 'AWAITING_INITIAL_SCORE') {
    const captured = captureStabilityScore(userMessage);

    if (!captured.found) {
      // No usable number this turn. The methodology is explicit that the close
      // does not proceed without one, so the question is asked again rather
      // than handing the turn back to the clinician — which is precisely how
      // the 2026-08-08 session ended with no measurement at all.
      //
      // ⚠️ Q5 (repeated non-answer / refusal) is an UNRESOLVED CLINICAL
      // QUESTION. Code does the mechanically safe thing and nothing more; it
      // invents no refusal handling. The existing 4-hour interrupted-process
      // rule remains the escape hatch.
      return {
        kind: 'deliver',
        process,
        resolved,
        text: getStabilityQuestionForLocale(locale),
        step: 'stability_question_reask',
      };
    }

    const recorded = recordCapturedScore(process, captured.score, now);
    if (recorded.ok) {
      process = (await persistProcess(userId, process, recorded.process, null)).process;
    }

    // 3. The user's current score decides the route — not the history.
    const outcome = decideClosureOutcome({
      postScore: captured.score,
      roundsDelivered: process.roundCount,
      threshold: STABILITY_CLOSE_THRESHOLD,
    });
    const route =
      outcome.outcome === 'DELIVERING_STABILISATION' ? 'ACTIVATED_CLOSE' : 'NORMAL_CLOSE';
    const moved = transitionClosureProcess(process, outcome.outcome, { now, route });
    if (moved.ok) {
      process = (await persistProcess(userId, process, moved.process, outcome.reason)).process;
    }

    // Everything downstream of the measurement is clinical CONTENT —
    // stabilisation, psychoeducation, aftercare, the closing words — and stays
    // model-authored, deliberately out of Phase 2's scope. The measurement now
    // exists, so the clinician takes the turn with the record already correct.
    return { kind: 'proceed', process, resolved };
  }

  // 4. Idle: does this turn ask to end the session, and does that close need a
  //    measurement first?
  if (process.state === 'NONE') {
    const exit = detectExitIntent(userMessage);
    if (exit.intent !== 'session_exit') {
      return { kind: 'proceed', process, resolved };
    }

    let sessionTurns: ClosureTurn[];
    try {
      sessionTurns = await loadSessionTurns();
    } catch (err) {
      // Fail-safe: history unknown is not "never destabilised". Take no
      // process action and let the turn proceed, matching the guard's own
      // posture on unreadable history.
      console.error('[journey/closure-process] session history unavailable', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { kind: 'proceed', process, resolved };
    }

    if (!measurementRequired(sessionTurns, now)) {
      // Ordinary close. No process entry at all — NORMAL_CLOSE needs no
      // process, which is already how production behaves.
      return { kind: 'proceed', process, resolved };
    }

    // A measurement IS required. Enter WITHOUT a route: which route this turns
    // out to be is the score's answer, not history's.
    const entered = transitionClosureProcess(process, 'AWAITING_INITIAL_SCORE', { now });
    if (!entered.ok) {
      return { kind: 'proceed', process, resolved };
    }
    process = (await persistProcess(userId, process, entered.process, 'measurement_required')).process;

    return {
        kind: 'deliver',
        process,
        resolved,
      text: getStabilityQuestionForLocale(locale),
      step: 'stability_question',
    };
  }

  return { kind: 'proceed', process, resolved };
}

/**
 * Persist a process record. Returns what the store actually holds.
 *
 * Fail-safe on write error: return the record as it still stands in the
 * database rather than an in-memory value the database does not hold. The
 * process state is server-owned; memory must never claim a transition the
 * store refused. Never throws — a failure here must not cost the user a turn.
 */
async function persistProcess(
  userId: string,
  from: ClosureProcess,
  next: ClosureProcess,
  reason: string | null,
): Promise<{ process: ClosureProcess; persisted: boolean }> {
  const current = from;
  const resolution = { process: next, reason };
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
        // Phase 2: the payload must carry EVERY ClosureProcess field, or a
        // resolution that changes a score (entry clears them) would be lost
        // on write while memory believed it persisted.
        closureInitialScore: resolution.process.initialScore,
        closureInitialScoreAt: resolution.process.initialScoreAt,
        closurePostScore: resolution.process.postScore,
        closurePostScoreAt: resolution.process.postScoreAt,
      },
    });
    console.info('[journey/closure-process] transition', {
      userId,
      from: current.state,
      to: resolution.process.state,
      reason: resolution.reason,
    });
    return { process: resolution.process, persisted: true };
  } catch (err) {
    console.error('[journey/closure-process] persist failed; keeping stored state', {
      userId,
      from: current.state,
      to: resolution.process.state,
      error: err instanceof Error ? err.message : String(err),
    });
    return { process: current, persisted: false };
  }
}
