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
// module the reader might benefit from next.
//
// PR χ3 (2026-07-14). The SUGGEST allowlist now accepts BOTH State
// module IDs AND Theme module IDs — the slug spaces are disjoint so
// we can determine `kind` from the slug alone.
//   [[SUGGEST:anxiety]] | [[SUGGEST:apathy]] |
//   [[SUGGEST:loss_of_self]] | [[SUGGEST:inner_emptiness]]   (state)
//   [[SUGGEST:shame]] | [[SUGGEST:money]] | [[SUGGEST:body]] |
//   [[SUGGEST:family]] | [[SUGGEST:self_realisation]]        (theme)
//
// The turn API strips BOTH markers before the text reaches the reader.

import { SESSION_COMPLETE_MARKER_RE } from './prompts/anxiety';
import { STATE_MODULE_IDS, type StateModuleId } from './modules';
import { THEME_MODULE_IDS, type ThemeModuleId } from '@/lib/themes/modules';

export type StateCompletionReason =
  | 'stabilised'
  | 'red_flag'
  | 'not_settled_close';

export type SuggestedModule =
  | { kind: 'state'; moduleId: StateModuleId }
  | { kind: 'theme'; moduleId: ThemeModuleId };

export type StateCompletionResult =
  | {
      completed: false;
      visibleText: string;
      suggestedModule: SuggestedModule | null;
    }
  | {
      completed: true;
      reason: StateCompletionReason;
      visibleText: string;
      suggestedModule: SuggestedModule | null;
    };

const SUGGEST_MARKER_RE = /\[\[SUGGEST:([a-z_]+)\]\]/i;

function extractSuggestion(text: string): SuggestedModule | null {
  const match = text.match(SUGGEST_MARKER_RE);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  if ((STATE_MODULE_IDS as readonly string[]).includes(raw)) {
    return { kind: 'state', moduleId: raw as StateModuleId };
  }
  if ((THEME_MODULE_IDS as readonly string[]).includes(raw)) {
    return { kind: 'theme', moduleId: raw as ThemeModuleId };
  }
  return null;
}

/**
 * Scan a fully-streamed assistant message for the completion marker
 * and the optional suggestion marker. Returns the visibleText with
 * both markers stripped, the completion reason if the session ended,
 * and the suggested next module (state OR theme) if the AI included
 * a valid one.
 */
export function detectCompletion(assistantText: string): StateCompletionResult {
  const suggestedModule = extractSuggestion(assistantText);
  const completionMatch = assistantText.match(SESSION_COMPLETE_MARKER_RE);

  // Strip BOTH markers from what the reader sees.
  const visibleText = assistantText
    .replace(SESSION_COMPLETE_MARKER_RE, '')
    .replace(SUGGEST_MARKER_RE, '')
    .trimEnd();

  if (!completionMatch) {
    return { completed: false, visibleText, suggestedModule };
  }

  const reason = completionMatch[1].toLowerCase() as StateCompletionReason;
  return { completed: true, reason, visibleText, suggestedModule };
}
