// Activated Closure — server-owned process state and transition model.
// Phase 1 (2026-08-05). PURE MODULE: no I/O, no Prisma, no model output.
//
// ---------------------------------------------------------------------------
// AUTHORITY — who owns what. Read this before adding anything here.
// ---------------------------------------------------------------------------
//   * closure PROCESS state (this module) is SERVER-OWNED ORCHESTRATION state.
//     It records where a closure sequence has got to. It is written only by
//     code, never by the model, and never reconstructed from model-generated
//     history (state reports, cycleStatus, JourneyTurn rows).
//   * `cycleStatus` / `cycleCanClose` / `hasOpenCycle` remain MODEL-REPORTED
//     CLINICAL state. They describe how the AI reads the therapeutic material.
//     They are not the process authority and must not be used as one.
//   * lib/journey/closure/guard.ts remains the LEGACY POST-RESPONSE RECORD
//     VALIDATOR. It decides whether a closure CLAIM may be recorded as
//     resolved, after the reply has already streamed. It does NOT own the
//     process state and is deliberately untouched by this module.
//
// The two concepts stay separate. Do not merge them.
// ---------------------------------------------------------------------------
//
// This module is the SINGLE source of truth for closure process transitions.
// Route handlers, prompt assembly and save functions must call into it rather
// than re-deriving "is a closure running?" locally.

// The interrupted-process threshold is the SAME 4-hour session boundary the
// rest of the Journey runtime uses. Imported, never redefined — one constant,
// one meaning.
import { SESSION_BOUNDARY_MS } from '../state/session-boundary';

/**
 * The six process values of Closing.
 *
 *   NONE                       no closure sequence is running
 *   AWAITING_INITIAL_SCORE     stability question delivered; first score pending
 *   DELIVERING_STABILISATION   a stabilisation round is in flight
 *   AWAITING_POST_SCORE        stabilisation delivered; post score pending
 *   CLOSED                     a closure sequence COMPLETED
 *   INCOMPLETE                 a sequence was started and not completed
 *
 * Not every close visits every state: a measurement at or above the threshold
 * goes straight to CLOSED, and a close that needs no measurement never enters
 * the sequence at all.
 *
 * CLOSED does not mean the chat is permanently closed. It means one closure
 * sequence finished. A new substantive turn returns the process to NONE
 * (see resolveClosureProcessForTurn).
 *
 * REMOVED 2026-08-08 (post-#366 cleanup). Two states were dropped as not part
 * of the product:
 *
 *   AWAITING_CLOSE_CONFIRMATION — the user's explicit `session_exit` already
 *   expresses the decision to leave. Asking them to confirm a decision they
 *   have made re-opens it, so there is no second confirmation question.
 *
 *   HUMAN_SUPPORT — MindReset is self-help and provides no human-support
 *   service or managed handoff, so the sequence must not route into one.
 *   INCOMPLETE is the honest record for a close that could not be settled.
 *   Crisis and emergency handling are a SEPARATE, unchanged mechanism that
 *   runs before this module is reached.
 *
 * Neither ever had a runtime producer: nothing outside this file's own
 * transition table ever named them (verified across the full git history of
 * lib/ and app/), so no persisted row can hold either value. Storage is `text`
 * with no enum and no CHECK constraint, so their removal needs no migration —
 * and normaliseClosureProcess degrades any unrecognised string to NONE, which
 * keeps a hand-written row safe rather than crashing.
 */
export const CLOSURE_PROCESS_STATES = [
  'NONE',
  'AWAITING_INITIAL_SCORE',
  'DELIVERING_STABILISATION',
  'AWAITING_POST_SCORE',
  'CLOSED',
  'INCOMPLETE',
] as const;

export type ClosureProcessState = (typeof CLOSURE_PROCESS_STATES)[number];

/** The two closure routes of the protocol §2. */
export const CLOSURE_ROUTES = ['NORMAL_CLOSE', 'ACTIVATED_CLOSE'] as const;
export type ClosureRoute = (typeof CLOSURE_ROUTES)[number];

/**
 * The operational record. Phase 1 established the process fields; Phase 2 adds
 * the two stability scores. It still carries NO clinical CONTENT — no
 * activation type, no plan, no wording. Every timestamp is stamped by the
 * server; none can be supplied by the model.
 */
