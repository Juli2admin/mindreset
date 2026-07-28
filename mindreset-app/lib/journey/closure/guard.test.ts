// Deterministic code tests for the scale-semantics + closure-gating repair
// (2026-07-28). These are pure-function tests of the guard and the parser —
// no model involved. Model-behaviour regression fixtures live separately in
// eval/journey/fixtures/reg-*.json (live harness, non-deterministic).
//
// Numbering follows the owner's Step-8 test list.

import { describe, expect, it } from 'vitest';
import {
  applyClosureGate,
  evaluateClosureGate,
  failSafeClosureGate,
  findDestabilisation,
  claimsClosure,
  STABILITY_CLOSE_THRESHOLD,
  DESTABILISATION_INTENSITY,
  MAX_MEASUREMENT_AGE_MS,
  MAX_CLOCK_SKEW_MS,
  type ClosureTurn,
} from './guard';
import { parseStateReport } from '../stateReport/parse';
import type { StateReport } from '../stateReport/schema';

const T0 = new Date('2026-07-28T10:00:00.000Z'); // session start
const SPIKE = new Date('2026-07-28T10:10:00.000Z'); // destabilisation
const AFTER = new Date('2026-07-28T10:20:00.000Z'); // post-intervention

// Repair A1: every report that reaches the guard through the runtime carries
// a SERVER-stamped `observedAt` on its measurements. `base()` simulates that
// so hand-built reports exercise the same shape the parser produces. Tests
// that need the untrusted/legacy shape set `observedAt: undefined` explicitly.
const base = (o: Partial<StateReport> = {}, observedAt: Date = AFTER): StateReport => {
  const r = {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...o,
  } as StateReport;
  if (r.stabilityCheck && !('observedAt' in r.stabilityCheck)) {
    r.stabilityCheck = { ...r.stabilityCheck, observedAt: observedAt.toISOString() };
  }
  return r;
};

const calmHistory: ClosureTurn[] = [
  { n: 1, createdAt: T0, intensity: 3, safetyFlag: 'none' },
];
const spikedHistory: ClosureTurn[] = [
  { n: 1, createdAt: T0, intensity: 3, safetyFlag: 'none' },
  { n: 2, createdAt: SPIKE, intensity: 8, safetyFlag: 'watch' },
];

const report = (raw: object, observedAt: Date = AFTER): StateReport =>
  parseStateReport(JSON.stringify(raw), { observedAt });

describe('threshold + trigger constants match the methodology', () => {
  it('close threshold is 6 and destabilisation trigger is 6', () => {
    // journey-master.md:344-345 ("6 or above" / "below 6"), :340 (intensity >= 6)
    expect(STABILITY_CLOSE_THRESHOLD).toBe(6);
    expect(DESTABILISATION_INTENSITY).toBe(6);
  });
});

describe('T1 — "I am at 8" meaning distress is stored as distress, not stability', () => {
  it('distressIntensity is populated and stabilityCheck is untouched', () => {
    const r = report({
      intensity: 8,
      safetyFlag: 'watch',
      recommendedAction: 'stay',
      distressIntensity: { score: 8, source: 'user_reported' },
    });
    expect(r.distressIntensity?.score).toBe(8);
    expect(r.distressIntensity?.source).toBe('user_reported');
    expect(r.stabilityCheck).toBeUndefined();
  });
});

describe('T2 — ambiguous number creates no closure-valid stability value', () => {
  it('a score without an explicit scale marker is recorded as ambiguous', () => {
    const r = report({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      stabilityCheck: { score: 3, contextNote: 'user said "maybe a 3"' },
    });
    expect(r.stabilityCheck?.score).toBe(3);
    expect(r.stabilityCheck?.scale).toBe('ambiguous');
  });

  it('and it cannot validate a closure after destabilisation', () => {
    const r = base({
      cycleCanClose: true,
      stabilityCheck: { score: 8, scale: 'ambiguous', measuredAt: AFTER.toISOString() },
    });
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('ambiguous_scale');
  });
});

describe('T3 — explicit groundedness 7 is stored as stability and can pass', () => {
  it('parses with scale=stability and passes the gate', () => {
    const r = report({
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      stabilityCheck: {
        score: 7,
        scale: 'stability',
        source: 'user_reported',
        measuredAt: AFTER.toISOString(),
      },
    });
    expect(r.stabilityCheck?.scale).toBe('stability');
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('passed');
    expect(g.reasons).toEqual([]);
  });
});

