// Tests for the Stage 5 advancement gate (canon-aligned 2026-06-27).
//
// Canon §10 (docs/journey/05-stage-foreign-material.md):
//   - At least one foreign file identified
//   - Symbolic Return run at least once WITH `somaticRelease: true`
//   - Clean Identity Statement spoken AND `bodyConfirmation` captured
//     (the user's own words for the felt sense after the statement)
//   - intensities ≤ 5
//   - safetyFlag none for last 5 turns
//   - recommendedAction: advance
//   - No frozen_for_review
//
// PR 4 (Bundle B) added `somaticRelease` and `bodyConfirmation` schema
// fields. Before this PR, the gate ignored both — a release that was
// "head-only" (no body settling) and a statement spoken without body
// confirmation both still advanced the user.

import { describe, expect, it } from 'vitest';
import { checkStage5Gate } from './stage-gates';
import type { JourneyState, JourneyForeignFile } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makeFile(overrides: Partial<JourneyForeignFile> = {}): JourneyForeignFile {
  return {
    id: 'file_test',
    userDescription: 'the "must be useful" voice',
    originDescription: 'my mother',
    returnedTo: "my mother's house",
    honouringPhrase: 'I see what this was',
    whatStaysAsMine: 'I love making things',
    identifiedAt: new Date('2026-06-15'),
    releasedAt: new Date('2026-06-20'),
    ...overrides,
  };
}

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_stage5',
    currentStage: 5,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-01'),
    lastActivityAt: new Date('2026-06-27'),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-06-02'),
    identityAnchor: null,
    identityAnchorSetAt: null,
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
    foreignFiles: [makeFile()],
    signatureImages: [],
    sessionCount: 8,
    daysEngaged: 14,
    thisSessionMessageCount: 5,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    ...overrides,
  };
}

function makeTurn(
  daysAgo: number,
  report: Partial<StateReport> = {},
): AuditTurn {
  const d = new Date('2026-06-27');
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
    stageAtTurn: 5,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

const PASSING_TURNS: AuditTurn[] = [
  makeTurn(7, { somaticRelease: true }),
  makeTurn(5, {
    cleanIdentityStatement: 'I am someone who makes things because she loves to.',
    bodyConfirmation: 'lighter in my chest, room to breathe',
  }),
  makeTurn(3, {}),
  makeTurn(2, {}),
  makeTurn(1, { recommendedAction: 'advance' }),
];

describe('checkStage5Gate — canon-aligned advancement', () => {
  it('passes when all canon conditions met', () => {
    const result = checkStage5Gate(makeState(), PASSING_TURNS);
    expect(result.passed).toBe(true);
  });

  it('REGRESSION GUARD: somaticRelease: true is now required', () => {
    const turns: AuditTurn[] = [
      makeTurn(5, {
        cleanIdentityStatement: 'I am someone who makes things',
        bodyConfirmation: 'lighter',
      }),
      makeTurn(3, {}),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage5Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('somatic_release_not_confirmed');
  });

  it('REGRESSION GUARD: bodyConfirmation is now required', () => {
    const turns: AuditTurn[] = [
      makeTurn(7, { somaticRelease: true }),
      makeTurn(5, {
        cleanIdentityStatement: 'I am someone who makes things',
        // no bodyConfirmation — statement is head-only
      }),
      makeTurn(3, {}),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage5Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('clean_identity_statement_not_body_confirmed');
  });

  it('fails when no foreign material identified', () => {
    const state = makeState({ foreignFiles: [] });
    const result = checkStage5Gate(state, PASSING_TURNS);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('no_foreign_material_identified');
  });

  it('fails when foreign file has not been released yet', () => {
    const state = makeState({
      foreignFiles: [makeFile({ releasedAt: null })],
    });
    const result = checkStage5Gate(state, PASSING_TURNS);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('no_symbolic_return_completed');
  });

  it('fails when clean identity statement never captured', () => {
    const turns: AuditTurn[] = [
      makeTurn(7, { somaticRelease: true }),
      makeTurn(5, { bodyConfirmation: 'lighter' }),
      makeTurn(3, {}),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage5Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('clean_identity_statement_missing');
  });

  it('fails without anchor', () => {
    const state = makeState({ anchorText: null });
    const result = checkStage5Gate(state, PASSING_TURNS);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('anchor_missing');
  });

  it('fails when safetyFlag is watch in last 5 turns', () => {
    const turns: AuditTurn[] = [
      makeTurn(7, { somaticRelease: true }),
      makeTurn(5, {
        cleanIdentityStatement: 'I am someone who makes things',
        bodyConfirmation: 'lighter',
      }),
      makeTurn(3, { safetyFlag: 'watch' }),
      makeTurn(2, {}),
      makeTurn(1, { recommendedAction: 'advance' }),
    ];
    const result = checkStage5Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('safety_not_clean_for_last_5_turns');
  });
});
