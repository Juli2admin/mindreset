// Tests for the Activated Closure progression block — Phase 1 (2026-08-05).
//
// The rule under test: while a closure sequence is mid-flight the user is
// being brought to a safe stop, so no stage advancement, discharge or depth
// DEEPENING may be RECORDED until the process reaches NONE, CLOSED or
// INCOMPLETE.
//
// Two properties matter as much as the block itself:
//   * regression and shallowing stay available — stepping back during a
//     closure is legitimate clinical movement;
//   * the block reads SERVER-OWNED process state off RecodeProgress. It is
//     not cycleStatus, does not replace the open-cycle guard, and neither
//     authority is derived from the other.

import { describe, expect, it, vi } from 'vitest';

let turnsToReturn: AuditTurn[] = [];

vi.mock('../router/history', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../router/history')>();
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

import { decideRoute } from '../router/router';
import { shouldHoldDepthAdvance } from '../state/save';
import {
  CLOSURE_PROCESS_NONE,
  CLOSURE_PROCESS_STATES,
  isActiveProcessState,
  type ClosureProcess,
  type ClosureProcessState,
} from './process';
import type { JourneyState, JourneyForeignFile } from '../state/types';
import type { AuditTurn } from '../router/history';
import type { StateReport } from '../stateReport/schema';

function closureProcess(state: ClosureProcessState): ClosureProcess {
  return {
    ...CLOSURE_PROCESS_NONE,
    state,
    route: state === 'NONE' ? null : 'ACTIVATED_CLOSE',
    enteredAt: state === 'NONE' ? null : new Date('2026-07-18T09:00:00Z'),
    transitionedAt: state === 'NONE' ? null : new Date('2026-07-18T09:30:00Z'),
  };
}

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
    userId: 'user_test_closure_progression',
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
    id: `turn_${daysAgo}_${fullReport.recommendedAction}`,
    createdAt: d,
    stageAtTurn: 5,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

// A Stage-5-gate-passing turn window (mirrors open-cycle-guard.test.ts), so
// the ONLY thing standing between this state and an advance is the block
// under test.
function passingStage5Turns(lastReport: Partial<StateReport> = {}): AuditTurn[] {
  return [
    makeTurn(7, { somaticRelease: true }),
    makeTurn(5, {
      cleanIdentityStatement: 'I am someone who makes things because she loves to.',
      bodyConfirmation: 'lighter in my chest, room to breathe',
    }),
    makeTurn(3, {}),
    makeTurn(2, {}),
    makeTurn(1, { recommendedAction: 'advance', ...lastReport }),
  ];
}

const ACTIVE_STATES = CLOSURE_PROCESS_STATES.filter(isActiveProcessState);

// ---------------------------------------------------------------------------
// Stage advancement
// ---------------------------------------------------------------------------
describe('decideRoute — stage advancement during a closure process', () => {
  it.each(ACTIVE_STATES)('blocks advancement while %s', async (state) => {
    turnsToReturn = passingStage5Turns();
    const decision = await decideRoute(
      makeState({ closureProcess: closureProcess(state) }),
    );
    expect(decision.kind).toBe('stay');
    expect((decision as { kind: 'stay'; reasons: string[] }).reasons).toContain(
      `closure_process_blocks_advance:${state}`,
    );
  });

  it.each(['NONE', 'CLOSED', 'INCOMPLETE'] as ClosureProcessState[])(
    'leaves advancement unchanged for %s',
    async (state) => {
      turnsToReturn = passingStage5Turns();
      const decision = await decideRoute(
        makeState({ closureProcess: closureProcess(state) }),
      );
      expect(decision.kind).toBe('advance');
    },
  );

  it('blocks the move-based lane too, not just the classic gate', async () => {
    // A window that fails the classic Stage 5 gate (no `advance` recommendation
    // and none of its milestones) but satisfies the move-based lane: sustained
    // stage-6 moves, regulated, Adult Self present.
    const moveWindow = () =>
      [4, 3, 2, 1].map((d) =>
        makeTurn(d, {
          moveJustPerformed: ['stage_6.identity_anchoring_ritual'],
          adultSelfPresent: true,
        }),
      );

    // Control: with no closure process the move-based lane fires.
    turnsToReturn = moveWindow();
    const control = await decideRoute(
      makeState({ closureProcess: closureProcess('NONE') }),
    );
    expect(control.kind).toBe('advance');
    expect((control as { kind: 'advance'; lane: string }).lane).toBe('move_based');

    // Same window, closure in flight → held.
    turnsToReturn = moveWindow();
    const blocked = await decideRoute(
      makeState({ closureProcess: closureProcess('AWAITING_POST_SCORE') }),
    );
    expect(blocked.kind).toBe('stay');
    expect((blocked as { kind: 'stay'; reasons: string[] }).reasons).toContain(
      'closure_process_blocks_advance:AWAITING_POST_SCORE',
    );
  });
});

// ---------------------------------------------------------------------------
// Discharge
// ---------------------------------------------------------------------------
describe('decideRoute — discharge during a closure process', () => {
  it.each(ACTIVE_STATES)('blocks discharge at Stage 8 while %s', async (state) => {
    turnsToReturn = [makeTurn(1, { recommendedAction: 'discharge' })];
    const decision = await decideRoute(
      makeState({ currentStage: 8, closureProcess: closureProcess(state) }),
    );
    expect(decision.kind).toBe('stay');
    expect((decision as { kind: 'stay'; reasons: string[] }).reasons).toContain(
      `closure_process_blocks_discharge:${state}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Regression stays available
// ---------------------------------------------------------------------------
describe('decideRoute — regression is never blocked by a closure process', () => {
  it.each(ACTIVE_STATES)('still regresses to grounding while %s', async (state) => {
    turnsToReturn = [makeTurn(1, { recommendedAction: 'regress_to_grounding' })];
    const decision = await decideRoute(
      makeState({ closureProcess: closureProcess(state) }),
    );
    expect(decision.kind).toBe('regress');
  });

  it('still honours a freeze ahead of everything else', async () => {
    turnsToReturn = passingStage5Turns();
    const decision = await decideRoute(
      makeState({
        frozenForReview: true,
        frozenReason: 'red_flag',
        closureProcess: closureProcess('AWAITING_POST_SCORE'),
      }),
    );
    expect(decision.kind).toBe('frozen');
  });
});

// ---------------------------------------------------------------------------
// The two authorities stay separate
// ---------------------------------------------------------------------------
describe('closure process and cycleStatus are separate authorities', () => {
  it('an open cycle still blocks on its own when the process is NONE', async () => {
    turnsToReturn = passingStage5Turns({ cycleStatus: 'open' });
    const decision = await decideRoute(
      makeState({ closureProcess: closureProcess('NONE') }),
    );
    expect((decision as { kind: 'stay'; reasons: string[] }).reasons).toContain(
      'open_cycle_blocks_advance',
    );
  });

  it('a model-reported closed cycle does not unblock an active process', async () => {
    turnsToReturn = passingStage5Turns({ cycleStatus: 'closed' });
    const decision = await decideRoute(
      makeState({
        hasOpenCycle: false,
        closureProcess: closureProcess('AWAITING_CLOSE_CONFIRMATION'),
      }),
    );
    expect(decision.kind).toBe('stay');
    expect((decision as { kind: 'stay'; reasons: string[] }).reasons).toContain(
      'closure_process_blocks_advance:AWAITING_CLOSE_CONFIRMATION',
    );
  });
});

// ---------------------------------------------------------------------------
// Depth (save layer)
// ---------------------------------------------------------------------------
describe('shouldHoldDepthAdvance — save layer', () => {
  it.each(ACTIVE_STATES)('holds a deepening while %s', (state) => {
    expect(shouldHoldDepthAdvance(state, 'surface', 'middle')).toBe(true);
    expect(shouldHoldDepthAdvance(state, 'middle', 'deep')).toBe(true);
    expect(shouldHoldDepthAdvance(state, 'surface', 'deep')).toBe(true);
  });

  it.each(ACTIVE_STATES)('still allows shallowing while %s', (state) => {
    expect(shouldHoldDepthAdvance(state, 'deep', 'surface')).toBe(false);
    expect(shouldHoldDepthAdvance(state, 'deep', 'middle')).toBe(false);
    expect(shouldHoldDepthAdvance(state, 'middle', 'surface')).toBe(false);
  });

  it.each(ACTIVE_STATES)('treats a same-depth write as no advance while %s', (state) => {
    expect(shouldHoldDepthAdvance(state, 'middle', 'middle')).toBe(false);
  });

  it.each(['NONE', 'CLOSED', 'INCOMPLETE'])('never holds depth for %s', (state) => {
    expect(shouldHoldDepthAdvance(state, 'surface', 'deep')).toBe(false);
  });

  it('never holds depth for an unrecognised or absent process state', () => {
    expect(shouldHoldDepthAdvance(null, 'surface', 'deep')).toBe(false);
    expect(shouldHoldDepthAdvance(undefined, 'surface', 'deep')).toBe(false);
    expect(shouldHoldDepthAdvance('NOT_A_STATE', 'surface', 'deep')).toBe(false);
  });

  it('treats an unrecognised stored depth as surface rather than inverting', () => {
    expect(shouldHoldDepthAdvance('AWAITING_POST_SCORE', 'nonsense', 'deep')).toBe(true);
    expect(shouldHoldDepthAdvance('AWAITING_POST_SCORE', null, 'surface')).toBe(false);
  });
});
