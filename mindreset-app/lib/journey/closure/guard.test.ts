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
  findDestabilisation,
  claimsClosure,
  STABILITY_CLOSE_THRESHOLD,
  DESTABILISATION_INTENSITY,
  type ClosureTurn,
} from './guard';
import { parseStateReport } from '../stateReport/parse';
import type { StateReport } from '../stateReport/schema';

const T0 = new Date('2026-07-28T10:00:00.000Z'); // session start
const SPIKE = new Date('2026-07-28T10:10:00.000Z'); // destabilisation
const AFTER = new Date('2026-07-28T10:20:00.000Z'); // post-intervention

const base = (o: Partial<StateReport> = {}): StateReport =>
  ({ intensity: 4, safetyFlag: 'none', recommendedAction: 'stay', ...o }) as StateReport;

const calmHistory: ClosureTurn[] = [
  { n: 1, createdAt: T0, intensity: 3, safetyFlag: 'none' },
];
const spikedHistory: ClosureTurn[] = [
  { n: 1, createdAt: T0, intensity: 3, safetyFlag: 'none' },
  { n: 2, createdAt: SPIKE, intensity: 8, safetyFlag: 'watch' },
];

const report = (raw: object): StateReport =>
  parseStateReport(JSON.stringify(raw));

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
