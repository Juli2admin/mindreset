// Tests for the Journey P1 open-cycle progression guard (2026-07-19,
// audit RC5).
//
// The clinical rule under test: a therapeutic cycle the AI itself reports
// as open (parts contact mid-process, foreign-material work underway,
// somatic activation not yet settled) means unresolved activation — no
// stage advancement and no discharge may fire from that turn. The guard
// sits in decideRoute BEFORE both advancement lanes (classic gate and
// move-based), so one guard covers both. Regression and stay are
// unaffected: stepping back with an open cycle is legitimate clinical
// movement. Only the LAST turn's cycleStatus is read, so a stale 'open'
// from an earlier turn self-heals on the next report.

import { describe, expect, it, vi } from 'vitest';

// decideRoute loads turns via loadRecentTurns and (on the Stage 8 path)
// reads prisma directly. Partial-mock history so the gate helper functions
// stage-gates.ts imports stay real.
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
      findFirst: vi.fn(() =>
        Promise.resolve({ createdAt: new Date('2026-05-01') }),
      ),
    },
  },
}));

import { decideRoute } from './router';
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
    releaseClaimedAt: new Date('2026-06-19'),
    releasedAt: new Date('2026-06-20'),
    ...overrides,
  };
}

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_open_cycle',
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

// A Stage-5-gate-passing turn window (mirrors stage5-gate.test.ts). The
// last turn's report is parameterised so each test controls cycleStatus.
function passingStage5Turns(lastReport: Partial<StateReport>): AuditTurn[] {
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

describe('decideRoute — open-cycle guard', () => {
  it('blocks advancement when the last turn reports an open cycle (gate otherwise passing)', async () => {
    turnsToReturn = passingStage5Turns({ cycleStatus: 'open' });
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('stay');
    expect((decision as { kind: 'stay'; reasons: string[] }).reasons).toContain(
      'open_cycle_blocks_advance',
    );
  });

  it('advances when the identical window closes the cycle', async () => {
    turnsToReturn = passingStage5Turns({ cycleStatus: 'closed' });
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('advance');
  });

  it('does not block when the last turn omits cycleStatus', async () => {
    turnsToReturn = passingStage5Turns({});
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('advance');
  });

  it("SELF-HEAL: an earlier turn's stale 'open' does not block once the last turn closes", async () => {
    const turns = passingStage5Turns({ cycleStatus: 'closed' });
    turns[2] = makeTurn(3, { cycleStatus: 'open' });
    turnsToReturn = turns;
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('advance');
  });

  it("'closing' does not block advancement — only 'open' does", async () => {
    // closing = the cycle is being wound down this turn; the gate's other
    // conditions (intensity ≤ 5, safety clean) already hold. Treating
    // 'closing' as a block would punish the AI for reporting honestly.
    turnsToReturn = passingStage5Turns({ cycleStatus: 'closing' });
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('advance');
  });

  it('does NOT block regression — stepping back with an open cycle is legitimate', async () => {
    turnsToReturn = [
      makeTurn(1, { recommendedAction: 'regress_to_grounding', cycleStatus: 'open' }),
    ];
    const decision = await decideRoute(makeState({ currentStage: 5 }));
    expect(decision.kind).toBe('regress');
  });

  it('blocks discharge at Stage 8 when the last turn reports an open cycle', async () => {
    turnsToReturn = [
      makeTurn(1, { recommendedAction: 'discharge', cycleStatus: 'open' }),
    ];
    const decision = await decideRoute(makeState({ currentStage: 8 }));
    expect(decision.kind).toBe('stay');
    expect((decision as { kind: 'stay'; reasons: string[] }).reasons).toContain(
      'open_cycle_blocks_discharge',
    );
  });
});