export type ClosureProcess = {
  state: ClosureProcessState;
  route: ClosureRoute | null;
  /** When the currently-recorded process was entered. */
  enteredAt: Date | null;
  /** When the process state last changed. Anchors the interrupted check. */
  transitionedAt: Date | null;
  /** Stabilisation rounds delivered so far in the current process. */
  roundCount: number;
  /** Historical marker: when a sequence last completed. Survives reset. */
  completedAt: Date | null;
  /** Historical marker: when a sequence was last abandoned. Survives reset. */
  incompleteAt: Date | null;
  /**
   * The two stability scores, CAPTURED BY CODE from the user's own message
   * (lib/journey/closure/score-capture.ts) — never read from the model's
   * `stabilityCheck`, which is audit only. Because the code asked the
   * question, `scale: 'stability'` and `source: 'user_reported'` are facts
   * here rather than model claims. Timestamps are server-stamped.
   */
  initialScore: number | null;
  initialScoreAt: Date | null;
  postScore: number | null;
  postScoreAt: Date | null;
  /**
   * Set when a safety freeze lands on an ACTIVE sequence. The sequence itself
   * is left exactly as it was — freeze has absolute precedence and must not
   * quietly bookkeep a frozen user's process. The marker is what makes the
   * interruption survive the freeze, including a freeze cleared by hand in
   * SQL, so the first unfrozen turn can end the attempt properly instead of
   * resuming it mid-sequence with stale measurements.
   *
   * Invariant: only ever non-null while the state is active. normalise drops
   * it otherwise.
   */
  freezeInterruptedAt: Date | null;
};

/** The default for every existing user and every idle process. */
export const CLOSURE_PROCESS_NONE: ClosureProcess = Object.freeze({
  state: 'NONE',
  route: null,
  enteredAt: null,
  transitionedAt: null,
  roundCount: 0,
  completedAt: null,
  incompleteAt: null,
  initialScore: null,
  initialScoreAt: null,
  postScore: null,
  postScoreAt: null,
  freezeInterruptedAt: null,
});

/**
 * Protocol §10 — a closure sequence may deliver at most two stabilisation
 * rounds. Phase 1 enforces this as a FIELD CONSTRAINT only: a transition that
 * would push the counter past the cap is rejected. What the sequence should
 * clinically DO when the cap is reached is not implemented here.
 *
 * Owner decision 2026-08-05: a round is consumed only when a stabilisation
 * intervention is actually DELIVERED — i.e. on entry to
 * DELIVERING_STABILISATION. Asking for a score never consumes one, so
 * returning to AWAITING_POST_SCORE leaves the counter untouched.
 */
export const MAX_STABILISATION_ROUNDS = 2;

/**
 * Protocol §14 / approved semantics — an unfinished closure whose last
 * transition is older than the session boundary is retained as INCOMPLETE.
 * Same 4-hour threshold as the rest of the runtime; aliased for readability
 * at the call sites, NOT redefined.
 */
export const INTERRUPTED_PROCESS_MS = SESSION_BOUNDARY_MS;

/**
 * Terminal states — a sequence has ended. Terminal does NOT mean frozen: a
 * terminal process still permits ordinary conversation, and CLOSED is
 * re-armed to NONE by the next substantive turn.
 */
const TERMINAL_STATES: readonly ClosureProcessState[] = ['CLOSED', 'INCOMPLETE'];

/**
 * Non-terminal, non-idle states — a sequence is mid-flight. These are the
 * states that block recorded stage/depth progression.
 */
const ACTIVE_STATES: readonly ClosureProcessState[] = [
  'AWAITING_INITIAL_SCORE',
  'DELIVERING_STABILISATION',
  'AWAITING_POST_SCORE',
];

/** True when a closure sequence has ended (CLOSED or INCOMPLETE). */
export function isTerminalProcessState(state: ClosureProcessState): boolean {
  return TERMINAL_STATES.includes(state);
}

/** True when a closure sequence is mid-flight. */
export function isActiveProcessState(state: ClosureProcessState): boolean {
  return ACTIVE_STATES.includes(state);
}

/**
 * The single predicate the routing and save layers consult. A closure
 * sequence in flight means the user is being brought to a safe stop — no
 * stage or depth progression may be RECORDED while that is happening.
 * NONE, CLOSED and INCOMPLETE never block.
 */
export function blocksProgression(state: ClosureProcessState): boolean {
  return isActiveProcessState(state);
}

