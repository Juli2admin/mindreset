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
import { SESSION_BOUNDARY_MS } from '../state/load';
import { MAX_MEASUREMENT_AGE_MS } from './measurement-age';

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

/**
 * Repair A1 (2026-07-28) — timestamp trust boundary.
 *
 * `stabilityCheck.observedAt` is stamped by the server at parse time and is
 * the ONLY timestamp used to establish that a measurement post-dates the
 * destabilisation. `stabilityCheck.measuredAt` is whatever the model wrote;
 * it is untrusted and can only ever make this guard STRICTER:
 *   - claimed before the destabilisation  -> copy-forward, block
 *   - claimed in the future               -> fabricated, block
 *   - claimed far older than this turn    -> stale/copied, block
 * A missing or malformed model claim is simply ignored; validity then rests
 * entirely on the server-side stamp, never on model output.
 */
/**
 * How far the model's claimed measurement time may lag the server stamp.
 *
 * Defined in ./measurement-age.ts and re-exported here so every existing
 * import site keeps working; see that file for why it had to move. Value and
 * meaning are unchanged.
 */
export { MAX_MEASUREMENT_AGE_MS };
/** Tolerance for benign clock differences before a claim counts as future-dated. */
export const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000; // 2 minutes

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
  /**
   * The number is marked as a stability reading, but it is the CLINICIAN's
   * own estimate rather than the user's answer to the explicit stability
   * question. Live validation caught the model deriving "stability 7" from
   * a user's distress 3 and stamping it `scale: "stability"` — a model
   * self-assertion, which is exactly what this guard must not trust.
   */
  | 'unverified_scale_source'
  | 'below_threshold'
  | 'measurement_predates_destabilisation'
  // Repair A1 — timestamp trust.
  /** No trusted server-side observation stamp; ordering cannot be verified. */
  | 'untrusted_timestamp'
  /** The model claimed a measurement time in the future. */
  | 'implausible_timestamp'
  /** The model's claimed measurement time is far older than this turn. */
  | 'stale_measurement'
  | 'presenting_request_unresolved'
  // Repair A2 — fail-safe error paths.
  /** Session history could not be loaded, so destabilisation is unknown. */
  | 'history_unavailable'
  /** The guard threw; its verdict is unavailable. */
  | 'guard_error'
  /** Umbrella marker: the runtime could not verify this closure. */
  | 'closure_unverified';

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
 * Narrow a raw history window to THE CURRENT SESSION.
 *
 * Review finding B1 (2026-07-28). The runtime hands the guard the last 30
 * audit turns for the user (`loadRecentTurns`), which has no session filter.
 * Without this, a spike from days ago still counts as "the session
 * destabilised", so a later calm session's ordinary close is blocked with
 * `no_stability_measurement`. That contradicts the protocol the guard
 * enforces — journey-master.md:340 says "DESTABILISED **in this session**" —
 * and the proportionality rule below.
 *
 * Uses the same walk and the same threshold as the rest of the codebase
 * (`SESSION_BOUNDARY_MS`, lib/journey/state/load.ts): walk newest-first from
 * this turn and stop at the first gap of 4h or more.
 */
export function currentSessionTurns(
  turns: ClosureTurn[],
  turnAtMs: number,
): ClosureTurn[] {
  const newestFirst = turns.slice().sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  const out: ClosureTurn[] = [];
  let prevMs = turnAtMs;
  for (const t of newestFirst) {
    const tMs = ms(t.createdAt);
    // A turn we cannot place in time is KEPT rather than dropped: it may be
    // a destabilisation, and losing it would be the fail-open direction.
    // It surfaces downstream as `closure_unverified`.
    if (Number.isFinite(tMs) && Number.isFinite(prevMs) && prevMs - tMs >= SESSION_BOUNDARY_MS) {
      break;
    }
    out.push(t);
    if (Number.isFinite(tMs)) prevMs = tMs;
  }
  return out;
}

/**
 * Find the most recent destabilisation event in the session, if any.
 * Returns null when the session never destabilised — in which case the
 * guard stays out of the way entirely (proportionality: mild
 * conversations must not acquire a mechanical scale check).
 *
 * `currentTurnAt` is the trusted server timestamp for THIS turn. Review
 * finding B2 (2026-07-28): it used to be `new Date()` taken at guard time,
 * which is always later than the parse-time `observedAt` stamped on the
 * measurement — so a turn that was itself the first destabilisation blocked
 * its own valid same-turn stability reading with
 * `measurement_predates_destabilisation`. Both timestamps must come from the
 * same instant.
 */
export function findDestabilisation(
  turns: ClosureTurn[],
  currentIntensity?: number | null,
  currentSafetyFlag?: string | null,
  currentTurnAt: Date | string = new Date(),
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
    return {
      n: -1,
      createdAt: currentTurnAt,
      intensity: currentIntensity ?? null,
      safetyFlag: currentSafetyFlag ?? null,
    };
  }
  return latest;
}

/**
 * Evaluate whether this turn may record a safely-closed cycle.
 *
 * `turnAt` is the TRUSTED server timestamp for this turn — the same instant
 * `parseStateReport` stamped onto the measurement as `observedAt`. The
 * runtime passes it explicitly so one clock reading governs the whole turn.
 * It anchors two things and nothing else:
 *   - the session-boundary walk that narrows `priorTurns` to this session;
 *   - the synthetic destabilisation event when THIS turn is the spike.
 * It is never a fallback for a missing measurement timestamp; a measurement
 * with no trusted `observedAt` is blocked, not assumed to be from now.
 */
