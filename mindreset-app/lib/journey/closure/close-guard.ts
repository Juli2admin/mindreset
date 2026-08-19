// The user-visible half of "this session must not close on this turn".
// (2026-08-08, owner-approved after the live Russian Closing test.)
//
// THE DEFECT THIS FIXES, observed live.
// At a user-reported stability of 5 — below the approved threshold of 6 — the
// closure process was in DELIVERING_STABILISATION, whose platform note says
// verbatim "Do not close the session on this turn." The Clinician delivered the
// stabilisation practice AND said goodbye anyway:
//
//   «Иди делать дела. Серьёзно.» … «Сегодня достаточно.»
//
// The backend record was correct — cycleCanClose false, presentingRequestStatus
// unresolved — so nothing claimed a successful close. But the USER was told the
// session was finished. state-notes.ts constrains by instruction, and this is
// the turn where the instruction lost.
//
// WHAT THIS IS AND IS NOT.
// It does NOT rewrite, truncate, script or classify the Clinician's prose. The
// stabilisation response the Clinician wrote is delivered in full, untouched.
// Code appends ONE approved sentence that corrects the single forbidden
// implication — that the session finished successfully — and nothing else. The
// user remains free to stop and leave; the sentence says so explicitly.
//
// THE SIGNAL IS STRUCTURED, NOT HEURISTIC.
// `moveJustPerformed: ["universal.session_close"]` is the model's own explicit,
// canonical claim that it performed a session close. It was present on the live
// failing turn. It is not an inference about wording, so there is no prose
// classifier and no false-positive surface from phrasing. Until now the move had
// zero code consumers, so reading it introduces no coupling to existing
// behaviour.

import type { StateReport } from '../stateReport/schema';
import type { ClosureNoteKind } from './state-notes';
import {
  claimsClosure,
  evaluateClosureGate,
  type CapturedMeasurement,
  type ClosureTurn,
} from './guard';
import { measurementRequired } from './orchestrator';

/**
 * Owner-approved copy (2026-08-08). Do not reword without owner approval.
 *
 * Both sentences do two things and only two: they confirm the user may stop
 * now, and they decline to record the session as stably completed. They do not
 * ask a question, add clinical content, or press the user to stay.
 */
export const CLOSE_CORRECTION_RU =
  'Если ты хочешь остановиться сейчас, мы можем остановиться. Но по твоей текущей оценке устойчивости я пока не считаю эту сессию устойчиво завершённой.';

export const CLOSE_CORRECTION_EN =
  'If you want to stop now, we can stop. But based on your current stability rating, I’m not treating this session as stably completed yet.';

export function getCloseCorrectionForLocale(
  locale: string | null | undefined,
): string {
  if (locale === 'ru') return CLOSE_CORRECTION_RU;
  return CLOSE_CORRECTION_EN;
}

/** The canonical move by which the model states it closed the session. */
const SESSION_CLOSE_MOVE = 'universal.session_close';

/**
 * Did the model claim, in structured output, that it closed the session?
 * Pure. Reads one canonical move ID — no wording is inspected.
 */
export function claimsVisibleClose(report: StateReport): boolean {
  const moves = report.moveJustPerformed;
  if (!Array.isArray(moves)) return false;
  return (moves as readonly string[]).includes(SESSION_CLOSE_MOVE);
}

/**
 * The correction to append to this turn's reply, or null for every other case.
 *
 * BOTH conditions must hold, which is what keeps this narrow:
 *
 *   1. the closure note for this turn was 'stabilisation' — i.e. the process is
 *      in DELIVERING_STABILISATION, the ONE state whose note forbids closing on
 *      this turn. 'closing' (CLOSED) and 'incomplete' (INCOMPLETE) are
 *      legitimate outcomes and are deliberately excluded, so a real close and a
 *      real INCOMPLETE release are never corrected;
 *   2. the model's own structured report claims `universal.session_close`.
 *
 * Exit intent alone never triggers this: a user asking to leave with no active
 * DELIVERING_STABILISATION process carries no note at all, so condition 1 fails.
 */
export function closeCorrectionFor(args: {
  /** The closure note delivered to the model this turn, if any. */
  note: ClosureNoteKind | null;
  report: StateReport;
  locale: string | null | undefined;
}): string | null {
  if (args.note !== 'stabilisation') return null;
  if (!claimsVisibleClose(args.report)) return null;
  return getCloseCorrectionForLocale(args.locale);
}