/**
 * Allowed transitions. Anything not listed here is invalid.
 *
 * NORMAL_CLOSE completes without a stabilisation sequence, so NONE → CLOSED is
 * a legal edge.
 *
 * AWAITING_INITIAL_SCORE → CLOSED (2026-08-08). A score at or above the
 * threshold ENDS the sequence: the user's explicit session_exit already was
 * the consent, so there is no second confirmation question to ask. Its absence
 * was the last artefact of the original design, in which entry implied the
 * user was already known to need stabilising.
 *
 * Every active state also reaches INCOMPLETE, which is what guarantees an exit
 * from anywhere in the sequence: a refusal, a freeze interruption, or a
 * four-hour stall all end the attempt honestly rather than trapping the user.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<ClosureProcessState, readonly ClosureProcessState[]>
> = Object.freeze({
  NONE: ['AWAITING_INITIAL_SCORE', 'CLOSED'],
  AWAITING_INITIAL_SCORE: ['CLOSED', 'DELIVERING_STABILISATION', 'INCOMPLETE'],
  DELIVERING_STABILISATION: ['AWAITING_POST_SCORE', 'INCOMPLETE'],
  AWAITING_POST_SCORE: ['CLOSED', 'DELIVERING_STABILISATION', 'INCOMPLETE'],
  CLOSED: ['NONE'],
  INCOMPLETE: ['NONE', 'AWAITING_INITIAL_SCORE'],
});

export function isAllowedTransition(
  from: ClosureProcessState,
  to: ClosureProcessState,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export type TransitionRejection =
  | 'invalid_transition'
  | 'route_required'
  | 'round_limit_exceeded';

export type TransitionResult =
  | { ok: true; process: ClosureProcess }
  | { ok: false; reason: TransitionRejection; process: ClosureProcess };

/**
 * Apply a transition. Pure — returns the next record, or a rejection with the
 * record left untouched. Every timestamp is taken from the caller-supplied
 * server clock; nothing here reads the wall clock itself, so the whole model
 * is deterministic under test.
 */
export function transitionClosureProcess(
  current: ClosureProcess,
  to: ClosureProcessState,
  opts: { now: Date; route?: ClosureRoute },
): TransitionResult {
  if (!isAllowedTransition(current.state, to)) {
    return { ok: false, reason: 'invalid_transition', process: current };
  }

  const now = opts.now;

  // Entry — a fresh sequence. Approved semantics: an earlier attempt is never
  // reused, so the round counter restarts and the entry timestamp is fresh.
  // The historical completedAt / incompleteAt markers are preserved.
  // Measurement-first correction (owner decision 2026-08-08). Entry no longer
  // requires a route, because at entry the route is NOT YET KNOWN.
  //
  // Historical destabilisation establishes only that a CURRENT stability
  // measurement is required before this session may close. It does not say the
  // user is activated now. The user's own reported score decides that, and the
  // route is the OUTCOME of the score, not an input to entry:
  //   score >= STABILITY_CLOSE_THRESHOLD -> no stabilisation ran -> NORMAL_CLOSE
  //   score <  STABILITY_CLOSE_THRESHOLD -> stabilisation runs    -> ACTIVATED_CLOSE
  // The route is assigned on the first transition out of this state.
  //
  // `route: null` here is deliberate and is NOT inherited from a previous
  // sequence — a fresh attempt reuses nothing, per the approved semantics.
  if (to === 'AWAITING_INITIAL_SCORE') {
    return {
      ok: true,
      process: {
        ...current,
        state: to,
        route: opts.route ?? null,
        enteredAt: now,
        transitionedAt: now,
        roundCount: 0,
        initialScore: null,
        initialScoreAt: null,
        postScore: null,
        postScoreAt: null,
        freezeInterruptedAt: null,
      },
    };
  }

  // NORMAL_CLOSE straight from idle also needs a route recorded.
  if (to === 'CLOSED' && current.state === 'NONE') {
    if (!opts.route) {
      return { ok: false, reason: 'route_required', process: current };
    }
    return {
      ok: true,
      process: {
        ...current,
        state: to,
        route: opts.route,
        enteredAt: current.enteredAt ?? now,
        transitionedAt: now,
        completedAt: now,
      },
    };
  }

  // A stabilisation round. Field constraint only — the clinical decision to
  // run another round is not implemented in Phase 1.
  if (to === 'DELIVERING_STABILISATION') {
    const nextRound = current.roundCount + 1;
    if (nextRound > MAX_STABILISATION_ROUNDS) {
      return { ok: false, reason: 'round_limit_exceeded', process: current };
    }
    return {
      ok: true,
      process: {
        ...current,
        state: to,
        // Route as outcome: entering stabilisation IS the activated path, so a
        // caller may record it here. A route already on the record wins nothing
        // over an explicit one, and absence keeps whatever is stored.
        route: opts.route ?? current.route,
        transitionedAt: now,
        roundCount: nextRound,
      },
    };
  }

  if (to === 'CLOSED') {
    return {
      ok: true,
      process: {
        ...current,
        state: to,
        // Route as outcome: a close reached from a score records which route it
        // turned out to be. Absence keeps whatever is already stored.
        route: opts.route ?? current.route,
        transitionedAt: now,
        completedAt: now,
      },
    };
  }

  // Retained as the record of an abandoned attempt: route, enteredAt and the
  // round count are deliberately NOT cleared.
  if (to === 'INCOMPLETE') {
    return {
      ok: true,
      process: { ...current, state: to, transitionedAt: now, incompleteAt: now },
    };
  }

  // Reset to idle. Only the operational fields clear; completedAt and
  // incompleteAt survive as the durable history of what came before.
  if (to === 'NONE') {
    return {
      ok: true,
      process: {
        ...current,
        state: 'NONE',
        route: null,
        enteredAt: null,
        transitionedAt: now,
        roundCount: 0,
        initialScore: null,
        initialScoreAt: null,
        postScore: null,
        postScoreAt: null,
        freezeInterruptedAt: null,
      },
    };
  }

  // Remaining edges — including AWAITING_INITIAL_SCORE -> AWAITING_CLOSE_
  // CONFIRMATION, the measurement-first path where the initial score cleared the
  // threshold and no stabilisation was ever needed. A caller may record the
  // resolved route here; omitting it keeps whatever is already stored.
  return {
    ok: true,
    process: {
      ...current,
      state: to,
      route: opts.route ?? current.route,
      transitionedAt: now,
    },
  };
}

