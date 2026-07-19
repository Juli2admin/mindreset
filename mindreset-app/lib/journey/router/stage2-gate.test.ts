// Tests for the Stage 2 advancement gate (canon-aligned 2026-06-26).
//
// Before the alignment, the gate accepted ANY ONE token from a regex
// matching emotion_named|emotion_located|soft_why. Canon §10 requires
// THREE DISTINCT conditions:
//   1. Emotion named in user's words.
//   2. Emotion located in body.
//   3. Soft Why asked AND user responded (any response counts,
//      including "I don't know").

import { describe, expect, it } from 'vitest';
import { checkStage2Gate } from './stage-gates';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_stage2',
    currentStage: 2,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-20'),
    lastActivityAt: new Date('2026-06-26'),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-06-21'),
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'visual',
    adultSelfQualities: null,
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
    sessionCount: 2,
    daysEngaged: 3,
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
    stageAtTurn: 2,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

const TURNS_ALL_THREE_CONDITIONS: AuditTurn[] = [
  makeTurn(5, { readinessTouched: ['emotion_named'] }),
  makeTurn(4, { readinessTouched: ['emotion_located'] }),
  makeTurn(3, { readinessTouched: ['soft_why_answered'] }),
  makeTurn(2, {}),
  makeTurn(1, { recommendedAction: 'advance' }),
];

describe('checkStage2Gate — canon-aligned advancement', () => {
  it('passes when all 3 canon conditions touched + standard guards', () => {
    const result = checkStage2Gate(makeState(), TURNS_ALL_THREE_CONDITIONS);
    expect(result.passed).toBe(true);
  });

  it('accepts body_located as alternative to emotion_located', () => {
    const turns: AuditTurn[] = [
      makeTurn(5, { readinessTouched: ['emotion_named'] }),
      makeTurn(4, { readinessTouched: ['body_located'] }),
      makeTurn(3, { readinessTouched: ['soft_why_asked'] }),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage2Gate(makeState(), turns);
    expect(result.passed).toBe(true);
  });

  it('REGRESSION GUARD: just one token (emotion_named) is NOT enough', () => {
    // Before the alignment, this passed. Canon requires all three.
    const turns: AuditTurn[] = [
      makeTurn(5, { readinessTouched: ['emotion_named'] }),
      makeTurn(4, {}),
      makeTurn(3, {}),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage2Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('emotion_not_located_in_body');
    expect(result.reasons).toContain('soft_why_not_asked_or_answered');
  });

  it('fails when emotion not named', () => {
    const turns: AuditTurn[] = [
      makeTurn(5, { readinessTouched: ['emotion_located'] }),
      makeTurn(4, { readinessTouched: ['soft_why_answered'] }),
      makeTurn(3, {}),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage2Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('emotion_not_named');
  });

  it('fails when emotion not located in body', () => {
    const turns: AuditTurn[] = [
      makeTurn(5, { readinessTouched: ['emotion_named'] }),
      makeTurn(4, { readinessTouched: ['soft_why_answered'] }),
      makeTurn(3, {}),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage2Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('emotion_not_located_in_body');
  });

  it('fails when Soft Why not asked', () => {
    const turns: AuditTurn[] = [
      makeTurn(5, { readinessTouched: ['emotion_named'] }),
      makeTurn(4, { readinessTouched: ['emotion_located'] }),
      makeTurn(3, {}),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage2Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('soft_why_not_asked_or_answered');
  });

  it('fails without anchor', () => {
    const result = checkStage2Gate(
      makeState({ anchorText: null }),
      TURNS_ALL_THREE_CONDITIONS,
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('anchor_missing');
  });

  it('Stage 2 uses canon-strict safety: watch flag blocks advancement', () => {
    // Unlike Stage 1 (looser red_flag-only rule per owner sign-off),
    // Stage 2 uses standardGuards which require safetyFlag = none for
    // the last 3 turns.
    const turns: AuditTurn[] = [
      makeTurn(5, { readinessTouched: ['emotion_named'] }),
      makeTurn(4, { readinessTouched: ['emotion_located'] }),
      makeTurn(3, { readinessTouched: ['soft_why_answered'] }),
      makeTurn(2, { safetyFlag: 'watch' }),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage2Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('safety_not_clean_for_last_3_turns');
  });

  it('fails when AI did not recommend advance', () => {
    const turns: AuditTurn[] = [
      makeTurn(5, { readinessTouched: ['emotion_named'] }),
      makeTurn(4, { readinessTouched: ['emotion_located'] }),
      makeTurn(3, { readinessTouched: ['soft_why_answered'] }),
      makeTurn(2, {}),
      makeTurn(1, {}),
    ];
    const result = checkStage2Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('ai_did_not_recommend_advance');
  });

  it('tolerates token name variations (hyphen vs underscore)', () => {
    const turns: AuditTurn[] = [
      makeTurn(5, { readinessTouched: ['emotion-named'] }),
      makeTurn(4, { readinessTouched: ['emotion-located'] }),
      makeTurn(3, { readinessTouched: ['soft-why-asked'] }),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage2Gate(makeState(), turns);
    expect(result.passed).toBe(true);
  });
});
