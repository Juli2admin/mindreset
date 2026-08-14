// Middle Layer PR 11 (2026-08-14) — the behavioural half.
//
// The master prompt used to instruct: "Block 1 IGNORE entirely — these
// belong to Block 2+ and should remain null until then", listing 22 fields.
// The audit measured the consequence: 16 of them are read directly by a
// stage gate or the move lane, and 3 more feed persisted landscape state the
// gates then read. `adultSelfPresent` alone is read by Stages 3, 4, 6, 7 AND
// is the move lane's only real brake.
//
// So a model that believed it was still in "Block 1" — a phase with no
// persisted representation and no reset rule — was instructed to withhold
// the very observations both advancement lanes need, indefinitely.
//
// WHAT THIS FILE ASSERTS, and deliberately no more (owner correction 3):
//
//   Absence of a share-back does not SUPPRESS otherwise-valid gate inputs.
//   When these events genuinely occur and are recorded, their gates consume
//   them exactly as before.
//
// WHAT IT DOES NOT ASSERT: that any user reaches any stage. Advancement is
// not the claim. Every gate must still independently satisfy all of its
// normal criteria, and each test below shows the gate STILL FAILING on its
// other requirements while the specific input is credited. That pairing is
// the point: the input is consumed, and consuming it advances nobody by
// itself.
//
// No `formulation_confirmed` appears anywhere in these windows.

import { describe, expect, it } from 'vitest';
import {
  checkStage3Gate,
  checkStage4Gate,
  checkStage6Gate,
  checkStage7Gate,
} from './stage-gates';
import { getStageFromTurnMoves, checkMoveBasedAdvance } from './move-based-advance';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import { MIDDLE_LAYER_STATE_NONE } from '../middleLayer/sufficiency';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_pr11',
    currentStage: 3,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-01'),
    lastActivityAt: new Date('2026-07-18'),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-06-02'),
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'visual',
    adultSelfQualities: null,
    lastIntensity: 4,
    lastIntensityAt: new Date('2026-07-18'),
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
    sessionCount: 6,
    daysEngaged: 10,
    thisSessionMessageCount: 4,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
    taskContract: null,
    onboardingAnswers: null,
    closureProcess: CLOSURE_PROCESS_NONE,
    // The conservative default: nothing evaluated, Rung 1. These users have
    // NOT earned depth — which is exactly the point. Recording an
    // observation is not the same as being licensed to act on it.
    middleLayer: MIDDLE_LAYER_STATE_NONE,
    workingMemory: null,
    ...overrides,
  };
}

/** `daysAgo` spaces turns across distinct days for the reproducibility checks. */
function makeTurn(daysAgo: number, report: Partial<StateReport> = {}): AuditTurn {
  const d = new Date('2026-07-18');
  d.setDate(d.getDate() - daysAgo);
  const full: StateReport = {
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
    intensityReported: full.intensity,
    safetyFlag: full.safetyFlag,
    recommendedAction: full.recommendedAction,
    report: full,
  };
}

/** Every window in this file is share-back-free. Asserted, not assumed. */
function assertNoShareBack(turns: AuditTurn[]): void {
  for (const t of turns) {
    expect(t.report.readinessTouched ?? []).not.toContain('formulation_confirmed');
  }
}

describe('observerSeatTouched / adultSelfQualities / adultSelfPresent reach the Stage 3 gate', () => {
  const turns = (): AuditTurn[] => [
    makeTurn(6, { observerSeatTouched: true, adultSelfPresent: true }),
    makeTurn(4, {
      adultSelfQualities: 'the calm older me who has seen worse',
      adultSelfPresent: true,
      adultSelfAnchorLinked: true,
    }),
    makeTurn(2, { adultSelfPresent: true, heldEmotionInAdultSelf: true }),
  ];

  it('each input is credited — none of their reasons fire', () => {
    const t = turns();
    assertNoShareBack(t);
    const r = checkStage3Gate(makeState(), t);
    for (const reason of [
      'observer_seat_not_touched',
      'adult_self_qualities_not_captured',
      'adult_self_not_reproducible_across_days',
      'adult_self_not_linked_to_anchor',
      'emotion_not_held_in_adult_self',
    ]) {
      expect(r.reasons).not.toContain(reason);
    }
  });

  it('and the gate is still an independent gate — it fails when a guard is unmet', () => {
    const t = turns();
    t[t.length - 1].report.intensity = 8;
    t[t.length - 1].intensityReported = 8;
    const r = checkStage3Gate(makeState(), t);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain('recent_intensity_above_5');
  });

  it('withholding the same observations blocks the gate — proving they are load-bearing', () => {
    // The counterfactual the old instruction produced.
    const silent = [makeTurn(6, {}), makeTurn(4, {}), makeTurn(2, {})];
    const r = checkStage3Gate(makeState(), silent);
    expect(r.passed).toBe(false);
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        'observer_seat_not_touched',
        'adult_self_qualities_not_captured',
        'adult_self_not_linked_to_anchor',
        'emotion_not_held_in_adult_self',
      ]),
    );
  });
});