/**
 * Record that a safety freeze has landed on an active closure sequence.
 * Pure — the caller persists the result.
 *
 * Freeze has absolute precedence, so this deliberately does NOT change the
 * process state or the round count: the sequence is preserved exactly as it
 * stood, and only the marker is added. Nothing is marked when no sequence is
 * running, and an existing marker is never overwritten (freezeJourney is
 * idempotent and must not restamp an earlier interruption).
 */
export function markFreezeInterruption(
  current: ClosureProcess,
  now: Date,
): { marked: boolean; process: ClosureProcess } {
  if (!isActiveProcessState(current.state)) return { marked: false, process: current };
  if (current.freezeInterruptedAt) return { marked: false, process: current };
  return { marked: true, process: { ...current, freezeInterruptedAt: now } };
}

/** Clamp-free score normalisation: anything off-scale becomes null, never a
 *  fabricated value. Mirrors score-capture.ts, which rejects rather than
 *  clamps for the same reason. */
function normaliseScore(v: number | null | undefined): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  return v >= 1 && v <= 10 ? v : null;
}

/**
 * Protocol §8 — how far the user moved. Positive is improvement, because the
 * stability scale runs 1 = overwhelmed to 10 = fully grounded.
 * Returns null until both scores exist.
 */
export function computeScoreChange(process: ClosureProcess): number | null {
  const { initialScore, postScore } = process;
  if (initialScore === null || postScore === null) return null;
  return postScore - initialScore;
}

export type ClosureOutcome = 'CLOSED' | 'DELIVERING_STABILISATION' | 'INCOMPLETE';

export type ClosureOutcomeReason =
  | 'score_at_or_above_threshold'
  | 'below_threshold_rounds_remain'
  | 'below_threshold_rounds_exhausted';

