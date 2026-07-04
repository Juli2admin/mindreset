// Tests for the Stage 7 advancement gate (canon-aligned 2026-06-27).
//
// Canon §10 (docs/journey/07-stage-new-identity.md):
//   - ≥ 3 emerging qualities across ≥ 2 sessions
//   - symbolicIdentityMap set
//   - innerDirection set
//   - safetyReorientation delivered at close of EVERY Stage 7 session
//   - No urgencyMarkers: 'present' in recent turns (non-negotiable)
//   - Adult Self ≥ 70% across last 3 sessions
//   - identityAnchor set
//   - standard guards (intensities ≤ 5, safety none for 5 turns, AI agrees,
//     not frozen)
//
// Before this PR, the gate enforced reorientation as "≥ 2 in window" — too
// loose; canon requires every session to close with it. And the Adult-Self-
// 70%-across-3-sessions check was not gated at all.

import { describe, expect, it } from 'vitest';
import { checkStage7Gate } from './stage-gates';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_stage7',
    currentStage: 7,
    currentDepth: 'surface',
    startedAt: new Date('2026-05-01'),
    lastActivityAt: new Date('2026-06-27'),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-05-02'),
    identityAnchor: 'hand on the centre of my chest',
    identityAnchorSetAt: new Date('2026-06-15'),
    processingChannel: 'visual',
    adultSelfQualities: 'the calm older me',
    lastIntensity: 4,
    lastIntensityAt: new Date('2026-06-27'),
    lastDeepLayerContactAt: null,
    mii: {},
    stage8WeeksElapsed: 0,
    frozenForReview: false,
    frozenAt: null,
    frozenReason: null,
    continuityNote: null,
    parts: [],
    foreignFiles: [],
    signatureImages: [],
    sessionCount: 12,
    daysEngaged: 24,
    thisSessionMessageCount: 5,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    ...overrides,
  };
}