describe('compassionBridgeQuality / cohesionAwareness / partSecured reach the Stage 4 gate', () => {
  const turns = (): AuditTurn[] => [
    makeTurn(8, { compassionBridgeQuality: 'compassion', cohesionAwareness: 'they can share the room' }),
    makeTurn(6, { compassionBridgeQuality: 'curiosity', cohesionAwareness: 'less at war today' }),
    makeTurn(4, {
      partSecured: {
        partDescription: 'the one who braces before she speaks',
        adultSelfOffering: 'I will come back for you',
      },
    }),
    makeTurn(3, { adultSelfPresent: true }),
    makeTurn(2, { adultSelfPresent: true }),
  ];

  it('each input is credited — none of their MII reasons fire', () => {
    const t = turns();
    assertNoShareBack(t);
    const r = checkStage4Gate(makeState({ currentStage: 4 }), t);
    for (const reason of [
      'mii4_compassion_bridge_not_landed_twice',
      'mii5_no_reparenting_capacity',
      'mii7_cohesion_awareness_missing',
    ]) {
      expect(r.reasons).not.toContain(reason);
    }
  });

  it('and the gate still fails on the MII criteria these do not cover', () => {
    const r = checkStage4Gate(makeState({ currentStage: 4 }), turns());
    expect(r.passed).toBe(false);
    expect(r.reasons).toEqual(
      expect.arrayContaining(['mii1_adult_self_unstable', 'mii2_no_parts_recognised']),
    );
  });
});

describe('internalConsensus / selfLoyaltyStatement / oneSmallAction reach the Stage 6 gate', () => {
  const turns = (): AuditTurn[] => [
    makeTurn(8, { internalConsensus: true }),
    makeTurn(5, { internalConsensus: true, selfLoyaltyStatement: 'I stay on my own side' }),
    makeTurn(3, { oneSmallAction: 'say no to the Saturday shift' }),
    makeTurn(2, { adultSelfPresent: true }),
  ];

  it('each input is credited', () => {
    const t = turns();
    assertNoShareBack(t);
    const r = checkStage6Gate(makeState({ currentStage: 6 }), t);
    for (const reason of [
      'internal_consensus_not_reached_on_two_days',
      'self_loyalty_statement_missing',
      'one_small_action_missing',
    ]) {
      expect(r.reasons).not.toContain(reason);
    }
  });

  it('and the gate still fails on its own independent requirements', () => {
    const r = checkStage6Gate(makeState({ currentStage: 6 }), turns());
    expect(r.passed).toBe(false);
    expect(r.reasons).toEqual(
      expect.arrayContaining(['identity_anchor_not_set', 'no_parts_in_landscape_for_cohesion_check']),
    );
  });
});

describe('emergingQualities / urgencyMarkers reach the Stage 7 gate', () => {
  const turns = (): AuditTurn[] => [
    makeTurn(8, { emergingQualities: ['steadier', 'less apologetic'] }),
    makeTurn(5, { emergingQualities: ['able to wait before answering'] }),
    makeTurn(2, { adultSelfPresent: true }),
  ];

  it('emerging qualities are credited — count and distinct-day both satisfied', () => {
    const t = turns();
    assertNoShareBack(t);
    const r = checkStage7Gate(makeState({ currentStage: 7 }), t);
    expect(r.reasons).not.toContain('fewer_than_three_emerging_qualities');
    expect(r.reasons).not.toContain('qualities_not_captured_across_two_days');
  });

  it('withholding them re-fires both reasons — proving they are load-bearing', () => {
    const silent = [makeTurn(8, {}), makeTurn(5, {}), makeTurn(2, {})];
    const r = checkStage7Gate(makeState({ currentStage: 7 }), silent);
    expect(r.reasons).toContain('fewer_than_three_emerging_qualities');
    expect(r.reasons).toContain('qualities_not_captured_across_two_days');
  });

  it('urgency is still read as a non-negotiable blocker when it is reported', () => {
    const t = [...turns(), makeTurn(1, { urgencyMarkers: 'present' })];
    const r = checkStage7Gate(makeState({ currentStage: 7 }), t);
    expect(r.passed).toBe(false);
    // Recording the marker is what lets the gate see it at all.
    expect(r.reasons).toContain('urgency_present_in_recent_turns');
  });
});

describe('adultSelfPresent still brakes the move lane', () => {
  // The lane's only real brake. If PR 11 had made recording optional or
  // encouraged over-emission, this is where it would show.
  const moveTurn = (daysAgo: number, adultSelf: boolean): AuditTurn =>
    makeTurn(daysAgo, {
      moveJustPerformed: ['stage_4.first_contact'],
      adultSelfPresent: adultSelf,
    });

  it('recorded adult-self presence lets the lane advance', () => {
    const t = [moveTurn(4, true), moveTurn(3, true), moveTurn(2, true), moveTurn(1, true)];
    expect(checkMoveBasedAdvance(3, t).canAdvance).toBe(true);
  });

  it('absent adult-self presence still refuses, on the identical moves', () => {
    const t = [moveTurn(4, false), moveTurn(3, false), moveTurn(2, false), moveTurn(1, false)];
    const r = checkMoveBasedAdvance(3, t);
    expect(r.canAdvance).toBe(false);
    expect(r.reason).toMatch(/adult self present in only/);
  });
});

describe("PR 7' still refuses unlicensed Rung-3 credit for a recorded claim", () => {
  // The load-bearing pairing for this PR: recording is not licensing.
  // Group C tells the model to record what happened; the rung still decides
  // what that recording earns.
  it('a recorded Rung-3 move earns no advancement credit at Rung 1', () => {
    const t = makeTurn(1, {
      moveJustPerformed: ['stage_5.symbolic_return', 'stage_2.affect_labelling_and_somatic_mapping'],
    });
    // Unlicensed: the Rung-3 ID is skipped, the Rung-2 sibling still counts.
    expect(getStageFromTurnMoves(t, false)).toBe(2);
    // Licensed: the Rung-3 ID counts.
    expect(getStageFromTurnMoves(t, true)).toBe(5);
  });

  it('the claim is not erased — only its credit is refused', () => {
    const t = makeTurn(1, { moveJustPerformed: ['stage_5.symbolic_return'] });
    expect(t.report.moveJustPerformed).toContain('stage_5.symbolic_return');
    expect(getStageFromTurnMoves(t, false)).toBeNull();
  });
});
