// Completion detector for State-module sessions.
//
// The system prompt (lib/states/prompts/anxiety.ts) instructs the AI to
// append EXACTLY ONE of these markers on its own line at the end of the
// closing turn:
//   [[SESSION_COMPLETE:stabilised]]
//   [[SESSION_COMPLETE:red_flag]]
//   [[SESSION_COMPLETE:not_settled_close]]
//
// The turn API strips the marker before the text reaches the reader,
// same pattern as Journey's <state-report> block. When present, the
// turn API sets StateSession.completedAt + completionReason.
//
// Design note. We deliberately do NOT try to detect completion from the
// AI's prose or from keyword-scanning the user's reply — a soft
// "feels better" is not always the end of a session, and the AI has
// the full picture of the arc. Trusting the AI's marker keeps the
// completion signal precise and testable.

import { SESSION_COMPLETE_MARKER_RE } from './prompts/anxiety';

export type StateCompletionReason =
  | 'stabilised'
  | 'red_flag'
  | 'not_settled_close';

export type StateCompletionResult =
  | { completed: false; visibleText: string }
  | { completed: true; reason: StateCompletionReason; visibleText: string };

/**
 * Scan a fully-streamed assistant message for the completion marker.
 * Returns the visibleText with the marker (and any trailing whitespace
 * left by its removal) stripped, and the completion reason if present.
 */
export function detectCompletion(assistantText: string): StateCompletionResult {
  const match = assistantText.match(SESSION_COMPLETE_MARKER_RE);
  if (!match) {
    return { completed: false, visibleText: assistantText };
  }
  const reason = match[1].toLowerCase() as StateCompletionReason;
  // Remove the marker and any trailing whitespace/newlines it leaves
  // behind so the reader doesn't see an awkward blank line at the end.
  const visibleText = assistantText.replace(SESSION_COMPLETE_MARKER_RE, '').trimEnd();
  return { completed: true, reason, visibleText };
}