/**
 * The closure decision. Pure arithmetic over a CODE-CAPTURED score; no clinical
 * judgement anywhere in it.
 *
 *   at/above threshold        -> CLOSED       (no stabilisation was needed)
 *   below, rounds remain      -> DELIVERING_STABILISATION
 *   below, rounds exhausted   -> INCOMPLETE
 *
 * PRODUCT SIMPLIFICATION, owner decision 2026-08-08. This function was the only
 * producer of the two states removed in the post-#366 cleanup — see
 * CLOSURE_PROCESS_STATES for why neither is part of Closing. In short: an
 * explicit session_exit is already the user's decision to leave, so there is no
 * confirmation step; and MindReset provides no human-support service, so
 * INCOMPLETE is the honest record for a close that could not be settled. Crisis
 * and emergency handling are a SEPARATE, unchanged mechanism — the keyword scan
 * runs before this hook is ever reached.
 *
 * `roundsDelivered` is the count of stabilisation rounds actually delivered —
 * `ClosureProcess.roundCount`, which only increments on entry to
 * DELIVERING_STABILISATION.
 */
export function decideClosureOutcome(args: {
  postScore: number;
  roundsDelivered: number;
  threshold: number;
}): { outcome: ClosureOutcome; reason: ClosureOutcomeReason } {
  if (args.postScore >= args.threshold) {
    return { outcome: 'CLOSED', reason: 'score_at_or_above_threshold' };
  }
  if (args.roundsDelivered < MAX_STABILISATION_ROUNDS) {
    return {
      outcome: 'DELIVERING_STABILISATION',
      reason: 'below_threshold_rounds_remain',
    };
  }
  return { outcome: 'INCOMPLETE', reason: 'below_threshold_rounds_exhausted' };
}

export type ScoreSlot = 'initial' | 'post';

export type RecordScoreResult =
  | { ok: true; process: ClosureProcess; slot: ScoreSlot }
  | { ok: false; reason: 'not_awaiting_a_score' | 'score_out_of_range' };

/**
 * Place a CODE-CAPTURED score into the slot the current state is waiting for.
 * Pure; the caller persists.
 *
 *   AWAITING_INITIAL_SCORE -> initialScore
 *   AWAITING_POST_SCORE    -> postScore
 *
 * Any other state rejects: a score only means something while the process is
 * actually waiting for one, and writing it elsewhere would record a
 * measurement the sequence never asked for. The state is NOT advanced here —
 * that is a transition, and transitions go through transitionClosureProcess.
 *
 * Out-of-range rejects rather than clamps, matching score-capture.ts: a stored
 * score is always a number the user actually gave.
 */
export function recordCapturedScore(
  current: ClosureProcess,
  score: number,
  now: Date,
): RecordScoreResult {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return { ok: false, reason: 'score_out_of_range' };
  }
  if (current.state === 'AWAITING_INITIAL_SCORE') {
    return {
      ok: true,
      slot: 'initial',
      process: { ...current, initialScore: score, initialScoreAt: now },
    };
  }
  if (current.state === 'AWAITING_POST_SCORE') {
    return {
      ok: true,
      slot: 'post',
      process: { ...current, postScore: score, postScoreAt: now },
    };
  }
  return { ok: false, reason: 'not_awaiting_a_score' };
}

export type ProcessResolution =
  | { changed: false; process: ClosureProcess; reason: null }
  | {
      changed: true;
      process: ClosureProcess;
      reason:
        | 'freeze_interrupted'
        | 'interrupted_process_expired'
        | 'closed_reset_on_new_turn';
    };

/**
 * The two automatic, non-clinical transitions Phase 1 owns. Called once per
 * substantive user turn, BEFORE the model call.
 *
 * A "substantive turn" in Phase 1 is mechanical: a turn that reached the
 * orchestration hook — authenticated, in-access, not rate-limited, not frozen,
 * no crisis keyword hit, with a non-empty trimmed user message.
 *
 *  1. An unfinished sequence whose last transition is older than the 4-hour
 *     session boundary is retained as INCOMPLETE. Approved semantics: keep the
 *     attempt on record, do not reuse anything from it, require a fresh
 *     current-state assessment when the clinical sequence is later connected.
 *  2. CLOSED means one sequence completed, not that the chat is over. A new
 *     substantive turn returns the process to NONE.
 *
 * Everything else is left exactly as persisted. In particular a missing or
 * unparseable model state report cannot reach this function at all — it takes
 * only the persisted record and a clock.
 */
