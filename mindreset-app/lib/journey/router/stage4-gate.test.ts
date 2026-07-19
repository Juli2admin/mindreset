// Tests for the Stage 4 advancement gate — focused on the MII-5 alignment
// (2026-06-27).
//
// Canon §10 MII-5 (Basic Reparenting Capacity) says:
//   State report check: `adultSelfOfferingToPart: "..."` captured at least
//   once in the user's words.
//
// Before this PR, the gate's fallback path read `adultSelfQualities` — a
// Stage 3 capture (the user's words for the Adult Self itself), not a
// reparenting offering to a part. Any Stage 4 user who had reached Stage 3
// already passed MII-5 by default without ever offering anything to a part.
//
// The schema field that carries the canon-named signal is
// `partSecured.adultSelfOffering`. `save.ts` writes it into the part's
// `currentRestingPlace` column, so the existing
// `state.parts.some((p) => p.currentRestingPlace)` check is correct —
// only the report-level fallback was wrong.

import { describe, expect, it } from 'vitest';
import { checkStage4Gate } from './stage-gates';
import type { JourneyState, JourneyPart } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makePart(overrides: Partial<JourneyPart> = {}): JourneyPart {
  return {
    id: 'part_test',
    userDescription: 'a small girl in the corner',
    channel: 'visual',
    safeDistance: 'across the room',
    compassionBridgeQuality: 'compassion',
    currentRestingPlace: null,
    active: true,
    createdAt: new Date('2026-06-15'),
    updatedAt: new Date('2026-06-25'),
    ...overrides,
  };
}

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_stage4',
    currentStage: 4,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-10'),
    lastActivityAt: new Date('2026-06-27'),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-06-11'),
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
    parts: [makePart()],
    foreignFiles: [],
    signatureImages: [],
    patterns: [],
    sessionCount: 5,
    daysEngaged: 10,
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
    stageAtTurn: 4,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

// A turn set that satisfies every MII criterion except MII-5 (no offering,
// no resting place). Used as the baseline for MII-5-specific tests.
function turnsAllButMii5(): AuditTurn[] {
  return [
    makeTurn(20, {
      adultSelfPresent: true,
      compassionBridgeQuality: 'compassion',
      cohesionAwareness: 'I feel her in my chest',
    }),
    makeTurn(15, {
      adultSelfPresent: true,
      compassionBridgeQuality: 'compassion',
    }),
    makeTurn(10, {
      adultSelfPresent: true,
      cohesionAwareness: 'connected to her',
    }),
    makeTurn(4, { adultSelfPresent: true }),
    makeTurn(3, { adultSelfPresent: true }),
    makeTurn(2, { adultSelfPresent: true }),
    makeTurn(1, { adultSelfPresent: true, recommendedAction: 'advance' }),
  ];
}

describe('checkStage4Gate — MII-5 canon alignment', () => {
  it('passes when MII-5 satisfied via part.currentRestingPlace', () => {
    const state = makeState({
      parts: [makePart({ currentRestingPlace: 'in my arms, breathing' })],
    });
    const result = checkStage4Gate(state, turnsAllButMii5());
    expect(result.passed).toBe(true);
  });

  it('passes when MII-5 satisfied via partSecured.adultSelfOffering in a turn', () => {
    const turns = turnsAllButMii5();
    turns[3] = makeTurn(4, {
      adultSelfPresent: true,
      partSecured: {
        partDescription: 'a small girl in the corner',
        adultSelfOffering: 'I see you. You are safe with me now.',
      },
    });
    const result = checkStage4Gate(makeState(), turns);
    expect(result.passed).toBe(true);
  });

  it('REGRESSION GUARD: Stage 3 adultSelfQualities no longer satisfies MII-5', () => {
    // Before this PR, the MII-5 fallback read `adultSelfQualities` — a
    // Stage 3 field for the Adult Self's qualities, not a reparenting
    // offering. A user with Stage 3 captured but no offering to a part
    // would have passed MII-5 by accident.
    const turns = turnsAllButMii5();
    turns[3] = makeTurn(4, {
      adultSelfPresent: true,
      adultSelfQualities: 'the calm older me',
    });
    const result = checkStage4Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('mii5_no_reparenting_capacity');
  });

  it('fails MII-5 when no part has a resting place and no offering captured', () => {
    const result = checkStage4Gate(makeState(), turnsAllButMii5());
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('mii5_no_reparenting_capacity');
  });

  it('fails MII-5 when partSecured carries other fields but no offering', () => {
    const turns = turnsAllButMii5();
    turns[3] = makeTurn(4, {
      adultSelfPresent: true,
      partSecured: {
        partDescription: 'a small girl in the corner',
        restingPlace: 'on the sofa',
        // no adultSelfOffering — restingPlace alone is captured by save.ts
        // into the part's currentRestingPlace, but in this test the part
        // landscape doesn't reflect the save yet
      },
    });
    // turn-level offering missing, part landscape lacks resting place
    const result = checkStage4Gate(makeState(), turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('mii5_no_reparenting_capacity');
  });

  it('fails MII-2 when no parts in landscape', () => {
    const state = makeState({
      parts: [],
    });
    const result = checkStage4Gate(state, turnsAllButMii5());
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('mii2_no_parts_recognised');
  });

  it('fails MII-4 when compassion bridge only on one day', () => {
    const sameDay = new Date('2026-06-20');
    const turns: AuditTurn[] = [
      // Five turns with adultSelfPresent for MII-1
      { ...makeTurn(10, { adultSelfPresent: true }), createdAt: new Date('2026-06-17') },
      { ...makeTurn(8, { adultSelfPresent: true, compassionBridgeQuality: 'compassion' }), createdAt: sameDay },
      { ...makeTurn(7, { adultSelfPresent: true, compassionBridgeQuality: 'compassion' }), createdAt: new Date(sameDay.getTime() + 3600 * 1000) },
      { ...makeTurn(3, { adultSelfPresent: true, cohesionAwareness: 'connected' }), createdAt: new Date('2026-06-24') },
      { ...makeTurn(2, { adultSelfPresent: true, cohesionAwareness: 'connected' }), createdAt: new Date('2026-06-25') },
      makeTurn(1, { adultSelfPresent: true, recommendedAction: 'advance' }),
    ];
    const state = makeState({
      parts: [makePart({ currentRestingPlace: 'in my arms' })],
    });
    const result = checkStage4Gate(state, turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('mii4_compassion_bridge_not_landed_twice');
  });

  it('fails MII-3 on recent aborted_overwhelm', () => {
    const turns = turnsAllButMii5();
    turns[5] = makeTurn(2, {
      adultSelfPresent: true,
      practiceRun: { kind: 'canonical', status: 'aborted_overwhelm' },
    });
    const state = makeState({
      parts: [makePart({ currentRestingPlace: 'in my arms' })],
    });
    const result = checkStage4Gate(state, turns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('mii3_recent_overwhelm');
  });

  it('fails without anchor', () => {
    const state = makeState({
      anchorText: null,
      parts: [makePart({ currentRestingPlace: 'in my arms' })],
    });
    const result = checkStage4Gate(state, turnsAllButMii5());
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('anchor_missing');
  });
});