// ---------------------------------------------------------------------------
// The stability boundary (2026-08-19)
// ---------------------------------------------------------------------------
//
// THE DEFECT, from the live session of 2026-08-17 (25 turns, all Stage 3).
// Intensity reached 7 four times and 6 on twelve turns; `stabilityCheck` was
// never emitted on any turn; the Clinician emitted
// `moveJustPerformed: ["universal.session_close"]` on turns 22 AND 23 and told
// the user the session was finished. `applyClosureGate` did its job — the
// archived turn-23 row carries
// `closureGate: {outcome: "blocked", reasons: ["no_stability_measurement"]}` —
// but it runs after the reply has streamed, so it corrected the RECORD and
// nothing else. `closeCorrectionFor` above could not help either: it requires
// a `'stabilisation'` note, and the closure process was `NONE` because the
// process is entered by USER exit intent (orchestrator.ts §4) and this close
// was the Clinician's own.
//
// THE RULE IS EXISTING METHODOLOGY, NOT A NEW ONE. journey-master.md:362:
// "If the user has DESTABILISED in this session at any point (intensity >= 6
// at any turn...), you do NOT close the session on vague reassurance. Before
// any session-pause or session-close move: 1. Run an explicit stability
// check." The thresholds are the constants already in guard.ts.
//
// THIS FUNCTION ADDS NO JUDGEMENT OF ITS OWN. It composes three existing
// authorities and nothing else:
//   * does this turn end or park the session — `claimsVisibleClose` (the
//     model's own canonical move) OR `claimsClosure` (its record claim);
//   * does this session need a measurement — `measurementRequired`, the same
//     function the orchestrator's exit-intent path uses;
//   * has a valid measurement been taken — `evaluateClosureGate`, which is
//     already the single authority on that question.
// No wording is inspected. No new threshold, scale, or clinical rule exists
// here.
//
// WHAT IT ENFORCES, PRECISELY. The session STATE and PROCESS, not the words.
// This predicate is evaluated after the reply has streamed, so a caller acting
// on `true` cannot un-say a goodbye the user has already read. What it can do —
// and what the route does — is refuse to accept the close, enter the existing
// AWAITING_INITIAL_SCORE state, and immediately ask the approved stability
// question, converting an invalid close into the stability check the protocol
// required in the first place. Corrective enforcement, not suppression.

/**
 * Is this turn's close/pause claim invalid for want of a stability measurement?
 *
 * PURE. `sessionTurns` is the raw recent-turn window; both
 * `measurementRequired` and `evaluateClosureGate` narrow it to the current
 * session themselves, using the same `observedAt` so one clock governs both.
 *
 * FAILS CLOSED ON THE VERDICT — it never invents a violation. Every branch that
 * cannot establish one returns false, so a missing or unparseable state report
 * changes nothing about the turn. It returns true only on a positive,
 * structured claim that the session is being ended or parked without the
 * measurement the protocol requires.
 */
export function closeBoundaryApplies(args: {
  report: StateReport;
  /** Recent turns for this user, newest-first or oldest-first — both work. */
  sessionTurns: ClosureTurn[];
  /** The single trusted server clock reading for this turn. */
  observedAt: Date;
  /** Code-captured user-reported score, when the closure process holds one. */
  captured?: CapturedMeasurement | null;
}): boolean {
  const { report, sessionTurns, observedAt, captured } = args;

  // 1. Does this turn end or park the session? `universal.session_close` is
  //    the model's own structured claim that it performed a session close —
  //    the same signal closeCorrectionFor reads, and the one present on both
  //    failing turns of the live session. `claimsClosure` catches the
  //    record-level claim when the visible move was omitted.
  if (!claimsVisibleClose(report) && !claimsClosure(report)) return false;

  // 2. Does this session require a measurement at all? Sessions that never
  //    destabilised are none of this boundary's business — the same
  //    proportionality rule the guard states for itself.
  if (!measurementRequired(sessionTurns, observedAt)) return false;

  // 3. Has one actually been completed and validated? `passed` is the only
  //    outcome that says yes. `blocked` is an explicit no. `not_applicable`
  //    here can only mean the turn claimed no closure in the gate's own
  //    sense (a visible close with no record claim) — which is precisely the
  //    turn-22 shape, and no measurement was validated on it either.
  return evaluateClosureGate(report, sessionTurns, observedAt, captured ?? null).outcome !== 'passed';
}