describe('T4 — distress falling 8 -> 3 is not mislabelled as stability 3', () => {
  it('distress 3 alone leaves no stability measurement and blocks closure', () => {
    const r = report({
      intensity: 3,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      distressIntensity: { score: 3, source: 'user_reported' },
    });
    expect(r.distressIntensity?.score).toBe(3);
    expect(r.stabilityCheck).toBeUndefined();
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('no_stability_measurement');
  });

  it('the guard never derives stability from distress (no 11 - x)', () => {
    const r = base({ cycleCanClose: true, distressIntensity: { score: 3 } });
    const { report: out } = applyClosureGate(r, spikedHistory, AFTER);
    expect(out.stabilityCheck).toBeUndefined();
    expect(out.cycleCanClose).toBe(false);
  });
});

describe('T5 — exit below threshold: allowed, but not recorded as resolved', () => {
  it('cycle stays open and the block reason is recorded', () => {
    const r = base({
      intensity: 8,
      safetyFlag: 'watch',
      cycleStatus: 'closed',
      cycleCanClose: true,
      stabilityCheck: {
        score: 3,
        scale: 'stability',
        source: 'user_reported',
        measuredAt: AFTER.toISOString(),
      },
    });
    const { report: out, gate } = applyClosureGate(r, spikedHistory, AFTER);
    expect(gate.outcome).toBe('blocked');
    expect(gate.reasons).toContain('below_threshold');
    // Exit is not prevented — only the "resolved" record is refused.
    expect(out.cycleCanClose).toBe(false);
    expect(out.cycleStatus).toBe('open');
    expect(out.closureGate?.outcome).toBe('blocked');
  });
});

describe('T6 — grounding then a valid re-check passes the gate', () => {
  it('post-intervention stability 7 on the stability scale closes cleanly', () => {
    const r = base({
      intensity: 4,
      cycleCanClose: true,
      cycleStatus: 'closed',
      stabilityCheck: {
        score: 7,
        scale: 'stability',
        source: 'user_reported',
        measuredAt: AFTER.toISOString(),
      },
      presentingRequestStatus: 'addressed',
    });
    const { report: out, gate } = applyClosureGate(r, spikedHistory, AFTER);
    expect(gate.outcome).toBe('passed');
    expect(out.cycleStatus).toBe('closed');
    expect(out.cycleCanClose).toBe(true);
  });
});

describe('T7 — proportionality: mild conversation is untouched', () => {
  it('no destabilisation => gate is not applicable and closure stands', () => {
    const r = base({ intensity: 3, cycleCanClose: true, cycleStatus: 'closed' });
    const { report: out, gate } = applyClosureGate(r, calmHistory, AFTER);
    expect(gate.outcome).toBe('not_applicable');
    expect(out.cycleStatus).toBe('closed');
    expect(out.cycleCanClose).toBe(true);
    expect(out.closureGate).toBeUndefined();
  });

  it('a turn that claims nothing is never evaluated', () => {
    expect(claimsClosure(base({}))).toBe(false);
    expect(evaluateClosureGate(base({}), spikedHistory, AFTER).outcome).toBe('not_applicable');
  });
});

