// Did a stabilisation action actually occur? Phase 2 (2026-08-08).
//
// DELIVERING_STABILISATION is the one live closure state whose action cannot be
// code-authored — a stabilisation practice is generated from the user's live
// state, words and body signals, and Phase 2's scope explicitly excludes
// stabilisation text. So the clinician performs it, and this module decides
// whether it actually happened before the process is allowed to advance.
//
// CONSTRAIN THEN VERIFY. The pre-LLM note asks; this verifies. An instruction
// alone is what failed on 2026-08-08, so the state does not advance on the
// clinician's say-so — it advances on structured evidence, and stays put
// otherwise.
//
// NOT ANY PRACTICE. The methodology names the stabilising families exactly:
//
//   journey-master.md:309 — "stabilising practice this turn (regulation family
//   for breath/orientation OR somatic family for micro-movement — choose by
//   what the body is doing)"
//
//   journey-master.md:344 — below threshold: "Run another small grounding or
//   micro-movement practice" — the same two families
//
//   journey-master.md:343 — "Mark practiceRun `completed` on the closing
//   grounding move"
//
// A landscape, narrative or compassion practice is real clinical work and is
// not what this state requires; an unfinished or aborted run did not deliver
// the regulation. Both are therefore insufficient here, and saying so is a
// reading of the existing methodology, not a new rule about practices.

import type { StateReport } from '../stateReport/schema';

/** The two families the methodology names as stabilising. */
const STABILISING_FAMILIES = ['regulation', 'somatic'] as const;

export type StabilisationEvidence =
  | { delivered: true; family: string; name: string | null }
  | {
      delivered: false;
      reason: 'no_practice_run' | 'wrong_family' | 'not_completed';
    };

/**
 * Read this turn's report for proof that a stabilising action was delivered.
 * Pure. Deliberately strict: a miss keeps the process where it is and the
 * clinician is asked again, which is the safe direction. A false positive would
 * advance a user who was never stabilised.
 */
export function stabilisationDelivered(report: StateReport): StabilisationEvidence {
  const run = report.practiceRun;
  if (!run || run.kind === 'none') return { delivered: false, reason: 'no_practice_run' };

  const family = run.family;
  if (!family || !(STABILISING_FAMILIES as readonly string[]).includes(family)) {
    return { delivered: false, reason: 'wrong_family' };
  }

  // `started` / `mid` mean in flight; the aborted statuses mean it did not
  // land. Only a completed run is evidence that the regulation was delivered.
  if (run.status !== 'completed') return { delivered: false, reason: 'not_completed' };

  return { delivered: true, family, name: run.name ?? null };
}
