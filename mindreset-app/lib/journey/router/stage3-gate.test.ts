// Tests for the Stage 3 advancement gate (canon-aligned 2026-06-26).
//
// Canon §10 requires:
//   - Observer Seat touched (observerSeatTouched: true at least once)
//   - Adult Self reached on at least TWO DIFFERENT DAYS with
//     adultSelfQualities captured
//   - Adult Self linked to Anchor at least once
//   - User held a named emotion in Adult Self + Anchor at least once
//   - intensities ≤ 5
//   - safetyFlag none for 3 turns
//   - recommendedAction: advance
//   - No frozen_for_review
//
// PR 4 added schema fields adultSelfAnchorLinked and heldEmotionInAdultSelf
// that the gate now uses. Before this PR, those were silently dropped.

import { describe, expect, it } from 'vitest';
import { checkStage3Gate } from './stage-gates';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_stage3',
    currentStage: 3,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-15'),
    lastActivityAt: new Date('2026-06-26'),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-06-16'),
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'visual',
    adultSelfQualities: 'the calm older me',
    lastIntensity: 4,
    lastIntensityAt: new Date('2026-06-26'),
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
    patterns: [],
    sessionCount: 3,
    daysEngaged: 5,
    thisSessionMessageCount: 5,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
    taskContract: null,
    workingPreferences: [],
    practiceHistory: [],
    ...overrides,
  };
}

function makeTurn(
  daysAgo: number,
  report: Partial<StateReport> = {},
): AuditTurn {
  const d = new Date('2026-06-26');
  d.setDate(d.getDate() - daysAgo);
  const fullReport: StateReport = {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...report,
  };
  return {
    id: `turn_${daysAgo}_${Math.random().toString(36).slice(2)}`,
    createdAt: d,
    stageAtTurn: 3,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

const PASSING_TURNS: AuditTurn[] = [
  makeTurn(7, {
    observerSeatTouched: true,
    adultSelfPresent: true,
    adultSelfQualities: 'the calm older me',
  }),
  makeTurn(5, {
    adultSelfPresent: true,
    adultSelfAnchorLinked: true,
  }),
  makeTurn(3, {
    adultSelfPresent: true,
    heldEmotionInAdultSelf: true,
  }),
  makeTurn(1, {
    adultSelfPresent: true,
    recommendedAction: 'advance',
  }),
];

describe('checkStage3Gate — canon-aligned advancement', () => {
  it('passes when all canon conditions met', () => {
    const result = checkStage3Gate(makeState(), PASSING_TURNS);
    expect(result.passed).toBe(true);
  });

  it('REGRESSION GUARD: adultSelfAnchorLinked is now required', () => {
    const turns: AuditTurn[] = [
      makeTurn(7, {
        observerSeatTouched: true,
        adultSelfPresent: true,
        adultSelfQualities: 'the calm older me',
      }),
      makeTurn(3, {
        adultSelfPresent: true,
        heldEmotionInAdultSelf: true,
      }),
      makeTurn(1, { adultSelfPresent: true, recommendedAction: 'advance' }),
    ];
    const result = checkStage3Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('adult_self_not_linked_to_anchor');
  });

  it('REGRESSION GUARD: heldEmotionInAdultSelf is now required', () => {
    const turns: AuditTurn[] = [
      makeTurn(7, {
        observerSeatTouched: true,
        adultSelfPresent: true,
        adultSelfQualities: 'the calm older me',
      }),
      makeTurn(3, {
        adultSelfPresent: true,
        adultSelfAnchorLinked: true,
      }),
      makeTurn(1, { adultSelfPresent: true, recommendedAction: 'advance' }),
    ];
    const result = checkStage3Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('emotion_not_held_in_adult_self');
  });

  it('fails without observer seat', () => {
    const turns: AuditTurn[] = [
      makeTurn(7, {
        adultSelfPresent: true,
        adultSelfQualities: 'the calm older me',
      }),
      makeTurn(5, { adultSelfPresent: true, adultSelfAnchorLinked: true }),
      makeTurn(3, { adultSelfPresent: true, heldEmotionInAdultSelf: true }),
      makeTurn(1, { adultSelfPresent: true, recommendedAction: 'advance' }),
    ];
    const result = checkStage3Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('observer_seat_not_touched');
  });

  it('fails without adultSelfQualities captured', () => {
    const turns: AuditTurn[] = [
      makeTurn(7, { observerSeatTouched: true, adultSelfPresent: true }),
      makeTurn(5, { adultSelfPresent: true, adultSelfAnchorLinked: true }),
      makeTurn(3, { adultSelfPresent: true, heldEmotionInAdultSelf: true }),
      makeTurn(1, { adultSelfPresent: true, recommendedAction: 'advance' }),
    ];
    const result = checkStage3Gate(
      makeState({ adultSelfQualities: null }),
      turns,
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('adult_self_qualities_not_captured');
  });

  it('fails when Adult Self reached on only ONE day', () => {
    // Two adultSelfPresent: true but same day → not reproducible
    const sameDay = new Date('2026-06-25');
    const turns: AuditTurn[] = [
      {
        ...makeTurn(1, {
          observerSeatTouched: true,
          adultSelfPresent: true,
          adultSelfQualities: 'the calm older me',
          adultSelfAnchorLinked: true,
          heldEmotionInAdultSelf: true,
          recommendedAction: 'advance',
        }),
        createdAt: sameDay,
      },
      {
        ...makeTurn(1, {
          adultSelfPresent: true,
          recommendedAction: 'advance',
        }),
        createdAt: new Date(sameDay.getTime() + 3600 * 1000),
      },
    ];
    const result = checkStage3Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('adult_self_not_reproducible_across_days');
  });

  it('fails without anchor', () => {
    const result = checkStage3Gate(
      makeState({ anchorText: null }),
      PASSING_TURNS,
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('anchor_missing');
  });
});
