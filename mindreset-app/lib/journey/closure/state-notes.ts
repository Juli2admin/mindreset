// Per-turn platform notes for closure states whose action is clinical.
// Phase 2 (2026-08-08).
//
// WHY THIS EXISTS AND WHAT IT IS NOT.
// Two live closure states need a CLINICAL action that code cannot author: the
// stabilisation practice, and the brief safe close. The server owns the process
// and must not simply hand the turn back with no information — that is exactly
// how a blocking state becomes invisible and the clinician says goodbye instead.
//
// This reuses the mechanism already shipped for the same class of problem:
// lib/journey/prompts/emission-reminder.ts appends a `<system-note>` to the
// FINAL USER MESSAGE OF THE OUTBOUND CALL ONLY. It is never persisted, never
// shown to anyone, and explicitly marked as coming from the platform rather
// than the user. That module's own diagnosis applies here — an instruction in
// the large cached system prompt loses to history pressure, and recency wins.
//
// It is NOT: a prompt change, a canon change, a methodology change, or Working
// Memory. It adds no clinical content and states no clinical rule — it names
// the step the server-owned process is currently in, and nothing else.
//
// LIMIT, stated plainly: this constrains by instruction, not by construction.
// It is the weaker half of constrain-then-verify. The transition out of
// DELIVERING_STABILISATION is gated on structured evidence
// (stabilisation-evidence.ts), not on this note being obeyed.

import type { ClosureProcessState } from './process';

const STABILISATION_NOTE =
  '<system-note>Reminder from the platform, not the user: this session requires a stabilising step before it can close. Deliver one small regulation or somatic practice now — breath, orientation, or a micro-movement — framed explicitly, and record it in `practiceRun` with the family you actually used and `status: "completed"` once it has run. Do not close the session on this turn. Do not reference this note in your reply.</system-note>';

const CLOSING_NOTE =
  '<system-note>Reminder from the platform, not the user: the stability check for this session is complete and the user has asked to end. Bring the session to a brief, safe close now — no new material, no new practice, no questions that reopen the work. Do not reference this note in your reply.</system-note>';

const INCOMPLETE_NOTE =
  '<system-note>Reminder from the platform, not the user: the user has asked to end and the session could not be brought to a settled stopping point. Honour that they are leaving. Give a short, warm close with the door left open, per the closing guidance you already follow. Do not ask for a number again, do not press them to stay, and do not treat the work as finished. Do not reference this note in your reply.</system-note>';

/** Which closure situations carry a platform note this turn. */
export type ClosureNoteKind = 'stabilisation' | 'closing' | 'incomplete';

export function getClosureNote(kind: ClosureNoteKind): string {
  if (kind === 'stabilisation') return STABILISATION_NOTE;
  if (kind === 'closing') return CLOSING_NOTE;
  return INCOMPLETE_NOTE;
}

/**
 * The note a state carries when the turn proceeds to the model. Returns null
 * for every state that either has a code-authored action (handled by the
 * short-circuit) or needs no constraint at all.
 */
export function noteForState(state: ClosureProcessState): ClosureNoteKind | null {
  if (state === 'DELIVERING_STABILISATION') return 'stabilisation';
  return null;
}

export type SimpleMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Append the closure note to the final user message of an outbound message
 * array. Pure — returns a new array; never mutates the input. Same contract and
 * same defensive guard as appendEmissionReminder, which runs after this so the
 * output-format reminder stays closest to the end.
 */
export function appendClosureNote(
  messages: SimpleMessage[],
  kind: ClosureNoteKind,
): SimpleMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== 'user') return messages;
  return [
    ...messages.slice(0, -1),
    { ...last, content: `${last.content}\n\n${getClosureNote(kind)}` },
  ];
}
