// Tests for the Stage 6 advancement gate (audit P0 #2).
//
// Before the fix:
//   - The cohesion check searched readinessTouched for tokens
//     (feel_like_myself, internal_consensus, cohesion) that did not
//     exist in any prompt's vocabulary — the gate was unreachable.
//   - The "no separated parts" check used parts.every() which passed
//     vacuously when state.parts.length === 0.
//
// After the fix:
//   - The cohesion check reads the new `internalConsensus: true`
//     boolean field, captured on ≥ 2 distinct days.
//   - Empty parts array correctly fails the gate.

import { describe, expect, it } from 'vitest';
import { checkStage6Gate } from './stage-gates';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_stage6',
    currentStage: 6,
    currentDepth: 'middle',
    startedAt: new Date('2026-05-01'),
    lastActivityAt: new Date('2026-06-19'),
    dischargedAt: null,
    anchorText: 'the bench under the apple tree',
    anchorSetAt: new Date('2026-05-02'),
    identityAnchor: 'hand on the centre of my chest',
    identityAnchorSetAt: new Date('2026-06-10'),
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
        currentRestingPlace: 'under the apple tree',
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
    id: `turn_${daysAgo}`,
    createdAt: d,
    stageAtTurn: 6,
    depthAtTurn: 'middle',
    intensityReported: 3,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    report: {
      intensity: 3,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      ...report,
    },
  };
}

const FIVE_CLEAN_TURNS: AuditTurn[] = [
  makeTurn(5),
  makeTurn(4),
  makeTurn(3),
  makeTurn(2),
  makeTurn(1),
];

describe('checkStage6Gate — internal consensus reachability', () => {
  it('passes when internalConsensus:true on two distinct days + other criteria', () => {
    const turns: AuditTurn[] = [
      ...FIVE_CLEAN_TURNS,
      makeTurn(6, { internalConsensus: true }),
      makeTurn(2, { internalConsensus: true, recommendedAction: 'advance' }),
    ];
    const result = checkStage6Gate(makeState(), turns);
    expect(result.passed).toBe(true);
  });

  it('fails when internalConsensus:true on only ONE day', () => {
    const turns: AuditTurn[] = [
      ...FIVE_CLEAN_TURNS,
      makeTurn(2, { internalConsensus: true }),
    ];
    const result = checkStage6Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('internal_consensus_not_reached_on_two_days');
  });

  it('fails when internalConsensus is never true', () => {
    const result = checkStage6Gate(makeState(), FIVE_CLEAN_TURNS);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('internal_consensus_not_reached_on_two_days');
  });

  it('treats internalConsensus:false the same as omitted (does not count)', () => {
    const turns: AuditTurn[] = [
      ...FIVE_CLEAN_TURNS,
      makeTurn(5, { internalConsensus: false }),
      makeTurn(2, { internalConsensus: false }),
    ];
    const result = checkStage6Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('internal_consensus_not_reached_on_two_days');
  });
});

describe('checkStage6Gate — parts cohesion vacuous-true guard', () => {
  it('fails when state.parts is empty (was previously vacuously passing)', () => {
    const turns: AuditTurn[] = [
      ...FIVE_CLEAN_TURNS,
      makeTurn(6, { internalConsensus: true }),
      makeTurn(2, { internalConsensus: true }),
    ];
    const result = checkStage6Gate(makeState({ parts: [] }), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('no_parts_in_landscape_for_cohesion_check');
  });

  it('passes with at least one captured part + consensus on two days', () => {
    const turns: AuditTurn[] = [
      ...FIVE_CLEAN_TURNS,
      makeTurn(6, { internalConsensus: true }),
      makeTurn(2, { internalConsensus: true, recommendedAction: 'advance' }),
    ];
    const result = checkStage6Gate(makeState(), turns);
    expect(result.passed).toBe(true);
  });
});

describe('checkStage6Gate — standard guards still apply', () => {
  it('fails without an anchor', () => {
    const turns: AuditTurn[] = [
      ...FIVE_CLEAN_TURNS,
      makeTurn(6, { internalConsensus: true }),
      makeTurn(2, { internalConsensus: true }),
    ];
    const result = checkStage6Gate(makeState({ anchorText: null }), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('anchor_missing');
  });

  it('fails without an identity anchor', () => {
    const turns: AuditTurn[] = [
      ...FIVE_CLEAN_TURNS,
      makeTurn(6, { internalConsensus: true }),
      makeTurn(2, { internalConsensus: true }),
    ];
    const result = checkStage6Gate(makeState({ identityAnchor: null }), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('identity_anchor_not_set');
  });

  it('fails when frozen-for-review', () => {
    const turns: AuditTurn[] = [
      ...FIVE_CLEAN_TURNS,
      makeTurn(6, { internalConsensus: true }),
      makeTurn(2, { internalConsensus: true }),
    ];
    const result = checkStage6Gate(makeState({ frozenForReview: true }), turns);
    expect(result.passed).toBe(false);
  });
});
