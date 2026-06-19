// Tests for the Stage 4 MII-5 (Basic Reparenting Capacity) check —
// audit P0 #3.
//
// Before the fix: stage-gates.ts:184-189 fell back to
// `adultSelfQualities` (a Stage 3 capture for "the calm older me")
// as a Stage 4 reparenting signal. Different clinical things. Any
// user who reached Stage 3 had set this field, so MII-5 trivially
// passed for every Stage 4 user regardless of whether real
// reparenting work happened.
//
// Per canon §10 (04-stage-parts.md MII-5), the correct field is the
// Adult Self's offering to a part — captured via
// `partSecured.adultSelfOffering` in the state report.
//
// These tests isolate MII-5: all other Stage 4 MII checks are
// satisfied by the helpers, so the only variable is the reparenting
// signal.

import { describe, expect, it } from 'vitest';
import { checkStage4Gate } from './stage-gates';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_mii5',
    currentStage: 4,
    currentDepth: 'middle',
    startedAt: new Date('2026-05-01'),
    lastActivityAt: new Date('2026-06-19'),
    dischargedAt: null,
    anchorText: 'the bench under the apple tree',
    anchorSetAt: new Date('2026-05-02'),
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'kinesthetic',
    adultSelfQualities: 'the calm older me',
    lastIntensity: 4,
    lastIntensityAt: new Date('2026-06-19'),
    lastDeepLayerContactAt: null,
    mii: {},
    stage8WeeksElapsed: 0,
    frozenForReview: false,
    frozenAt: null,
    frozenReason: null,
    continuityNote: null,
    parts: [
      {
        id: 'p1',
        userDescription: 'the 10-year-old with two braids',
        channel: 'visual',
        safeDistance: 'across the room',
        compassionBridgeQuality: 'compassion',
        currentRestingPlace: null,
        active: true,
        createdAt: new Date('2026-05-15'),
        updatedAt: new Date('2026-06-10'),
      },
    ],
    foreignFiles: [],
    signatureImages: [],
    ...overrides,
  };
}

function makeTurn(
  daysAgo: number,
  report: Partial<StateReport> = {},
): AuditTurn {
  const d = new Date('2026-06-19');
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `turn_${daysAgo}_${Math.random().toString(36).slice(2)}`,
    createdAt: d,
    stageAtTurn: 4,
    depthAtTurn: 'middle',
    intensityReported: 3,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    report: {
      intensity: 3,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      adultSelfPresent: true,
      ...report,
    },
  };
}

/**
 * Builds a turn window that satisfies every Stage 4 MII check OTHER
 * than MII-5, so a failing MII-5 is the only reason the gate trips.
 *   - 5 turns with adultSelfPresent: true (MII-1)
 *   - compassionBridgeQuality on 2 distinct days (MII-4)
 *   - cohesionAwareness on 2 distinct days (MII-7)
 *   - Last turn recommendedAction: 'advance'
 *   - No aborted_overwhelm (MII-3)
 *   - Safety clean for window
 */
function MII5_ISOLATED_TURNS(): AuditTurn[] {
  return [
    makeTurn(8, { compassionBridgeQuality: 'compassion', cohesionAwareness: 'I feel them inside me' }),
    makeTurn(7),
    makeTurn(5, { compassionBridgeQuality: 'curiosity', cohesionAwareness: 'a softer sense of myself' }),
    makeTurn(3),
    makeTurn(1, { recommendedAction: 'advance' }),
  ];
}

describe('checkStage4Gate — MII-5 reparenting capacity', () => {
  it('fails when no parts have currentRestingPlace and no turn carries partSecured.adultSelfOffering', () => {
    const result = checkStage4Gate(makeState(), MII5_ISOLATED_TURNS());
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('mii5_no_reparenting_capacity');
  });

  it('REGRESSION GUARD — adultSelfQualities (Stage 3 capture) alone does NOT pass MII-5', () => {
    // Before the fix, a turn carrying adultSelfQualities trivially
    // satisfied MII-5 — this test pins that the new check ignores it.
    const turns = MII5_ISOLATED_TURNS();
    // Add a turn that emits adultSelfQualities (the wrong field) but
    // nothing partSecured-related.
    turns.push(
      makeTurn(2, { adultSelfQualities: 'the calm older me' }),
    );
    const result = checkStage4Gate(makeState(), turns);
    expect(result.reasons).toContain('mii5_no_reparenting_capacity');
  });

  it('passes MII-5 when at least one captured part has currentRestingPlace', () => {
    const stateWithRest = makeState({
      parts: [
        {
          id: 'p1',
          userDescription: 'the 10-year-old with two braids',
          channel: 'visual',
          safeDistance: 'across the room',
          compassionBridgeQuality: 'compassion',
          currentRestingPlace: 'under the apple tree',
          active: true,
          createdAt: new Date('2026-05-15'),
          updatedAt: new Date('2026-06-10'),
        },
      ],
    });
    const result = checkStage4Gate(stateWithRest, MII5_ISOLATED_TURNS());
    expect(result.reasons).not.toContain('mii5_no_reparenting_capacity');
  });

  it('passes MII-5 when a turn carries non-empty partSecured.adultSelfOffering', () => {
    const turns = MII5_ISOLATED_TURNS();
    turns.push(
      makeTurn(2, {
        partSecured: {
          partDescription: 'the 10-year-old with two braids',
          adultSelfOffering: 'hand on the chest, "you are safe now"',
        },
      }),
    );
    const result = checkStage4Gate(makeState(), turns);
    expect(result.reasons).not.toContain('mii5_no_reparenting_capacity');
  });

  it('does NOT pass MII-5 when partSecured.adultSelfOffering is an empty string', () => {
    const turns = MII5_ISOLATED_TURNS();
    turns.push(
      makeTurn(2, {
        partSecured: {
          partDescription: 'the 10-year-old with two braids',
          adultSelfOffering: '',
        },
      }),
    );
    const result = checkStage4Gate(makeState(), turns);
    expect(result.reasons).toContain('mii5_no_reparenting_capacity');
  });
});
