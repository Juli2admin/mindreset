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
