// Pure decision function for the auto-unfreeze path in
// /api/journey/request-review. Kept separate from the route so the safety
// logic can be unit-tested without Prisma / auth / rate-limit mocks.
//
// Design constraints:
//   - Only two freeze sources are eligible for auto-recovery:
//       * `keyword_scan` — the synchronous keyword scanner tripped on the
//         user's message. False positives here (e.g. "I don't want to live
//         with him" before PR #198) lock a real user out.
//       * `state_report` — the main model emitted safetyFlag: red_flag in
//         its own state report. Audit item #7: the main model has no
//         "abuse disclosure ≠ crisis" carve-out and can over-call red_flag.
//   - `verifier` source is NEVER auto-recoverable. If the verifier itself
//     said clear_crisis, re-running is just "reroll the LLM until it says
//     what I want" — dangerous.
//   - `manual` source is NEVER auto-recoverable. Manual freezes are set by
//     an operator; only an operator can lift them.
//   - Verifier verdict on re-check must be `clear_safe`. `ambiguous`,
//     `clear_crisis`, or a failure to reach the verifier all fail closed
//     (stay frozen, fall through to human review).

import type { VerifierVerdict } from './verifier';

// `null` = the verifier didn't run (timeout, network error, missing message
// to re-check, etc.). Kept separate from VerifierVerdict so the caller has
// to think about it explicitly.
export type VerifierOutcome = VerifierVerdict | 'unavailable';

export type UnfreezeDecision =
  | { action: 'auto_unfreeze'; reason: string }
  | { action: 'human_review'; reason: string };

/**
 * Returns whether a frozen user's re-check can auto-unfreeze the Journey.
 * Called by /api/journey/request-review after the verifier has been re-run
 * against the user's most recent message. The frozenReason string is the
 * one composed by freeze.ts:composeReason and always starts with "source:X".
 */
export function evaluateAutoUnfreeze(
  frozenReason: string | null | undefined,
  verifierOutcome: VerifierOutcome,
): UnfreezeDecision {
  const source = extractSource(frozenReason);

  if (source !== 'keyword_scan' && source !== 'state_report') {
    return {
      action: 'human_review',
      reason:
        source === 'verifier'
          ? 'freeze_source_verifier_not_auto_recoverable'
          : source === 'manual'
            ? 'freeze_source_manual_not_auto_recoverable'
            : 'freeze_source_unknown',
    };
  }

  if (verifierOutcome === 'unavailable') {
    return { action: 'human_review', reason: 'verifier_unavailable_fail_closed' };
  }
  if (verifierOutcome !== 'clear_safe') {
    return {
      action: 'human_review',
      reason: `verifier_verdict_${verifierOutcome}`,
    };
  }

  return { action: 'auto_unfreeze', reason: `verifier_clear_safe_source_${source}` };
}

// The reason string is composed as `source:X | type:Y | r:Z` (freeze.ts). We
// only need the source; parse defensively so a mangled reason (or `null`)
// yields `unknown` rather than throwing.
export type ExtractedSource = 'keyword_scan' | 'verifier' | 'state_report' | 'manual' | 'unknown';

export function extractSource(frozenReason: string | null | undefined): ExtractedSource {
  if (!frozenReason) return 'unknown';
  const m = /^source:([a-z_]+)/i.exec(frozenReason);
  if (!m) return 'unknown';
  const s = m[1];
  if (s === 'keyword_scan' || s === 'verifier' || s === 'state_report' || s === 'manual') {
    return s;
  }
  return 'unknown';
}
