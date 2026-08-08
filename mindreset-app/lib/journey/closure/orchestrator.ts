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
import type { ClosureNoteKind } from './state-notes';
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
    }
  | {
      kind: 'constrain';
      process: ClosureProcess;
      resolved: ProcessResolution['reason'];
      /**
       * Run the ordinary model turn, but with a platform note naming the step
       * the server-owned process is in. For states whose action is CLINICAL
       * and cannot be code-authored. The note asks; where an exit must be
       * earned, structured evidence verifies (stabilisation-evidence.ts).
       */
      note: ClosureNoteKind;
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
  /**
   * Lazily counts the user's messages strictly after `since`. Called ONLY while
   * a score is outstanding. This is how "first non-answer" is told from
   * "second" without a new persisted counter or a schema change.
   */
  countUserMessagesSince: (since: Date) => Promise<number>;
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
  const { current, userMessage, locale, loadSessionTurns, countUserMessagesSince, now } =
    input;

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

  // 2. A stabilisation round is owed. The action is CLINICAL and cannot be
  //    code-authored, so the turn proceeds to the model carrying a platform
  //    note. It does NOT advance here — finaliseTurn advances it only on
  //    structured evidence that a stabilising practice actually completed.
  if (process.state === 'DELIVERING_STABILISATION') {
    return { kind: 'constrain', process, resolved, note: 'stabilisation' };
  }

  // 3. Awaiting a required measurement — the same handler for both scores.
  if (
    process.state === 'AWAITING_INITIAL_SCORE' ||
    process.state === 'AWAITING_POST_SCORE'
  ) {
    // How many times the user has spoken since arriving in this state. Zero
    // means we have not asked yet (the post-score state is entered after the
    // reply has streamed); one means this is the first non-answer; two or more
    // means they are not going to give a number.
    const anchor = process.transitionedAt ?? process.enteredAt ?? now;
    let spoken: number;
    try {
      spoken = await countUserMessagesSince(anchor);
    } catch {
      // Unknown is not "many". Ask rather than release.
      spoken = 1;
    }

    if (spoken === 0) {
      return {
        kind: 'deliver',
        process,
        resolved,
        text: getStabilityQuestionForLocale(locale),
        step: 'stability_question',
      };
    }

    const captured = captureStabilityScore(userMessage);

    if (!captured.found) {
      // Q5 — owner decision 2026-08-08. One re-ask, then release.
      //
      // The user has already said they want to leave. Asking a third time
      // would trap them in the session, and the platform must never do that.
      // So: no fabricated score, no successful-close claim, the attempt stays
      // on record as INCOMPLETE, and the clinician gives a short warm close.
      if (spoken >= 2) {
        const released = transitionClosureProcess(process, 'INCOMPLETE', { now });
        if (released.ok) {
          process = (
            await persistProcess(userId, process, released.process, 'score_refused')
          ).process;
        }
        return { kind: 'constrain', process, resolved, note: 'incomplete' };
      }

      return {
        kind: 'deliver',
        process,
        resolved,
        text: getStabilityQuestionForLocale(locale),
        step: 'stability_question_reask',
      };
    }

    // recordCapturedScore routes to the initial or post slot by current state.
    const recorded = recordCapturedScore(process, captured.score, now);
    if (recorded.ok) {
      process = (await persistProcess(userId, process, recorded.process, null)).process;
    }

    // 4. The user's current score decides the outcome — not the history.
    const outcome = decideClosureOutcome({
      postScore: captured.score,
      roundsDelivered: process.roundCount,
      threshold: STABILITY_CLOSE_THRESHOLD,
    });
    // Route as outcome: ACTIVATED_CLOSE once any stabilisation was involved,
    // NORMAL_CLOSE when the measurement alone settled it.
    const route =
      outcome.outcome === 'DELIVERING_STABILISATION' || process.roundCount > 0
        ? 'ACTIVATED_CLOSE'
        : 'NORMAL_CLOSE';
    const moved = transitionClosureProcess(process, outcome.outcome, { now, route });
    if (moved.ok) {
      process = (await persistProcess(userId, process, moved.process, outcome.reason)).process;
    }

    // The turn now carries the clinical step the new state calls for.
    if (moved.ok && moved.process.state === 'CLOSED') {
      return { kind: 'constrain', process, resolved, note: 'closing' };
    }
    if (moved.ok && moved.process.state === 'DELIVERING_STABILISATION') {
      return { kind: 'constrain', process, resolved, note: 'stabilisation' };
    }
    if (moved.ok && moved.process.state === 'INCOMPLETE') {
      return { kind: 'constrain', process, resolved, note: 'incomplete' };
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
