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
 * The eight process values of the Activated Session Closure Protocol §15.
 *
 *   NONE                       no closure sequence is running
 *   AWAITING_INITIAL_SCORE     stop-and-explain delivered; first score pending
 *   DELIVERING_STABILISATION   a stabilisation round is in flight
 *   AWAITING_POST_SCORE        stabilisation delivered; post score pending
 *   AWAITING_CLOSE_CONFIRMATION closure decision made; confirmation pending
 *   HUMAN_SUPPORT              escalated out of the self-help sequence
 *   CLOSED                     an Activated Closure sequence COMPLETED
 *   INCOMPLETE                 a sequence was started and not completed
 *
 * CLOSED does not mean the chat is permanently closed. It means one closure
 * sequence finished. A new substantive turn returns the process to NONE
 * (see resolveClosureProcessForTurn).
 */
export const CLOSURE_PROCESS_STATES = [
  'NONE',
  'AWAITING_INITIAL_SCORE',
  'DELIVERING_STABILISATION',
  'AWAITING_POST_SCORE',
  'AWAITING_CLOSE_CONFIRMATION',
  'HUMAN_SUPPORT',
  'CLOSED',
  'INCOMPLETE',
] as const;

export type ClosureProcessState = (typeof CLOSURE_PROCESS_STATES)[number];

/** The two closure routes of the protocol §2. */
export const CLOSURE_ROUTES = ['NORMAL_CLOSE', 'ACTIVATED_CLOSE'] as const;
export type ClosureRoute = (typeof CLOSURE_ROUTES)[number];

/**
 * The minimum Phase 1 operational record. Deliberately carries NO clinical
 * content and NO score fields — those arrive with the clinical sequence in a
 * later phase. Every timestamp here is stamped by the server; none of them
 * can be supplied by the model.
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
  'AWAITING_CLOSE_CONFIRMATION',
  'HUMAN_SUPPORT',
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
 * Entry (NONE / INCOMPLETE → AWAITING_INITIAL_SCORE) is defined but never
 * invoked in Phase 1 — nothing enters Activated Closure yet.
 *
 * NORMAL_CLOSE (protocol §2) completes without a stabilisation sequence, so
 * NONE → CLOSED is a legal edge.
 *
 * HUMAN_SUPPORT (owner decision 2026-08-05) is an ACTIVE human-handoff state,
 * not a terminal outcome in itself. It has exactly two exits:
 *   → CLOSED      only once human support is CONCRETELY CONFIRMED — the user
 *                 has contacted a trusted person, a trusted person is
 *                 physically present, contact with an urgent professional
 *                 service is established, or an emergency handoff has been
 *                 initiated and confirmed. CLOSED here means the closure
 *                 completed THROUGH A CONFIRMED HUMAN HANDOFF. It does not
 *                 mean the AI independently stabilised the user.
 *   → INCOMPLETE  the user leaves, stops responding, or no handoff is
 *                 confirmed.
 * A distinct HUMAN_HANDOFF outcome may be added later alongside clinical
 * outcome fields; it is deliberately NOT a runtime state in Phase 1.
 *
 * AWAITING_CLOSE_CONFIRMATION → AWAITING_POST_SCORE (owner decision
 * 2026-08-05) lets a user who is no longer ready to close say so. It re-asks
 * for a current score and therefore does NOT consume a stabilisation round —
 * only delivering an intervention does. The decision logic that acts on the
 * fresh score belongs to Phase 2 and is not implemented here.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<ClosureProcessState, readonly ClosureProcessState[]>
> = Object.freeze({
  NONE: ['AWAITING_INITIAL_SCORE', 'CLOSED'],
  AWAITING_INITIAL_SCORE: ['DELIVERING_STABILISATION', 'HUMAN_SUPPORT', 'INCOMPLETE'],
  DELIVERING_STABILISATION: ['AWAITING_POST_SCORE', 'HUMAN_SUPPORT', 'INCOMPLETE'],
  AWAITING_POST_SCORE: [
    'DELIVERING_STABILISATION',
    'AWAITING_CLOSE_CONFIRMATION',
    'HUMAN_SUPPORT',
    'INCOMPLETE',
  ],
  AWAITING_CLOSE_CONFIRMATION: [
    'AWAITING_POST_SCORE',
    'CLOSED',
    'HUMAN_SUPPORT',
    'INCOMPLETE',
  ],
  HUMAN_SUPPORT: ['CLOSED', 'INCOMPLETE'],
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
  if (to === 'AWAITING_INITIAL_SCORE') {
    if (!opts.route) {
      return { ok: false, reason: 'route_required', process: current };
    }
    return {
      ok: true,
      process: {
        ...current,
        state: to,
        route: opts.route,
        enteredAt: now,
        transitionedAt: now,
        roundCount: 0,
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
      process: { ...current, state: to, transitionedAt: now, roundCount: nextRound },
    };
  }

  if (to === 'CLOSED') {
    return {
      ok: true,
      process: { ...current, state: to, transitionedAt: now, completedAt: now },
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
        freezeInterruptedAt: null,
      },
    };
  }

  return {
    ok: true,
    process: { ...current, state: to, transitionedAt: now },
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
    // Invariant enforced at the storage boundary: the freeze marker is only
    // meaningful on an ACTIVE sequence. On any other state it is stale and is
    // dropped here, so the resolver never has to reason about that case.
    freezeInterruptedAt: isActiveProcessState(state)
      ? (raw.freezeInterruptedAt ?? null)
      : null,
  };
}
