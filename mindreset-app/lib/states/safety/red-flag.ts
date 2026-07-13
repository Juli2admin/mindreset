// Synchronous keyword scan for State-module turns.
//
// PR ψ2 (2026-07-13). Runs BEFORE the LLM is called. On a keyword hit
// the LLM is NOT invoked:
//   1. The user's message is persisted.
//   2. The verbatim crisis response goes out.
//   3. The current StateSession is completed with reason='red_flag'.
//
// State modules are shorter, more crisis-adjacent than Journey — a
// person opens the Anxiety module BECAUSE they're anxious. The
// keyword-layer patterns are the same battle-tested set from
// lib/journey/safety/keywords.ts (patterns that survived 2026-07
// live-session tuning). Delegating to the Journey scanner keeps a
// single source of truth for the pattern set — if we improve one, we
// improve the other. Anxiety-specific tuning (if we ever need it)
// can layer on top here.
//
// The AI's own in-prompt safety fallback (see
// lib/states/prompts/anxiety.ts §Safety) is the async net for phrasings
// this synchronous layer misses.

import {
  scanForJourneyRedFlag,
  CRISIS_RESPONSE_EN,
  CRISIS_RESPONSE_RU,
  type RedFlagHit,
  type RedFlagType,
} from '@/lib/journey/safety/keywords';

export type StateRedFlagHit = RedFlagHit;
export type StateRedFlagType = RedFlagType;

/**
 * NFKC-normalises and scans the message for hard crisis markers.
 * Returns { matched: false } for anything the AI + in-prompt safety
 * should handle instead.
 */
export function scanForStateRedFlag(message: string): StateRedFlagHit {
  return scanForJourneyRedFlag(message);
}

/**
 * Localised canned crisis response for a state-module session.
 * The Journey and State surfaces share this copy — it's calibrated
 * for a UK-primary audience with international fallback.
 */
export function getStateCrisisResponseForLocale(
  locale: string | null | undefined,
): string {
  if (locale === 'ru') return CRISIS_RESPONSE_RU;
  return CRISIS_RESPONSE_EN;
}