describe('T8 — legacy ambiguous record is not accepted as validated', () => {
  it('a pre-repair stabilityCheck (no scale marker) blocks closure', () => {
    const legacy = base({
      cycleCanClose: true,
      // exactly what old rows contain: score + contextNote only
      stabilityCheck: { score: 9, contextNote: 'user departed at high intensity' },
    });
    const g = evaluateClosureGate(legacy, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('ambiguous_scale');
  });
});

describe('T9 — one ambiguous statement cannot populate both fields', () => {
  it('a single number lands in exactly one field, and stability stays ambiguous', () => {
    const r = report({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      distressIntensity: { score: 8, source: 'user_reported' },
      stabilityCheck: { score: 8, source: 'user_reported' },
    });
    // Both may be emitted, but the stability one is not trusted without a
    // scale marker — so it can never silently double as a closure value.
    expect(r.distressIntensity?.score).toBe(8);
    expect(r.stabilityCheck?.scale).toBe('ambiguous');
    const g = evaluateClosureGate({ ...r, cycleCanClose: true }, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('ambiguous_scale');
  });
});

describe('T10 — a measurement predating the spike cannot validate closure', () => {
  it('stale stability reading is rejected until a new one exists', () => {
    const stale = base({
      cycleCanClose: true,
      stabilityCheck: {
        score: 8,
        scale: 'stability',
        source: 'user_reported',
        measuredAt: T0.toISOString(), // before SPIKE
      },
    });
    const g = evaluateClosureGate(stale, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('measurement_predates_destabilisation');

    const fresh = base({
      cycleCanClose: true,
      stabilityCheck: {
        score: 8,
        scale: 'stability',
        source: 'user_reported',
        measuredAt: AFTER.toISOString(),
      },
    });
    expect(evaluateClosureGate(fresh, spikedHistory, AFTER).outcome).toBe('passed');
  });
});

describe('presenting work must not be falsely resolved', () => {
  it('unresolved presenting request blocks a resolved-closure record', () => {
    const r = base({
      cycleCanClose: true,
      stabilityCheck: {
        score: 8,
        scale: 'stability',
        source: 'user_reported',
        measuredAt: AFTER.toISOString(),
      },
      presentingRequestStatus: 'unresolved',
    });
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('presenting_request_unresolved');
  });

  it('explicitly parked work is an honest close', () => {
    const r = base({
      cycleCanClose: true,
      stabilityCheck: {
        score: 8,
        scale: 'stability',
        source: 'user_reported',
        measuredAt: AFTER.toISOString(),
      },
      presentingRequestStatus: 'parked',
    });
    expect(evaluateClosureGate(r, spikedHistory, AFTER).outcome).toBe('passed');
  });
});

describe('destabilisation detection', () => {
  it('detects intensity >= 6 and watch/red_flag, ignores calm sessions', () => {
    expect(findDestabilisation(calmHistory)).toBeNull();
    expect(findDestabilisation(spikedHistory)?.intensity).toBe(8);
    expect(
      findDestabilisation([{ n: 1, createdAt: T0, intensity: 4, safetyFlag: 'red_flag' }]),
    ).not.toBeNull();
  });

  it('the current turn can itself be the destabilisation event', () => {
    expect(findDestabilisation(calmHistory, 8, 'watch')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Repair A1 — timestamp trust boundary.
//
// Rule under test: a model-generated timestamp is never the sole basis for a
// closure decision. Ordering is established by the SERVER stamp (`observedAt`,
// written by parseStateReport); the model's `measuredAt` is untrusted metadata
// that can only make the guard stricter.
// ---------------------------------------------------------------------------
describe('A1 — the server stamp is trusted, the model claim is not', () => {
  const validStability = (extra: Record<string, unknown> = {}) => ({
    score: 8,
    scale: 'stability',
    source: 'user_reported',
    ...extra,
  });

  it('the model cannot supply or overwrite observedAt — parse always stamps it', () => {
    const r = report({
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      stabilityCheck: {
        ...validStability(),
        // A model trying to forge the trusted field.
        observedAt: '2099-01-01T00:00:00.000Z',
      },
    });
    expect(r.stabilityCheck?.observedAt).toBe(AFTER.toISOString());
  });

  it('MISSING model timestamp: closure still rests on the server stamp', () => {
    const r = report({
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      stabilityCheck: validStability(), // no measuredAt at all
    });
    expect(r.stabilityCheck?.measuredAt).toBeUndefined();
    expect(r.stabilityCheck?.observedAt).toBe(AFTER.toISOString());
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('passed');
  });

  it('MISSING server stamp: ordering is unverifiable, closure is blocked', () => {
    // A report that did not come through the trusted parse path (legacy row,
    // hand-built object, future refactor that forgets to stamp).
    const r = base({
      cycleCanClose: true,
      stabilityCheck: { ...validStability(), observedAt: undefined } as never,
    });
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('untrusted_timestamp');
  });

  it('FUTURE model timestamp is treated as fabricated and blocks closure', () => {
    const r = report({
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      stabilityCheck: validStability({
        measuredAt: new Date(AFTER.getTime() + MAX_CLOCK_SKEW_MS + 60_000).toISOString(),
      }),
    });
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('implausible_timestamp');
  });

  it('small clock skew on the model claim is tolerated', () => {
    const r = report({
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      stabilityCheck: validStability({
        measuredAt: new Date(AFTER.getTime() + 30_000).toISOString(),
      }),
    });
    expect(evaluateClosureGate(r, spikedHistory, AFTER).outcome).toBe('passed');
  });

  it('STALE model timestamp (far older than this turn) blocks closure', () => {
    const r = report({
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      stabilityCheck: validStability({
        // Post-destabilisation, but claimed hours before this turn.
        measuredAt: new Date(AFTER.getTime() - MAX_MEASUREMENT_AGE_MS - 60_000).toISOString(),
      }),
    });
    const g = evaluateClosureGate(
      r,
      [{ n: 1, createdAt: new Date(AFTER.getTime() - 5 * 60 * 60 * 1000), intensity: 8 }],
      AFTER,
    );
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('stale_measurement');
  });

  it('COPIED-FROM-EARLIER-TURN timestamp (pre-spike) blocks closure', () => {
    const r = report({
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      stabilityCheck: validStability({ measuredAt: T0.toISOString() }), // before SPIKE
    });
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('measurement_predates_destabilisation');
  });

  it('MALFORMED model timestamp is recorded and ignored, never trusted', () => {
    const r = report({
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      stabilityCheck: validStability({ measuredAt: 'yesterday-ish' }),
    });
    // Not stored as a date; flagged so the Inspector can show it.
    expect(r.stabilityCheck?.measuredAt).toBeUndefined();
    expect(r.stabilityCheck?.measuredAtRejected).toBe(true);
    // Validity rests on the server stamp — the garbage claim neither
    // validates nor is silently swallowed.
    expect(evaluateClosureGate(r, spikedHistory, AFTER).outcome).toBe('passed');
  });

  it('a forged claim cannot rescue a measurement taken before the spike', () => {
    // Server stamp says this report was read BEFORE the destabilisation
    // (clock/ordering anomaly); a helpful-looking model claim must not fix it.
    const r = report(
      {
        intensity: 4,
        safetyFlag: 'none',
        recommendedAction: 'stay',
        cycleCanClose: true,
        stabilityCheck: validStability({ measuredAt: AFTER.toISOString() }),
      },
      T0, // observedAt = before SPIKE
    );
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('measurement_predates_destabilisation');
  });

  it('distressIntensity carries the same trust split', () => {
    const r = report({
      intensity: 8,
      safetyFlag: 'watch',
      recommendedAction: 'stay',
      distressIntensity: { score: 8, source: 'user_reported', measuredAt: 'not-a-date' },
    });
    expect(r.distressIntensity?.observedAt).toBe(AFTER.toISOString());
    expect(r.distressIntensity?.measuredAt).toBeUndefined();
    expect(r.distressIntensity?.measuredAtRejected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Repair A2 — guard failure must fail SAFE, not open.
//
// Rule under test: when the guard cannot run (history load throws, prior state
// is malformed, the gate itself throws) the model's closure claim is not
// trusted. The cycle is preserved as open with an observable reason. None of
// this touches the user's reply or their ability to leave.
// ---------------------------------------------------------------------------
describe('A2 — guard failures do not degrade to the model claim', () => {
  const claiming = () =>
    base({
      cycleStatus: 'closed',
      cycleCanClose: true,
      stabilityCheck: { score: 9, scale: 'stability', measuredAt: AFTER.toISOString() },
    });

  it('history load failure: closure is recorded as unverified, not resolved', () => {
    const { report: out, gate } = failSafeClosureGate(
      claiming(),
      'history_unavailable',
      'connection terminated',
    );
    expect(gate.outcome).toBe('blocked');
    expect(gate.reasons).toContain('history_unavailable');
    expect(gate.reasons).toContain('closure_unverified');
    expect(out.cycleCanClose).toBe(false);
    expect(out.cycleStatus).toBe('open');
    expect(out.closureGate?.outcome).toBe('blocked');
  });

  it('guard exception: same fail-safe downgrade with guard_error', () => {
    const { report: out, gate } = failSafeClosureGate(claiming(), 'guard_error', 'boom');
    expect(gate.reasons).toEqual(['guard_error', 'closure_unverified']);
    expect(gate.detail).toContain('boom');
    expect(out.cycleCanClose).toBe(false);
    expect(out.cycleStatus).toBe('open');
  });

  it('the fail-safe path never mutates the input report', () => {
    const input = claiming();
    failSafeClosureGate(input, 'guard_error', 'boom');
    expect(input.cycleCanClose).toBe(true);
    expect(input.cycleStatus).toBe('closed');
  });

  it('malformed history object (not an array) blocks rather than passes', () => {
    const g = evaluateClosureGate(
      claiming(),
      undefined as unknown as ClosureTurn[],
      AFTER,
    );
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('history_unavailable');
    expect(g.reasons).toContain('closure_unverified');
  });

  it('malformed prior-turn timestamp cannot be ordered and blocks closure', () => {
    const g = evaluateClosureGate(
      claiming(),
      [{ n: 1, createdAt: 'not-a-date', intensity: 8, safetyFlag: 'watch' }],
      AFTER,
    );
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('closure_unverified');
  });

  it('a non-closure turn is never touched by any of this', () => {
    const quiet = base({ intensity: 3 });
    const g = evaluateClosureGate(quiet, undefined as unknown as ClosureTurn[], AFTER);
    expect(g.outcome).toBe('not_applicable');
  });
});

// ---------------------------------------------------------------------------
// Repair A3 — presentingRequestStatus is ADVISORY ONLY (option B).
//
// Decision 2026-07-28: presenting-request completion is NOT verified by
// Repair 1. The field is an unverified model claim, so it may only ever make
// the guard stricter. Absent / 'addressed' / 'parked' / invalid values grant
// no confidence and are not treated as evidence of anything.
// ---------------------------------------------------------------------------
describe('A3 — presentingRequestStatus grants no confidence', () => {
  const withStatus = (status?: unknown) => {
    const raw: Record<string, unknown> = {
      intensity: 4,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      cycleCanClose: true,
      stabilityCheck: { score: 8, scale: 'stability', source: 'user_reported' },
    };
    if (status !== undefined) raw.presentingRequestStatus = status;
    return report(raw);
  };

  it('ABSENT: gate outcome is decided purely by the stability evidence', () => {
    const r = withStatus();
    expect(r.presentingRequestStatus).toBeUndefined();
    expect(evaluateClosureGate(r, spikedHistory, AFTER).outcome).toBe('passed');
    // ...and absence is equally irrelevant when stability is missing:
    const noStability = base({ cycleCanClose: true });
    expect(evaluateClosureGate(noStability, spikedHistory, AFTER).reasons).toContain(
      'no_stability_measurement',
    );
  });

  it('ADDRESSED: is recorded but adds no validation of its own', () => {
    const r = withStatus('addressed');
    expect(r.presentingRequestStatus).toBe('addressed');
    // Identical outcome to ABSENT — the claim changed nothing.
    expect(evaluateClosureGate(r, spikedHistory, AFTER).outcome).toBe('passed');
    // And it cannot rescue a closure that fails on stability grounds.
    const weak = base({
      cycleCanClose: true,
      presentingRequestStatus: 'addressed',
      stabilityCheck: { score: 3, scale: 'stability', measuredAt: AFTER.toISOString() },
    });
    const g = evaluateClosureGate(weak, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('below_threshold');
  });

  it('PARKED: same as addressed — honest close, no extra confidence', () => {
    expect(evaluateClosureGate(withStatus('parked'), spikedHistory, AFTER).outcome).toBe(
      'passed',
    );
  });

  it('UNRESOLVED: the one value with an effect — it tightens the guard', () => {
    const g = evaluateClosureGate(withStatus('unresolved'), spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('presenting_request_unresolved');
  });

  it('INVALID: an unknown value is dropped, never coerced to a status', () => {
    for (const bad of ['done', 'complete', 42, true, null, { v: 'addressed' }]) {
      const r = withStatus(bad);
      expect(r.presentingRequestStatus).toBeUndefined();
      // Dropped, not coerced to 'unresolved' either — it simply has no effect.
      expect(evaluateClosureGate(r, spikedHistory, AFTER).outcome).toBe('passed');
    }
  });
});

describe('regression: the two confirmed live failures are now caught', () => {
  it('panic recorded as stability 9 does not validate closure', () => {
    // Phase 2 Part 1, s6-insists-leaving rep1 T2: user in panic, score 9.
    const r = base({
      intensity: 9,
      safetyFlag: 'watch',
      cycleCanClose: true,
      stabilityCheck: { score: 9, contextNote: 'user departed mid-stabilisation' },
    });
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    expect(g.reasons).toContain('ambiguous_scale');
  });

  it('calm user saying "distress 3" is not recorded as stability 3 closing', () => {
    // Phase 2 Part 2, m1 T81: "steady. A 3, maybe" -> stored as stability 3.
    const r = base({
      intensity: 3,
      cycleCanClose: true,
      stabilityCheck: { score: 3, contextNote: 'user self-reported steady' },
    });
    const g = evaluateClosureGate(r, spikedHistory, AFTER);
    expect(g.outcome).toBe('blocked');
    // both defects fire: unmarked scale AND a below-threshold stability value
    expect(g.reasons).toContain('ambiguous_scale');
    expect(g.reasons).toContain('below_threshold');
  });
});
