// Middle Layer PR 4 (2026-08-13) — shadow observability.
//
// Emits ONE structured line per turn recording what the Middle Layer would
// have licensed. Style matches lib/journey/router/router.ts and
// lib/journey/closure/persist.ts: a bracketed area tag and a flat object of
// codes.
//
// PRIVACY: this log carries NO user content and NO clinical free text. It
// never touches target.phenomenon, target.inTheirTerms, a candidate's
// reading, or any supports/countsAgainst entry — those are the user's
// words and the clinician's reasoning about them, and both are encrypted at
// rest for exactly that reason. What ships is: the userId already logged by
// every sibling log line, closed-set statuses, closed-set reason codes, and
// integer counts. A reviewer can tell WHY a promotion passed or failed
// without ever seeing WHAT the material was.

import type { SufficiencyVerdict } from './sufficiency';

export type SufficiencyShadowLine = {
  userId: string;
  /** Code's verdict on the Target: none | proposed | established. */
  target: string;
  /** Code's verdict on the differential: none | candidate | leading | established. */
  mechanism: string;
  /** Derived, not stored: 1 | 2 | 3. */
  rung: number;
  /** Closed-set codes explaining the Target verdict. */
  targetReasons: string[];
  /** Closed-set codes explaining the mechanism verdict. */
  mechanismReasons: string[];
  /**
   * The §1 conditions code could not decide from the persisted evidence.
   * Non-empty whenever a differential exists — this is the field that keeps
   * the log honest about the difference between "refused" and "disproved".
   */
  missingEvidence: string[];
  /** Structural counts only — how many parts/candidates, never their content. */
  counts: {
    targetPartsPresent: number;
    corroboration: number;
    candidates: number;
    leading: number;
  };
};

/** Builds the log line. Pure and exported so tests can assert its exact shape. */
export function buildSufficiencyShadowLine(
  userId: string,
  verdict: SufficiencyVerdict,
): SufficiencyShadowLine {
  const p = verdict.target.parts;
  return {
    userId,
    target: verdict.target.status,
    mechanism: verdict.mechanism.status,
    rung: verdict.licensedRung,
    targetReasons: [...verdict.target.reasons],
    mechanismReasons: [...verdict.mechanism.reasons],
    missingEvidence: [...verdict.mechanism.undecidable],
    counts: {
      targetPartsPresent:
        (p.phenomenon ? 1 : 0) + (p.inTheirTerms ? 1 : 0) + (p.direction ? 1 : 0),
      corroboration: p.corroborationCount,
      candidates: verdict.mechanism.candidateCount,
      leading: verdict.mechanism.leadingCount,
    },
  };
}

/**
 * Emits the shadow line. `console.info`, not `warn` or `error`: nothing here
 * is a fault, and a Rung 1 derivation for a user with no Target is the
 * expected case, not a problem to be alerted on.
 */
export function logSufficiencyShadow(userId: string, verdict: SufficiencyVerdict): void {
  console.info('[journey/middle-layer] shadow', buildSufficiencyShadowLine(userId, verdict));
}
