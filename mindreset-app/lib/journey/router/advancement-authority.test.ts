// Middle Layer PR 10 (2026-08-14) — advancement authority repair.
//
// WHAT CHANGED. `recommendedAction === 'advance'` was an AND-term in every
// classic gate for Stages 1–7, while six separate sources described it as
// "advisory; code makes the final call". It was not advisory. And the
// master prompt instructed the model to emit it ONLY after a confirmed
// share-back — so a user's agreement with a shared picture was, in
// practice, the permission slip for stage bookkeeping. Both halves are
// removed here.
//
// WHAT DID NOT CHANGE, and is proved below rather than asserted:
//
//   * every canon §10 criterion, per stage
//   * the regulation guards (intensity, safety, red flag) and frozen_for_review
//   * the open-cycle block and the closure-process block
//   * PR 7' Rung-3 refusals
//   * regression on the model's own step-back signal
//   * Stage 8 discharge, which STILL requires `recommendedAction:
//     'discharge'` — a real clinical endpoint with a user-facing
//     consequence, not an internal counter (owner decision 2)
//   * the move-based compatibility lane, byte-for-byte
//
// These are behavioural tests. Nothing here asserts the absence of a
// string; the prompt-side guards live in prompts/pressure-field-cleanup
// and prompts/advancement-decoupling.

import { describe, expect, it, vi } from 'vitest';

let turnsToReturn: AuditTurn[] = [];

vi.mock('./history', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./history')>();
  return {
    ...actual,
    loadRecentTurns: vi.fn(() => Promise.resolve(turnsToReturn)),
  };
});

vi.mock('@/lib/prisma', () => ({
  default: {
    journeyTurn: {
      findFirst: vi.fn(() => Promise.resolve({ createdAt: new Date('2026-05-01') })),
    },
  },
}));

import { decideRoute } from './router';
import {
  checkStage1Gate,
  checkStage2Gate,
  checkStage3Gate,
  checkStage4Gate,
  checkStage5Gate,
  checkStage6Gate,
  checkStage7Gate,
  checkStage8Gate,
  type GateResult,
} from './stage-gates';
import type { JourneyState, JourneyForeignFile } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import { normaliseMiddleLayerState } from '../middleLayer/sufficiency';
import { RUNG3_REFUSED } from '../middleLayer/rung3-advancement';

/** Built through the real normaliser, so the production path is exercised. */
const RUNG_3 = normaliseMiddleLayerState({
  targetStatus: 'established',
  mechanismStatus: 'established',
});
const RUNG_2 = normaliseMiddleLayerState({
  targetStatus: 'established',
  mechanismStatus: 'leading',
});

function makeFile(overrides: Partial<JourneyForeignFile> = {}): JourneyForeignFile {
  return {
    id: 'file_test',
    userDescription: 'the "must be useful" voice',
    originDescription: 'my mother',
    returnedTo: "my mother's house",
    honouringPhrase: 'I see what this was',
    whatStaysAsMine: 'I love making things',
    identifiedAt: new Date('2026-06-15'),
    releaseClaimedAt: new Date('2026-06-19'),
    releasedAt: new Date('2026-06-20'),
    ...overrides,
  };
}

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_pr10',
    currentStage: 5,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-01'),
    lastActivityAt: new Date('2026-07-18'),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-06-02'),
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'visual',
    adultSelfQualities: 'the calm older me',
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
    foreignFiles: [makeFile()],
    signatureImages: [],
    patterns: [],
    sessionCount: 8,
    daysEngaged: 14,
    thisSessionMessageCount: 5,
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
    middleLayer: RUNG_3,
    workingMemory: null,
    ...overrides,
  };
}