function makeTurnAt(
  at: Date,
  report: Partial<StateReport> = {},
): AuditTurn {
  const fullReport: StateReport = {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    adultSelfPresent: true,
    ...report,
  };
  return {
    id: `turn_${at.getTime()}_${Math.random().toString(36).slice(2)}`,
    createdAt: at,
    stageAtTurn: 7,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
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

// Three sessions, four days apart. Canonically passing turns:
//   - symbolicIdentityMap captured on day1
//   - emergingQualities of ≥ 3 distinct strings across day1 + day2
//   - innerDirection captured on day2
//   - safetyReorientation: true at close of each of the last 2 sessions
//   - adultSelfPresent: true on every turn (defaulted)
//   - recommendedAction: advance on the final turn
function passingTurns(): AuditTurn[] {
  const day1 = new Date('2026-06-20T10:00:00Z');
  const day2 = new Date('2026-06-23T10:00:00Z');
  const day3 = new Date('2026-06-27T10:00:00Z');
  return [
    ...makeSession(day1, [
      {
        symbolicIdentityMap: 'a tree by a still pool',
        emergingQualities: ['slow', 'steady'],
      },
      { emergingQualities: ['clear'] },
      { safetyReorientation: true },
    ]),
    ...makeSession(day2, [
      {
        innerDirection: 'to live more truthfully',
        emergingQualities: ['present'],
      },
      {},
      { safetyReorientation: true },
    ]),
    ...makeSession(day3, [
      {},
      {},
      { safetyReorientation: true, recommendedAction: 'advance' },
    ]),
  ];
}

describe('checkStage7Gate — canon-aligned advancement', () => {
  it('passes when all canon conditions met', () => {
    const result = checkStage7Gate(makeState(), passingTurns());
    expect(result.passed).toBe(true);
  });

  it('REGRESSION GUARD: safety reorientation missing in one of last 2 sessions blocks', () => {
    const day1 = new Date('2026-06-20T10:00:00Z');
    const day2 = new Date('2026-06-23T10:00:00Z');
    const day3 = new Date('2026-06-27T10:00:00Z');
    const turns: AuditTurn[] = [
      ...makeSession(day1, [
        {
          symbolicIdentityMap: 'a tree by a still pool',
          emergingQualities: ['slow', 'steady'],
        },
        { emergingQualities: ['clear'] },
        { safetyReorientation: true },
      ]),
      ...makeSession(day2, [
        {
          innerDirection: 'to live more truthfully',
          emergingQualities: ['present'],
        },
        {},
        { safetyReorientation: true },
      ]),
      ...makeSession(day3, [
        {},
        {},
        // No safetyReorientation on this session's close — canon says
        // this MUST block advancement.
        { recommendedAction: 'advance' },
      ]),
    ];
    const result = checkStage7Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      'safety_reorientation_missing_in_at_least_one_recent_session',
    );
  });

  it('REGRESSION GUARD: adult self below 70% across last 3 sessions blocks', () => {
    const day1 = new Date('2026-06-20T10:00:00Z');
    const day2 = new Date('2026-06-23T10:00:00Z');
    const day3 = new Date('2026-06-27T10:00:00Z');
    const turns: AuditTurn[] = [
      ...makeSession(day1, [
        {
          symbolicIdentityMap: 'a tree by a still pool',
          emergingQualities: ['slow', 'steady'],
          adultSelfPresent: false,
        },
        { emergingQualities: ['clear'], adultSelfPresent: false },
        { safetyReorientation: true, adultSelfPresent: false },
      ]),
      ...makeSession(day2, [
        {
          innerDirection: 'to live more truthfully',
          emergingQualities: ['present'],
          adultSelfPresent: false,
        },
        { adultSelfPresent: false },
        { safetyReorientation: true, adultSelfPresent: false },
      ]),
      ...makeSession(day3, [
        { adultSelfPresent: false },
        { adultSelfPresent: false },
        {
          safetyReorientation: true,
          adultSelfPresent: false,
          recommendedAction: 'advance',
        },
      ]),
    ];
    const result = checkStage7Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      'adult_self_below_70_percent_across_last_3_sessions',
    );
  });

  it('urgency present in recent turns blocks (non-negotiable)', () => {
    const day1 = new Date('2026-06-20T10:00:00Z');
    const day2 = new Date('2026-06-23T10:00:00Z');
    const day3 = new Date('2026-06-27T10:00:00Z');
    const turns: AuditTurn[] = [
      ...makeSession(day1, [
        {
          symbolicIdentityMap: 'a tree by a still pool',
          emergingQualities: ['slow', 'steady'],
        },
        { emergingQualities: ['clear'] },
        { safetyReorientation: true },
      ]),
      ...makeSession(day2, [
        {
          innerDirection: 'to live more truthfully',
          emergingQualities: ['present'],
        },
        {},
        { safetyReorientation: true },
      ]),
      ...makeSession(day3, [
        {},
        { urgencyMarkers: 'present' },
        { safetyReorientation: true, recommendedAction: 'advance' },
      ]),
    ];
    const result = checkStage7Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('urgency_present_in_recent_turns');
  });

  it('fails when fewer than 3 emerging qualities captured', () => {
    const day1 = new Date('2026-06-20T10:00:00Z');
    const day2 = new Date('2026-06-23T10:00:00Z');
    const day3 = new Date('2026-06-27T10:00:00Z');
    const turns: AuditTurn[] = [
      ...makeSession(day1, [
        {
          symbolicIdentityMap: 'a tree by a still pool',
          emergingQualities: ['slow'],
        },
        {},
        { safetyReorientation: true },
      ]),
      ...makeSession(day2, [
        {
          innerDirection: 'to live more truthfully',
          emergingQualities: ['steady'],
        },
        {},
        { safetyReorientation: true },
      ]),
      ...makeSession(day3, [
        {},
        {},
        { safetyReorientation: true, recommendedAction: 'advance' },
      ]),
    ];
    const result = checkStage7Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('fewer_than_three_emerging_qualities');
  });

  it('fails when symbolicIdentityMap missing', () => {
    const day1 = new Date('2026-06-20T10:00:00Z');
    const day2 = new Date('2026-06-23T10:00:00Z');
    const day3 = new Date('2026-06-27T10:00:00Z');
    const turns: AuditTurn[] = [
      ...makeSession(day1, [
        { emergingQualities: ['slow', 'steady'] },
        { emergingQualities: ['clear'] },
        { safetyReorientation: true },
      ]),
      ...makeSession(day2, [
        {
          innerDirection: 'to live more truthfully',
          emergingQualities: ['present'],
        },
        {},
        { safetyReorientation: true },
      ]),
      ...makeSession(day3, [
        {},
        {},
        { safetyReorientation: true, recommendedAction: 'advance' },
      ]),
    ];
    const result = checkStage7Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('symbolic_identity_map_missing');
  });

  it('fails when innerDirection missing', () => {
    const day1 = new Date('2026-06-20T10:00:00Z');
    const day2 = new Date('2026-06-23T10:00:00Z');
    const day3 = new Date('2026-06-27T10:00:00Z');
    const turns: AuditTurn[] = [
      ...makeSession(day1, [
        {
          symbolicIdentityMap: 'a tree by a still pool',
          emergingQualities: ['slow', 'steady'],
        },
        { emergingQualities: ['clear'] },
        { safetyReorientation: true },
      ]),
      ...makeSession(day2, [
        { emergingQualities: ['present'] },
        {},
        { safetyReorientation: true },
      ]),
      ...makeSession(day3, [
        {},
        {},
        { safetyReorientation: true, recommendedAction: 'advance' },
      ]),
    ];
    const result = checkStage7Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('inner_direction_missing');
  });

  it('fails when identityAnchor missing', () => {
    const result = checkStage7Gate(
      makeState({ identityAnchor: null }),
      passingTurns(),
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('identity_anchor_missing');
  });

  it('fails when only one session of history exists', () => {
    const oneDay = new Date('2026-06-27T10:00:00Z');
    const turns: AuditTurn[] = makeSession(oneDay, [
      {
        symbolicIdentityMap: 'a tree by a still pool',
        emergingQualities: ['slow', 'steady', 'clear'],
        innerDirection: 'to live more truthfully',
      },
      {},
      { safetyReorientation: true },
      {},
      { safetyReorientation: true, recommendedAction: 'advance' },
    ]);
    const result = checkStage7Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      'insufficient_history_for_safety_reorientation_check',
    );
    expect(result.reasons).toContain(
      'insufficient_history_for_adult_self_stability',
    );
  });
});
