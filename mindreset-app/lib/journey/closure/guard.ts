// Technical closure guard — repair 2026-07-28 (scale semantics + closure gating).
//
// WHY THIS EXISTS
// ---------------
// Phase-2 validation (eval/journey/runs/PHASE2-PART*-REPORT.md) found two
// linked defects:
//   1. The model copies a user's volunteered DISTRESS number straight into
//      `stabilityCheck.score`, which is a STABILITY scale running the other
//      way. A panicking user was recorded as stability 9; a calm user who
//      said "distress is a 3" was recorded as stability 3.
//   2. Nothing in code gated closure. `stabilityCheck` was parsed and stored
//      but never consulted; the only closure-adjacent enforcement was the
//      open-cycle *stage-advancement* guard in the router.
// Clinical decisions in testing were nonetheless correct every time — the
// damage was to the structured record, and to any future enforcement built
// on it. This module supplies that enforcement, at the point where the
// runtime records a cycle as closable/closed.
//
// WHAT IT DOES *NOT* DO
// ---------------------
// It never blocks the user from leaving, never blocks the HTTP response,
// and never changes the reply the user already received. It only decides
// whether the system is allowed to *record* a safe closure. A user who
// walks out mid-spike gets their exit; the cycle is recorded as an
// unresolved pause, which is the honest state.
//
// It also never converts one scale into the other (no `11 - distress`).
// The methodology does not define distress and stability as exact
// inverses, so an unqualified number is treated as ambiguous and must be
// clarified with the user before it can validate a closure.

import type { StateReport } from '../stateReport/schema';

/**
 * Stability threshold for a permitted close.
 * Source of truth: docs/journey/runtime/journey-master.md:344-345 ("6 or
 * above -> close is permitted", "below 6 -> DO NOT close"), :687, :887.
 */
export const STABILITY_CLOSE_THRESHOLD = 6;

/**
 * Structured destabilisation trigger.
 * Prompt (:340) also lists prose markers (headache, dizziness, weak hands,
 * body-shutdown, foggy, dissociative edge, overwhelm). Those live in the
 * user's words, not in structured fields, so code cannot detect them
 * reliably; the clinician remains responsible for them. Code enforces the
 * two signals it can verify: the clinician's own intensity read and the
 * safety flag.
 */
export const DESTABILISATION_INTENSITY = 6;

export type ClosureTurn = {
  /** 1-based turn number within the session (ordering only). */
  n: number;
  createdAt: Date | string;
  intensity?: number | null;
  safetyFlag?: string | null;
  cycleStatus?: string | null;
};

export type ClosureGateOutcome = 'not_applicable' | 'passed' | 'blocked';

export type ClosureGateResult = {
  outcome: ClosureGateOutcome;
  /** Machine-readable reasons; empty when passed or not applicable. */
  reasons: ClosureBlockReason[];
  /** Human-readable single line for the Inspector. */
  detail: string;
  /** When the session's destabilisation was detected, if any. */
  destabilisedAt: string | null;
};

export type ClosureBlockReason =
  | 'no_stability_measurement'
  | 'ambiguous_scale'
  | 'below_threshold'
  | 'measurement_predates_destabilisation'
  | 'presenting_request_unresolved';

const iso = (d: Date | string): string =>
  typeof d === 'string' ? d : d.toISOString();
const ms = (d: Date | string): number =>
  typeof d === 'string' ? Date.parse(d) : d.getTime();

/**
 * True when the report is asserting that the clinical cycle is finished.
 * Either signal counts: the explicit boolean, or a 'closed' cycleStatus.
 */
export function claimsClosure(report: StateReport): boolean {
  return report.cycleCanClose === true || report.cycleStatus === 'closed';
}

/**
 * Find the most recent destabilisation event in the session, if any.
 * Returns null when the session never destabilised — in which case the
 * guard stays out of the way entirely (proportionality: mild
 * conversations must not acquire a mechanical scale check).
 */