export function evaluateClosureGate(
  report: StateReport,
  priorTurns: ClosureTurn[],
  turnAt: Date = new Date(),
): ClosureGateResult {
  const none: ClosureGateResult = {
    outcome: 'not_applicable',
    reasons: [],
    detail: 'no closure claimed this turn',
    destabilisedAt: null,
  };

  if (!claimsClosure(report)) return none;

  // Repair A2. Malformed history is not "no destabilisation" — it is
  // *unknown*, and unknown must never validate a closure.
  if (!Array.isArray(priorTurns)) {
    return {
      outcome: 'blocked',
      reasons: ['history_unavailable', 'closure_unverified'],
      detail: 'closure not recorded as resolved: session history unavailable',
      destabilisedAt: null,
    };
  }

  // B1: only THIS session's turns can arm the guard.
  const sessionTurns = currentSessionTurns(priorTurns, turnAt.getTime());
  const destab = findDestabilisation(
    sessionTurns,
    report.intensity,
    report.safetyFlag,
    turnAt,
  );
  if (!destab) {
    return {
      outcome: 'not_applicable',
      reasons: [],
      detail: 'closure claimed; session never destabilised — no stability check required',
      destabilisedAt: null,
    };
  }

  const destabAt = iso(destab.createdAt);
  const destabMs = ms(destab.createdAt);
  const reasons: ClosureBlockReason[] = [];
  const sc = report.stabilityCheck;

  // A destabilisation we cannot place in time cannot be ordered against.
  if (!Number.isFinite(destabMs)) reasons.push('closure_unverified');

  if (!sc) {
    reasons.push('no_stability_measurement');
  } else {
    // Legacy rows (written before this repair) carry no `scale` marker and
    // are therefore semantically ambiguous — never trusted as validated.
    if (sc.scale !== 'stability') reasons.push('ambiguous_scale');
    // A stability reading only counts when the USER gave it. The prompt says
    // to set `scale: "stability"` only after the explicit stability question;
    // when the clinician estimates instead, the honest record is `ambiguous`.
    // Enforced here so a mislabelled estimate cannot validate a close.
    else if (sc.source !== 'user_reported') reasons.push('unverified_scale_source');
    if (typeof sc.score !== 'number' || sc.score < STABILITY_CLOSE_THRESHOLD) {
      reasons.push('below_threshold');
    }

    // --- Repair A1: trusted ordering, server stamp only -----------------
    const observedMs = sc.observedAt ? Date.parse(sc.observedAt) : NaN;
    if (!Number.isFinite(observedMs)) {
      // No server stamp => this report did not come through the trusted
      // parse path (or is a legacy row). Ordering is unverifiable.
      reasons.push('untrusted_timestamp');
    } else if (Number.isFinite(destabMs) && observedMs < destabMs) {
      reasons.push('measurement_predates_destabilisation');
    }

    // --- Repair A1: untrusted model claim, may only tighten -------------
    if (typeof sc.measuredAt === 'string') {
      const claimedMs = Date.parse(sc.measuredAt);
      if (Number.isFinite(claimedMs)) {
        if (Number.isFinite(destabMs) && claimedMs < destabMs) {
          // The model itself says this reading predates the spike —
          // a measurement carried forward from before the destabilisation.
          reasons.push('measurement_predates_destabilisation');
        }
        if (Number.isFinite(observedMs)) {
          if (claimedMs > observedMs + MAX_CLOCK_SKEW_MS) {
            reasons.push('implausible_timestamp');
          } else if (claimedMs < observedMs - MAX_MEASUREMENT_AGE_MS) {
            reasons.push('stale_measurement');
          }
        }
      }
    }
    // A malformed claim (measuredAtRejected) is ignored rather than
    // trusted: validity rests on the server stamp above, so a garbled
    // model timestamp can neither validate nor, on its own, invalidate.
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

  const unique = Array.from(new Set(reasons));
  return {
    outcome: 'blocked',
    reasons: unique,
    detail: `closure not recorded as resolved: ${unique.join(', ')}`,
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
  turnAt: Date = new Date(),
): { report: StateReport; gate: ClosureGateResult } {
  const gate = evaluateClosureGate(report, priorTurns, turnAt);
  if (gate.outcome !== 'blocked') return { report, gate };
  return { report: withBlockedGate(report, gate), gate };
}

/**
 * Downgrade a closure claim to the honest "not verified as resolved" state.
 * The reply the user already received is untouched; only the record changes.
 */
function withBlockedGate(report: StateReport, gate: ClosureGateResult): StateReport {
  return {
    ...report,
    cycleCanClose: false,
    // 'closed' would assert resolution; downgrade to the honest state.
    cycleStatus: report.cycleStatus === 'closed' ? 'open' : report.cycleStatus,
    closureGate: gate,
  };
}

/**
 * Repair A2 (2026-07-28) — fail-safe path for when the guard cannot run.
 *
 * Called by the runtime when loading session history throws, or when the
 * gate itself throws. Clinical closure recording must not fail open: on any
 * uncertainty the model's `cycleCanClose: true` / `cycleStatus: 'closed'`
 * is NOT trusted, and the cycle is preserved as open with an observable
 * reason. This never blocks the user's reply, their exit, or the HTTP turn —
 * by the time it runs the response has already streamed.
 */
export function failSafeClosureGate(
  report: StateReport,
  reason: 'history_unavailable' | 'guard_error',
  detail: string,
): { report: StateReport; gate: ClosureGateResult } {
  const gate: ClosureGateResult = {
    outcome: 'blocked',
    reasons: [reason, 'closure_unverified'],
    detail: `closure not recorded as resolved: ${reason} (${detail})`,
    destabilisedAt: null,
  };
  return { report: withBlockedGate(report, gate), gate };
}