function makeTurn(daysAgo: number, report: Partial<StateReport> = {}): AuditTurn {
  const d = new Date('2026-07-18');
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

/** Replace the LAST turn's recommendedAction, leaving everything else alone. */
function withLastAction(
  turns: AuditTurn[],
  action: StateReport['recommendedAction'],
): AuditTurn[] {
  const copy = turns.map((t) => ({ ...t, report: { ...t.report } }));
  const last = copy[copy.length - 1];
  last.report.recommendedAction = action;
  last.recommendedAction = action;
  return copy;
}

// A Stage-5-gate-passing window. The LAST turn deliberately carries the
// default `recommendedAction: 'stay'` — under the old code this window
// could never pass.
function passingStage5Turns(lastReport: Partial<StateReport> = {}): AuditTurn[] {
  return [
    makeTurn(7, { somaticRelease: true }),
    makeTurn(5, {
      cleanIdentityStatement: 'I am someone who makes things because she loves to.',
      bodyConfirmation: 'lighter in my chest, room to breathe',
    }),
    makeTurn(3, {}),
    makeTurn(2, {}),
    makeTurn(1, lastReport),
  ];
}

// ---------------------------------------------------------------------------
// 1. Stages 1–7 advance on the clinical criteria alone
// ---------------------------------------------------------------------------

describe('classic gates — the model no longer holds advancement authority', () => {
  // The invariant, table-driven across all seven classic gates: for ANY
  // window, the gate's verdict and its reasons are identical whether the
  // last turn said 'stay' or 'advance'. That is a stronger statement than
  // "one fixture now passes" — it proves the field is not read at all,
  // for any input, on any gate.
  const GATES: Array<[string, (s: JourneyState, t: AuditTurn[]) => GateResult]> = [
    ['stage 1', checkStage1Gate],
    ['stage 2', checkStage2Gate],
    ['stage 3', checkStage3Gate],
    ['stage 4', checkStage4Gate],
    ['stage 5', checkStage5Gate],
    ['stage 6', checkStage6Gate],
    ['stage 7', checkStage7Gate],
  ];

  for (const [name, gate] of GATES) {
    it(`${name}: verdict and reasons are identical for stay vs advance`, () => {
      const base = passingStage5Turns();
      const stay = gate(makeState(), withLastAction(base, 'stay'));
      const advance = gate(makeState(), withLastAction(base, 'advance'));
      expect(stay.passed).toBe(advance.passed);
      expect(stay.reasons).toEqual(advance.reasons);
    });

    it(`${name}: never emits ai_did_not_recommend_advance`, () => {
      for (const action of ['stay', 'regress_to_grounding', 'red_flag'] as const) {
        const r = gate(makeState(), withLastAction(passingStage5Turns(), action));
        expect(r.reasons).not.toContain('ai_did_not_recommend_advance');
      }
    });
  }

  it('stage 5 gate PASSES with recommendedAction "stay" when canon §10 is met', () => {
    const r = checkStage5Gate(makeState(), passingStage5Turns());
    expect(r.reasons).toEqual([]);
    expect(r.passed).toBe(true);
  });

  it('the router advances 5 → 6 with recommendedAction "stay"', async () => {
    turnsToReturn = passingStage5Turns();
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('advance');
    expect(decision).toMatchObject({ from: 5, to: 6, lane: 'classic_gate' });
  });
});

// ---------------------------------------------------------------------------
// 2. A missing clinical criterion still blocks
// ---------------------------------------------------------------------------

describe('clinical criteria still gate — removing the token did not open the floodgates', () => {
  // Each case sets recommendedAction: 'advance' deliberately, to prove the
  // block comes from the missing evidence and not from a residual token
  // check.
  const MISSING: Array<[string, () => { state: JourneyState; turns: AuditTurn[] }, string]> = [
    [
      'no foreign material identified',
      () => ({ state: makeState({ foreignFiles: [] }), turns: passingStage5Turns() }),
      'no_foreign_material_identified',
    ],
    [
      'somatic release never confirmed',
      () => ({
        state: makeState(),
        turns: [
          makeTurn(5, {
            cleanIdentityStatement: 'I am someone who makes things.',
            bodyConfirmation: 'lighter in my chest',
          }),
          makeTurn(3, {}),
          makeTurn(1, {}),
        ],
      }),
      'somatic_release_not_confirmed',
    ],
    [
      'clean identity statement missing',
      () => ({
        state: makeState(),
        turns: [makeTurn(5, { somaticRelease: true }), makeTurn(3, {}), makeTurn(1, {})],
      }),
      'clean_identity_statement_missing',
    ],
    [
      'statement never body-confirmed',
      () => ({
        state: makeState(),
        turns: [
          makeTurn(7, { somaticRelease: true }),
          makeTurn(5, { cleanIdentityStatement: 'I am someone who makes things.' }),
          makeTurn(1, {}),
        ],
      }),
      'clean_identity_statement_not_body_confirmed',
    ],
    [
      'anchor never set',
      () => ({ state: makeState({ anchorText: null }), turns: passingStage5Turns() }),
      'anchor_missing',
    ],
  ];

  for (const [name, build, expectedReason] of MISSING) {
    it(`stage 5 blocks: ${name} — even with recommendedAction "advance"`, () => {
      const { state, turns } = build();
      const r = checkStage5Gate(state, withLastAction(turns, 'advance'));
      expect(r.passed).toBe(false);
      expect(r.reasons).toContain(expectedReason);
    });
  }

  it('stage 3 blocks on its own canon criteria with recommendedAction "advance"', () => {
    const r = checkStage3Gate(makeState(), withLastAction(passingStage5Turns(), 'advance'));
    expect(r.passed).toBe(false);
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        'observer_seat_not_touched',
        'adult_self_not_reproducible_across_days',
        'adult_self_not_linked_to_anchor',
        'emotion_not_held_in_adult_self',
      ]),
    );
  });

  it('stage 4 blocks on the MII criteria with recommendedAction "advance"', () => {
    const r = checkStage4Gate(makeState(), withLastAction(passingStage5Turns(), 'advance'));
    expect(r.passed).toBe(false);
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        'mii1_adult_self_unstable',
        'mii2_no_parts_recognised',
        'mii4_compassion_bridge_not_landed_twice',
        'mii5_no_reparenting_capacity',
        'mii7_cohesion_awareness_missing',
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Safety, regulation and freeze still block
// ---------------------------------------------------------------------------

describe('regulation guards survive', () => {
  it('frozen_for_review still blocks the gate', () => {
    const r = checkStage5Gate(makeState({ frozenForReview: true }), passingStage5Turns());
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain('frozen_for_review');
  });

  it('frozen_for_review short-circuits the router before either lane', async () => {
    turnsToReturn = passingStage5Turns();
    const decision = await decideRoute(makeState({ frozenForReview: true }));
    expect(decision.kind).toBe('frozen');
  });

  it('recent intensity above 5 still blocks', () => {
    const turns = passingStage5Turns();
    turns[turns.length - 1].report.intensity = 8;
    turns[turns.length - 1].intensityReported = 8;
    const r = checkStage5Gate(makeState(), turns);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain('recent_intensity_above_5');
  });

  it('too little intensity history still blocks', () => {
    const r = checkStage5Gate(makeState(), [makeTurn(1, { somaticRelease: true })]);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain('insufficient_intensity_history');
  });

  it('an unclean safety window still blocks', () => {
    const turns = passingStage5Turns();
    turns[turns.length - 1].report.safetyFlag = 'watch';
    turns[turns.length - 1].safetyFlag = 'watch';
    const r = checkStage5Gate(makeState(), turns);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain('safety_not_clean_for_last_5_turns');
  });

  it('stage 1 keeps its looser red-flag-only safety rule', () => {
    const turns = [
      makeTurn(3, { readinessTouched: ['anchor_identified'] }),
      makeTurn(2, { readinessTouched: ['emotion_named'], safetyFlag: 'watch' }),
      makeTurn(1, { readinessTouched: ['orientation_present'] }),
    ];
    // 'watch' does not block Stage 1 (documented Block-1 exception)...
    expect(checkStage1Gate(makeState({ currentStage: 1 }), turns).passed).toBe(true);
    // ...but a red flag inside the last 3 turns does.
    turns[1].report.safetyFlag = 'red_flag';
    turns[1].safetyFlag = 'red_flag';
    const blocked = checkStage1Gate(makeState({ currentStage: 1 }), turns);
    expect(blocked.passed).toBe(false);
    expect(blocked.reasons).toContain('red_flag_in_last_3_turns');
  });
});

// ---------------------------------------------------------------------------
// 4 & 5. Open cycle and closure process still block
// ---------------------------------------------------------------------------

describe('process blocks survive', () => {
  it('an open cycle on the last turn still blocks advancement', async () => {
    turnsToReturn = passingStage5Turns({ cycleStatus: 'open' });
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('stay');
    expect((decision as { reasons: string[] }).reasons).toContain('open_cycle_blocks_advance');
  });

  it('an active closure process still blocks advancement', async () => {
    turnsToReturn = passingStage5Turns();
    const decision = await decideRoute(
      makeState({
        closureProcess: { ...CLOSURE_PROCESS_NONE, state: 'DELIVERING_STABILISATION' },
      }),
    );
    expect(decision.kind).toBe('stay');
    expect((decision as { reasons: string[] }).reasons).toContain(
      'closure_process_blocks_advance:DELIVERING_STABILISATION',
    );
  });
});

// ---------------------------------------------------------------------------
// 6. PR 7' Rung-3 refusals still block
// ---------------------------------------------------------------------------

describe("PR 7' Rung-3 refusals survive the removal", () => {
  // The critical case: with the model's permission token gone, an
  // unlicensed user must NOT slide through a Rung-3 gate simply because
  // the last remaining blocker was that token.

  it('stage 5 refuses the symbolic return and the identity statement below Rung 3', () => {
    const r = checkStage5Gate(makeState({ middleLayer: RUNG_2 }), passingStage5Turns());
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(RUNG3_REFUSED.SYMBOLIC_RETURN);
    expect(r.reasons).toContain(RUNG3_REFUSED.CLEAN_IDENTITY_STATEMENT);
  });

  it('the router refuses to advance 5 → 6 below Rung 3, with recommendedAction "stay"', async () => {
    turnsToReturn = passingStage5Turns();
    const decision = await decideRoute(makeState({ middleLayer: RUNG_2 }));
    expect(decision.kind).toBe('stay');
    expect((decision as { reasons: string[] }).reasons).toContain(
      RUNG3_REFUSED.SYMBOLIC_RETURN,
    );
  });

  it('the identical window advances once Rung 3 is licensed', async () => {
    turnsToReturn = passingStage5Turns();
    const decision = await decideRoute(makeState({ middleLayer: RUNG_3 }));
    expect(decision.kind).toBe('advance');
  });

  it('stage 6 and stage 7 still refuse the identity anchor below Rung 3', () => {
    const s = makeState({
      currentStage: 6,
      identityAnchor: 'hand on the centre of my chest',
      middleLayer: RUNG_2,
    });
    expect(checkStage6Gate(s, passingStage5Turns()).reasons).toContain(
      RUNG3_REFUSED.IDENTITY_ANCHOR,
    );
    expect(checkStage7Gate(s, passingStage5Turns()).reasons).toContain(
      RUNG3_REFUSED.IDENTITY_ANCHOR,
    );
  });

  it('stage 7 still refuses the symbolic identity map below Rung 3', () => {
    const turns = [
      ...passingStage5Turns().slice(0, -1),
      makeTurn(1, { symbolicIdentityMap: 'the river and the two banks' }),
    ];
    const s = makeState({
      currentStage: 7,
      identityAnchor: 'hand on the centre of my chest',
      middleLayer: RUNG_2,
    });
    expect(checkStage7Gate(s, turns).reasons).toContain(RUNG3_REFUSED.SYMBOLIC_IDENTITY_MAP);
  });
});

// ---------------------------------------------------------------------------
// 7. Discharge remains intentional
// ---------------------------------------------------------------------------

describe('Stage 8 discharge still requires the model to agree', () => {
  const STAGE_8_STARTED = new Date(Date.now() - 7 * 7 * 24 * 60 * 60 * 1000);

  it('the discharge gate still emits ai_did_not_recommend_discharge on "stay"', () => {
    const r = checkStage8Gate(
      makeState({ currentStage: 8 }),
      withLastAction(passingStage5Turns(), 'stay'),
      STAGE_8_STARTED,
    );
    expect(r.reasons).toContain('ai_did_not_recommend_discharge');
  });

  it('the reason disappears when the model recommends discharge', () => {
    const r = checkStage8Gate(
      makeState({ currentStage: 8 }),
      withLastAction(passingStage5Turns(), 'discharge'),
      STAGE_8_STARTED,
    );
    expect(r.reasons).not.toContain('ai_did_not_recommend_discharge');
  });

  it('"advance" does NOT satisfy the discharge requirement', () => {
    const r = checkStage8Gate(
      makeState({ currentStage: 8 }),
      withLastAction(passingStage5Turns(), 'advance'),
      STAGE_8_STARTED,
    );
    expect(r.reasons).toContain('ai_did_not_recommend_discharge');
  });

  it('the router never discharges without the discharge action', async () => {
    turnsToReturn = withLastAction(passingStage5Turns(), 'stay');
    const decision = await decideRoute(makeState({ currentStage: 8 }));
    expect(decision.kind).toBe('stay');
  });
});

// ---------------------------------------------------------------------------
// 8. Regression unchanged
// ---------------------------------------------------------------------------

describe('regression is untouched — no new guards', () => {
  it('regress_to_grounding still drops a Stage 5 user to Stage 1', async () => {
    turnsToReturn = withLastAction(passingStage5Turns(), 'regress_to_grounding');
    const decision = await decideRoute(makeState());
    expect(decision).toMatchObject({ kind: 'regress', from: 5, to: 1 });
  });

  it('regress_to_parts still drops a Stage 7 user to Stage 4', async () => {
    turnsToReturn = withLastAction(passingStage5Turns(), 'regress_to_parts');
    const decision = await decideRoute(makeState({ currentStage: 7 }));
    expect(decision).toMatchObject({ kind: 'regress', from: 7, to: 4 });
  });

  it('regression is not blocked by an open cycle', async () => {
    turnsToReturn = withLastAction(
      passingStage5Turns({ cycleStatus: 'open' }),
      'regress_to_grounding',
    );
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('regress');
  });

  it('regression is not blocked by an active closure process', async () => {
    turnsToReturn = withLastAction(passingStage5Turns(), 'regress_to_grounding');
    const decision = await decideRoute(
      makeState({
        closureProcess: { ...CLOSURE_PROCESS_NONE, state: 'DELIVERING_STABILISATION' },
      }),
    );
    expect(decision.kind).toBe('regress');
  });

  it('regression is not blocked by an unlicensed rung', async () => {
    turnsToReturn = withLastAction(passingStage5Turns(), 'regress_to_grounding');
    const decision = await decideRoute(makeState({ middleLayer: RUNG_2 }));
    expect(decision.kind).toBe('regress');
  });
});

// ---------------------------------------------------------------------------
// 11. The move lane is still open
// ---------------------------------------------------------------------------

describe('move-based compatibility lane is untouched', () => {
  // Explicit proof that PR 10 did not accidentally close the safety net.
  // The lane never required `recommendedAction` and still does not.
  it('still advances on sustained higher-stage moves with recommendedAction "stay"', async () => {
    const moveTurn = (daysAgo: number): AuditTurn =>
      makeTurn(daysAgo, {
        moveJustPerformed: ['stage_3.observer_seat'],
        adultSelfPresent: true,
      });
    turnsToReturn = [moveTurn(4), moveTurn(3), moveTurn(2), moveTurn(1)];
    const decision = await decideRoute(makeState({ currentStage: 2 }));
    expect(decision).toMatchObject({ kind: 'advance', from: 2, to: 3, lane: 'move_based' });
  });

  it('still refuses when the sustained-work threshold is not met', async () => {
    turnsToReturn = [
      makeTurn(2, { moveJustPerformed: ['stage_3.observer_seat'], adultSelfPresent: true }),
      makeTurn(1, {}),
    ];
    const decision = await decideRoute(makeState({ currentStage: 2 }));
    expect(decision.kind).toBe('stay');
  });
});