export function findDestabilisation(
  turns: ClosureTurn[],
  currentIntensity?: number | null,
  currentSafetyFlag?: string | null,
): ClosureTurn | null {
  const isDestab = (i?: number | null, f?: string | null): boolean =>
    (typeof i === 'number' && i >= DESTABILISATION_INTENSITY) ||
    f === 'watch' ||
    f === 'red_flag';

  let latest: ClosureTurn | null = null;
  for (const t of turns) {
    if (isDestab(t.intensity, t.safetyFlag)) {
      if (!latest || ms(t.createdAt) >= ms(latest.createdAt)) latest = t;
    }
  }
  // The current turn can itself be the destabilisation event.
  if (!latest && isDestab(currentIntensity, currentSafetyFlag)) {
    return { n: -1, createdAt: new Date(), intensity: currentIntensity ?? null, safetyFlag: currentSafetyFlag ?? null };
  }
  return latest;
}

/**
 * Evaluate whether this turn may record a safely-closed cycle.
 *
 * `now` is injectable for deterministic tests; it defaults to the current
 * time and is used when the model omits `measuredAt` on a measurement
 * taken this turn.
 */
export function evaluateClosureGate(
  report: StateReport,
  priorTurns: ClosureTurn[],
  now: Date = new Date(),
): ClosureGateResult {
  const none: ClosureGateResult = {
    outcome: 'not_applicable',
    reasons: [],
    detail: 'no closure claimed this turn',
    destabilisedAt: null,
  };

  if (!claimsClosure(report)) return none;

  const destab = findDestabilisation(priorTurns, report.intensity, report.safetyFlag);
  if (!destab) {
    return {
      outcome: 'not_applicable',
      reasons: [],
      detail: 'closure claimed; session never destabilised — no stability check required',
      destabilisedAt: null,
    };
  }

  const destabAt = iso(destab.createdAt);
  const reasons: ClosureBlockReason[] = [];
  const sc = report.stabilityCheck;

  if (!sc) {
    reasons.push('no_stability_measurement');
  } else {
    // Legacy rows (written before this repair) carry no `scale` marker and
    // are therefore semantically ambiguous — never trusted as validated.
    if (sc.scale !== 'stability') reasons.push('ambiguous_scale');
    if (typeof sc.score !== 'number' || sc.score < STABILITY_CLOSE_THRESHOLD) {
      reasons.push('below_threshold');
    }
    const measuredAt = sc.measuredAt ? Date.parse(sc.measuredAt) : now.getTime();
    if (Number.isFinite(measuredAt) && measuredAt < ms(destabAt)) {
      reasons.push('measurement_predates_destabilisation');
    }
  }

  if (report.presentingRequestStatus === 'unresolved') {
    reasons.push('presenting_request_unresolved');
  }

  if (reasons.length === 0) {
    return {
      outcome: 'passed',
      reasons: [],
      detail: `stability ${sc?.score}/10 (stability scale) post-destabilisation — closure permitted`,
      destabilisedAt: destabAt,
    };
  }

  return {
    outcome: 'blocked',
    reasons,
    detail: `closure not recorded as resolved: ${reasons.join(', ')}`,
    destabilisedAt: destabAt,
  };
}

/**
 * Apply the gate to a parsed report, in place of trusting the model's own
 * closure claim. Returns a NEW report object; never mutates the input.
 *
 * When blocked, the cycle is recorded as still open (an unresolved pause),
 * which is what the next turn's state block and the router will see. The
 * user is not prevented from leaving — this only governs the record.
 */
export function applyClosureGate(
  report: StateReport,
  priorTurns: ClosureTurn[],
  now: Date = new Date(),
): { report: StateReport; gate: ClosureGateResult } {
  const gate = evaluateClosureGate(report, priorTurns, now);
  if (gate.outcome !== 'blocked') return { report, gate };

  return {
    report: {
      ...report,
      cycleCanClose: false,
      // 'closed' would assert resolution; downgrade to the honest state.
      cycleStatus: report.cycleStatus === 'closed' ? 'open' : report.cycleStatus,
      closureGate: gate,
    },
    gate,
  };
}
