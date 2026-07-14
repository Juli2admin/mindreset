// Completion detector for State-module sessions.
//
// The system prompt (lib/states/prompts/anxiety.ts) instructs the AI to
// append EXACTLY ONE of these markers on its own line at the end of the
// closing turn:
//   [[SESSION_COMPLETE:stabilised]]
//   [[SESSION_COMPLETE:red_flag]]
//   [[SESSION_COMPLETE:not_settled_close]]
//
// PR ψ4 (2026-07-13). The AI may also append a navigation-advisor
// marker BEFORE the SESSION_COMPLETE marker to suggest a sibling
// State module the reader might benefit from next:
//   [[SUGGEST:anxiety]] | [[SUGGEST:apathy]] |
//   [[SUGGEST:loss_of_self]] | [[SUGGEST:inner_emptiness]]
// Only allowed values are the four live State moduleIds — anything
// else is ignored (defence against the AI hallucinating a Theme slug
// the app doesn't ship yet).
//
// The turn API strips BOTH markers before the text reaches the reader,
// same pattern as Journey's <state-report> block. When present, the
// turn API sets StateSession.completedAt + completionReason, and
// emits a state-meta sentinel in the stream tail so the client can
// render the suggested-module card in the session-complete UI.

import { SESSION_COMPLETE_MARKER_RE } from './prompts/anxiety';
import { STATE_MODULE_IDS, type StateModuleId } from './modules';

export type StateCompletionReason =
  | 'stabilised'
  | 'red_flag'
  | 'not_settled_close';

export type StateCompletionResult =
  | {
      completed: false;
      visibleText: string;
      suggestedModuleId: StateModuleId | null;
    }
  | {
      completed: true;
      reason: StateCompletionReason;
      visibleText: string;
      suggestedModuleId: StateModuleId | null;
    };

const SUGGEST_MARKER_RE = /\[\[SUGGEST:([a-z_]+)\]\]/i;

function extractSuggestion(text: string): StateModuleId | null {
  const match = text.match(SUGGEST_MARKER_RE);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  return (STATE_MODULE_IDS as readonly string[]).includes(raw)
    ? (raw as StateModuleId)
    : null;
}

/**
 * Scan a fully-streamed assistant message for the completion marker
 * and the optional suggestion marker. Returns the visibleText with
 * both markers stripped, the completion reason if the session ended,
 * and the suggested next module if the AI included a valid one.
 */
export function detectCompletion(assistantText: string): StateCompletionResult {
  const suggestedModuleId = extractSuggestion(assistantText);
  const completionMatch = assistantText.match(SESSION_COMPLETE_MARKER_RE);

  // Strip BOTH markers from what the reader sees.
  const visibleText = assistantText
    .replace(SESSION_COMPLETE_MARKER_RE, '')
    .replace(SUGGEST_MARKER_RE, '')
    .trimEnd();

  if (!completionMatch) {
    return { completed: false, visibleText, suggestedModuleId };
  }

  const reason = completionMatch[1].toLowerCase() as StateCompletionReason;
  return { completed: true, reason, visibleText, suggestedModuleId };
}
