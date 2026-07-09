// Tests for the Stage 1 advancement gate (canon-aligned 2026-06-26).
//
// Before the alignment, the gate required `formulation_confirmed` in
// readinessTouched — a milestone invented in the master prompt's
// <assessment_phase> section but NOT present in canon §10. Real test
// users got stuck at Stage 1 across 67 turns / 2 sessions because
// "nearly, maybe" is the realistic shape of confirmation, never the
// explicit "yes, that's me" the master prompt's share-back demanded.
//
// Canon §10 actual requirements:
//   - anchorText set
//   - Last 2 intensities ≤ 5
//   - Last 3 turns' safetyFlag — code uses LOOSER rule (red_flag only blocks)
//   - readinessTouched includes anchor-identified, one emotion-or-body-state
//     named, basic orientation present
//   - recommendedAction: advance
//   - No frozen_for_review

import { describe, expect, it } from 'vitest';
import { checkStage1Gate } from './stage-gates';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_stage1',
    currentStage: 1,
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
    sessionCount: 1,
    daysEngaged: 2,
    thisSessionMessageCount: 5,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
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
  // Mirror the report's top-level safety/intensity fields onto the audit
  // row — gate helpers (lastTwoIntensities, safetyNoneForLast,
  // noRedFlagInLast) read from the top-level columns, not from the
  // nested report.
  return {
    id: `turn_${daysAgo}_${Math.random().toString(36).slice(2)}`,
    createdAt: d,
    stageAtTurn: 1,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

const TURNS_WITH_CANON_TOKENS: AuditTurn[] = [
  makeTurn(3, { readinessTouched: ['anchor_identified'] }),
  makeTurn(2, { readinessTouched: ['emotion_named'] }),
  makeTurn(1, {
    readinessTouched: ['orientation_present'],
    recommendedAction: 'advance',
  }),
];

describe('checkStage1Gate — canon-aligned advancement', () => {
  it('passes when all 3 canon readiness tokens are touched + standard guards', () => {
    const result = checkStage1Gate(makeState(), TURNS_WITH_CANON_TOKENS);
    expect(result.passed).toBe(true);
  });

  it('accepts body_located as the alternative to emotion_named', () => {
    const turns: AuditTurn[] = [
      makeTurn(3, { readinessTouched: ['anchor_identified'] }),
      makeTurn(2, { readinessTouched: ['body_located'] }),
      makeTurn(1, {
        readinessTouched: ['orientation_present'],
        recommendedAction: 'advance',
      }),
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(true);
  });

  it('fails when anchor_identified token is missing from all turns', () => {
    const turns: AuditTurn[] = [
      makeTurn(3, { readinessTouched: ['emotion_named'] }),
      makeTurn(2, { readinessTouched: ['body_located'] }),
      makeTurn(1, {
        readinessTouched: ['orientation_present'],
        recommendedAction: 'advance',
      }),
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('anchor_identified_token_missing');
  });

  it('fails when neither emotion_named nor body_located has been touched', () => {
    const turns: AuditTurn[] = [
      makeTurn(3, { readinessTouched: ['anchor_identified'] }),
      makeTurn(2, { readinessTouched: ['formulation_confirmed'] }),
      makeTurn(1, {
        readinessTouched: ['orientation_present'],
        recommendedAction: 'advance',
      }),
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('no_emotion_or_body_state_named');
  });

  it('fails when orientation_present is missing', () => {
    const turns: AuditTurn[] = [
      makeTurn(3, { readinessTouched: ['anchor_identified'] }),
      makeTurn(2, { readinessTouched: ['emotion_named'] }),
      makeTurn(1, {
        readinessTouched: ['anchor_identified'],
        recommendedAction: 'advance',
      }),
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('orientation_not_present');
  });

  it('REGRESSION GUARD: formulation_confirmed is no longer required', () => {
    // Before the canon alignment, this gate required formulation_confirmed.
    // This test pins that it does NOT — the canon tokens are sufficient.
    const result = checkStage1Gate(makeState(), TURNS_WITH_CANON_TOKENS);
    expect(result.passed).toBe(true);
    expect(result.reasons).not.toContain('formulation_not_confirmed_with_user');
  });

  it('fails without anchor set', () => {
    const result = checkStage1Gate(
      makeState({ anchorText: null }),
      TURNS_WITH_CANON_TOKENS,
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('anchor_not_set');
  });

  it('fails when AI did not recommend advance on the last turn', () => {
    const turns: AuditTurn[] = [
      makeTurn(3, { readinessTouched: ['anchor_identified'] }),
      makeTurn(2, { readinessTouched: ['emotion_named'] }),
      makeTurn(1, { readinessTouched: ['orientation_present'] }), // stay default
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('ai_did_not_recommend_advance');
  });

  it('fails when recent intensity above 5', () => {
    const turns: AuditTurn[] = [
      makeTurn(3, { intensity: 7, readinessTouched: ['anchor_identified'] }),
      makeTurn(2, { intensity: 7, readinessTouched: ['emotion_named'] }),
      makeTurn(1, {
        intensity: 7,
        readinessTouched: ['orientation_present'],
        recommendedAction: 'advance',
      }),
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('recent_intensity_above_5');
  });

  it('passes when safetyFlag is watch but no red_flag (B option — Stage 1 looser safety)', () => {
    // Stage 1 intentionally allows watch through, per the in-file comment.
    // Block 1 assessment explores material that legitimately triggers watch.
    const turns: AuditTurn[] = [
      makeTurn(3, {
        safetyFlag: 'watch',
        readinessTouched: ['anchor_identified'],
      }),
      makeTurn(2, { safetyFlag: 'watch', readinessTouched: ['emotion_named'] }),
      makeTurn(1, {
        safetyFlag: 'watch',
        readinessTouched: ['orientation_present'],
        recommendedAction: 'advance',
      }),
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(true);
  });

  it('fails when red_flag in last 3 turns', () => {
    const turns: AuditTurn[] = [
      makeTurn(3, { readinessTouched: ['anchor_identified'] }),
      makeTurn(2, {
        safetyFlag: 'red_flag',
        readinessTouched: ['emotion_named'],
      }),
      makeTurn(1, {
        readinessTouched: ['orientation_present'],
        recommendedAction: 'advance',
      }),
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('red_flag_in_last_3_turns');
  });

  it('fails when frozen for review', () => {
    const result = checkStage1Gate(
      makeState({ frozenForReview: true }),
      TURNS_WITH_CANON_TOKENS,
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('frozen_for_review');
  });

  it('tolerates token name variations (hyphen vs underscore)', () => {
    const turns: AuditTurn[] = [
      makeTurn(3, { readinessTouched: ['anchor-identified'] }),
      makeTurn(2, { readinessTouched: ['emotion-named'] }),
      makeTurn(1, {
        readinessTouched: ['orientation-present'],
        recommendedAction: 'advance',
      }),
    ];
    const result = checkStage1Gate(makeState(), turns);
    expect(result.passed).toBe(true);
  });
});