export function resolveClosureProcessForTurn(
  current: ClosureProcess,
  now: Date,
): ProcessResolution {
  // 0. Freeze interruption outranks every other rule. Reaching this function
  //    at all means the turn is NOT frozen — the orchestration hook sits
  //    behind the freeze branch — so a marker here means a freeze landed on
  //    an active sequence and has since been cleared, by the cooldown-lift
  //    verifier or by hand in SQL. Either way the attempt is over: it must not
  //    resume mid-sequence, and none of its measurements may be treated as
  //    current evidence. Unlike the four-hour path, the round count is RESET —
  //    nothing at all carries forward from a frozen attempt.
  //
  //    Phase 1 stops at INCOMPLETE. It does NOT enter AWAITING_INITIAL_SCORE;
  //    Phase 2 uses the existing INCOMPLETE → AWAITING_INITIAL_SCORE edge to
  //    begin a fresh assessment.
  if (current.freezeInterruptedAt && isActiveProcessState(current.state)) {
    const result = transitionClosureProcess(current, 'INCOMPLETE', { now });
    if (result.ok) {
      return {
        changed: true,
        process: { ...result.process, roundCount: 0, freezeInterruptedAt: null },
        reason: 'freeze_interrupted',
      };
    }
  }

  if (isActiveProcessState(current.state)) {
    const anchor = current.transitionedAt ?? current.enteredAt;
    if (anchor && now.getTime() - anchor.getTime() >= INTERRUPTED_PROCESS_MS) {
      const result = transitionClosureProcess(current, 'INCOMPLETE', { now });
      if (result.ok) {
        return {
          changed: true,
          process: result.process,
          reason: 'interrupted_process_expired',
        };
      }
    }
    return { changed: false, process: current, reason: null };
  }

  if (current.state === 'CLOSED') {
    const result = transitionClosureProcess(current, 'NONE', { now });
    if (result.ok) {
      return {
        changed: true,
        process: result.process,
        reason: 'closed_reset_on_new_turn',
      };
    }
  }

  // NONE stays NONE. INCOMPLETE is RETAINED — the approved semantics keep the
  // previous attempt on record rather than silently re-arming it.
  return { changed: false, process: current, reason: null };
}

/**
 * Defensive read of the persisted columns. Storage is plain strings/ints, so
 * this is the boundary where anything unrecognised is made safe.
 *
 * Fail-safe direction: an unknown STATE degrades to NONE (never trap a user in
 * a process that does not exist), but a recognised active state with an
 * unreadable route keeps the state and drops the route — blocking recorded
 * progression is the safe side of that particular error.
 */
export function normaliseClosureProcess(raw: {
  state?: string | null;
  route?: string | null;
  enteredAt?: Date | null;
  transitionedAt?: Date | null;
  roundCount?: number | null;
  completedAt?: Date | null;
  incompleteAt?: Date | null;
  initialScore?: number | null;
  initialScoreAt?: Date | null;
  postScore?: number | null;
  postScoreAt?: Date | null;
  freezeInterruptedAt?: Date | null;
}): ClosureProcess {
  const state = (CLOSURE_PROCESS_STATES as readonly string[]).includes(
    raw.state ?? '',
  )
    ? (raw.state as ClosureProcessState)
    : 'NONE';

  if (state === 'NONE') {
    return {
      ...CLOSURE_PROCESS_NONE,
      completedAt: raw.completedAt ?? null,
      incompleteAt: raw.incompleteAt ?? null,
    };
  }

  const route = (CLOSURE_ROUTES as readonly string[]).includes(raw.route ?? '')
    ? (raw.route as ClosureRoute)
    : null;

  const rawRound = typeof raw.roundCount === 'number' ? raw.roundCount : 0;
  const roundCount = Number.isFinite(rawRound)
    ? Math.min(MAX_STABILISATION_ROUNDS, Math.max(0, Math.trunc(rawRound)))
    : 0;

  return {
    state,
    route,
    enteredAt: raw.enteredAt ?? null,
    transitionedAt: raw.transitionedAt ?? null,
    roundCount,
    completedAt: raw.completedAt ?? null,
    incompleteAt: raw.incompleteAt ?? null,
    initialScore: normaliseScore(raw.initialScore),
    initialScoreAt: raw.initialScoreAt ?? null,
    postScore: normaliseScore(raw.postScore),
    postScoreAt: raw.postScoreAt ?? null,
    // Invariant enforced at the storage boundary: the freeze marker is only
    // meaningful on an ACTIVE sequence. On any other state it is stale and is
    // dropped here, so the resolver never has to reason about that case.
    freezeInterruptedAt: isActiveProcessState(state)
      ? (raw.freezeInterruptedAt ?? null)
      : null,
  };
}
