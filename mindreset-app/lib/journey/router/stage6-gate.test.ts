// Tests for the Stage 6 advancement gate (audit P0 #2 + canon §10
// alignment 2026-06-27).
//
// Audit P0 #2 (2026-06-19):
//   Before that fix:
//     - The cohesion check searched readinessTouched for tokens that did
//       not exist in any prompt's vocabulary — the gate was unreachable.
//     - The "no separated parts" check used parts.every() which passed
//       vacuously when state.parts.length === 0.
//   After:
//     - The cohesion check reads the `internalConsensus: true` boolean.
//     - Empty parts array correctly fails the gate.
//
// Canon §10 alignment (2026-06-27, this PR):
//   - Canon §10 also requires "Adult Self present ≥ 70% of turns in the
//     last 3 sessions." The gate now enforces this using
//     lastNSessionsTurns(turns, 3) and the 0.7 ratio.
//   - The default makeTurn helper below now sets adultSelfPresent: true,
//     so existing canon-compliant tests pass without modification; new
//     tests override with adultSelfPresent: false to exercise the 70%
//     threshold and 3-session history requirement.

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
    patterns: [],
    sessionCount: 0,
    daysEngaged: 0,
    thisSessionMessageCount: 0,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
    taskContract: null,
    onboardingAnswers: null,
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
      // Default to adultSelfPresent: true so existing canon-compliant
      // tests pass under the new 70%-across-last-3-sessions check.
      // New tests can override with adultSelfPresent: false.
      adultSelfPresent: true,
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
      makeTurn(6, {
        internalConsensus: true,
        selfLoyaltyStatement: 'I choose to stay on my own side',
        oneSmallAction: 'put my own coffee first tomorrow morning',
      }),
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
      makeTurn(6, {
        internalConsensus: true,
        selfLoyaltyStatement: 'I choose to stay on my own side',
        oneSmallAction: 'put my own coffee first tomorrow morning',
      }),
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

// ---------------------------------------------------------------------------
// Canon §10 alignment 2026-06-27 — Adult Self present ≥ 70% across the
// last 3 sessions. Sessions are separated by a 4-hour gap, matching
// state/load.ts. Turns at 10-minute increments stay inside one session.
// ---------------------------------------------------------------------------
function makeTurnAt(
  at: Date,
  report: Partial<StateReport> = {},
): AuditTurn {
  return {
    id: `turn_${at.getTime()}_${Math.random().toString(36).slice(2)}`,
    createdAt: at,
    stageAtTurn: 6,
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

function makeSession(
  startDay: Date,
  perTurn: Partial<StateReport>[],
): AuditTurn[] {
  return perTurn.map((r, i) => {
    const t = new Date(startDay);
    t.setMinutes(t.getMinutes() + i * 10);
    return makeTurnAt(t, r);
  });
}

describe('checkStage6Gate — canon §10 adult-self 70% across last 3 sessions', () => {
  const day1 = new Date('2026-06-22T10:00:00Z');
  const day2 = new Date('2026-06-24T10:00:00Z');
  const day3 = new Date('2026-06-26T10:00:00Z');

  function passingMultiSession(): AuditTurn[] {
    return [
      ...makeSession(day1, [
        { internalConsensus: true },
        {},
        {},
      ]),
      ...makeSession(day2, [
        { internalConsensus: true },
        {},
        {},
      ]),
      ...makeSession(day3, [
        {},
        {
          selfLoyaltyStatement: 'I will not abandon myself.',
          oneSmallAction: 'one slow walk this week',
        },
        { recommendedAction: 'advance' },
      ]),
    ];
  }

  it('passes when adultSelfPresent on all 9 turns across 3 sessions', () => {
    const result = checkStage6Gate(makeState(), passingMultiSession());
    expect(result.passed).toBe(true);
  });

  it('REGRESSION GUARD: fails when adult self below 70% across last 3 sessions', () => {
    const turns: AuditTurn[] = [
      ...makeSession(day1, [
        { internalConsensus: true },
        { adultSelfPresent: false },
        { adultSelfPresent: false },
      ]),
      ...makeSession(day2, [
        { internalConsensus: true },
        { adultSelfPresent: false },
        { adultSelfPresent: false },
      ]),
      ...makeSession(day3, [
        {},
        {
          adultSelfPresent: false,
          selfLoyaltyStatement: 'I will not abandon myself.',
          oneSmallAction: 'one slow walk',
        },
        { adultSelfPresent: false, recommendedAction: 'advance' },
      ]),
    ];
    const result = checkStage6Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      'adult_self_below_70_percent_across_last_3_sessions',
    );
  });

  it('fails when only one session of history exists (cannot evaluate stability)', () => {
    const oneDay = new Date('2026-06-26T10:00:00Z');
    const turns: AuditTurn[] = makeSession(oneDay, [
      { internalConsensus: true },
      { internalConsensus: true },
      {
        selfLoyaltyStatement: 'I will not abandon myself.',
        oneSmallAction: 'one slow walk',
      },
      { recommendedAction: 'advance' },
    ]);
    const result = checkStage6Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      'insufficient_history_for_adult_self_stability',
    );
  });
});
