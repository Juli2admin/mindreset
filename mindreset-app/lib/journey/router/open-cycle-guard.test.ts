// Journey remediation 2026-07-19 — fixture I (closure safety) at the router
// level: an open therapeutic cycle on the most recent turn blocks stage
// advancement on BOTH lanes and blocks discharge, but never blocks stay or
// regression. Unresolved activation must be completed, contained, or given
// an explicit safe stopping point before the router moves the user forward.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditTurn } from './history';
import type { JourneyState } from '../state/types';
import type { StateReport } from '../stateReport/schema';

vi.mock('@/lib/prisma', () => ({
  default: {
    journeyTurn: {
      findFirst: vi.fn().mockResolvedValue({ createdAt: new Date('2026-05-01') }),
    },
  },
}));

const loadRecentTurnsMock = vi.fn();
vi.mock('./history', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./history')>();
  return {
    ...actual,
    loadRecentTurns: (...args: unknown[]) => loadRecentTurnsMock(...args),
  };
});

import { decideRoute } from './router';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_open_cycle',
    currentStage: 1,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-20'),
    lastActivityAt: new Date('2026-06-26'),
    dischargedAt: null,
    anchorText: null,
    anchorSetAt: null,
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'cognitive',
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
    hoursSinceLastTurn: 1,
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

function makeTurn(daysAgo: number, report: Partial<StateReport> = {}): AuditTurn {
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
    stageAtTurn: 1,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

// Turns that pass the Stage 1 classic gate (post Anchor rule).
function gatePassingTurns(lastTurnExtra: Partial<StateReport> = {}): AuditTurn[] {
  return [
    makeTurn(3, { readinessTouched: ['emotion_named'] }),
    makeTurn(2, { readinessTouched: ['body_located'] }),
    makeTurn(1, {
      readinessTouched: ['orientation_present'],
      recommendedAction: 'advance',
      ...lastTurnExtra,
    }),
  ];
}

beforeEach(() => {
  loadRecentTurnsMock.mockReset();
});

describe('open-cycle progression guard (fixture I)', () => {
  it('advances normally when the gate passes and no cycle is open', async () => {
    loadRecentTurnsMock.mockResolvedValue(gatePassingTurns());
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('advance');
  });

  it('blocks advancement when the last turn reports an open cycle', async () => {
    loadRecentTurnsMock.mockResolvedValue(
      gatePassingTurns({ cycleStatus: 'open' }),
    );
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('stay');
    expect((decision as { reasons: string[] }).reasons).toContain(
      'open_cycle_blocks_advance',
    );
  });

  it('a closed cycle on the last turn does not block advancement', async () => {
    loadRecentTurnsMock.mockResolvedValue(
      gatePassingTurns({ cycleStatus: 'closed' }),
    );
    const decision = await decideRoute(makeState());
    expect(decision.kind).toBe('advance');
  });

  it('regression is honoured even with an open cycle (stepping back is legitimate)', async () => {
    loadRecentTurnsMock.mockResolvedValue(
      gatePassingTurns({
        cycleStatus: 'open',
        recommendedAction: 'regress_to_grounding',
      }),
    );
    const decision = await decideRoute(makeState({ currentStage: 4 }));
    expect(decision.kind).toBe('regress');
  });

  it('blocks discharge at Stage 8 when a cycle is open', async () => {
    loadRecentTurnsMock.mockResolvedValue(
      gatePassingTurns({
        cycleStatus: 'open',
        recommendedAction: 'discharge',
      }),
    );
    const decision = await decideRoute(makeState({ currentStage: 8 }));
    expect(decision.kind).toBe('stay');
    expect((decision as { reasons: string[] }).reasons).toContain(
      'open_cycle_blocks_discharge',
    );
  });
});
