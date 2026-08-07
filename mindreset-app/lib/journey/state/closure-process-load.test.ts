// Tests for loading the server-owned Activated Closure process state —
// Phase 1 (2026-08-05).
//
// The requirement under test: loadJourneyState reads the process state
// DIRECTLY from RecodeProgress. It must never be inferred from cycleStatus,
// cycleCanClose, hasOpenCycle, encrypted state reports or any other
// model-generated history — and the pre-existing derived signals must keep
// behaving exactly as they did.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpFindUnique = vi.fn();
const journeyTurnFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: { findUnique: (...a: unknown[]) => rpFindUnique(...a) },
    journeyPart: { findMany: vi.fn(() => Promise.resolve([])) },
    journeyForeignFile: { findMany: vi.fn(() => Promise.resolve([])) },
    journeySignatureImage: { findMany: vi.fn(() => Promise.resolve([])) },
    journeyPattern: { findMany: vi.fn(() => Promise.resolve([])) },
    journeyTurn: { findMany: (...a: unknown[]) => journeyTurnFindMany(...a) },
  },
}));

vi.mock('@/lib/encrypt', () => ({
  encrypt: (s: string) => `enc(${s})`,
  decrypt: (s: string) => s.replace(/^enc\((.*)\)$/, '$1'),
}));

vi.mock('@/lib/platform/profile', () => ({
  getOnboardingAnswers: vi.fn(() => Promise.resolve(null)),
}));

import { loadJourneyState } from './load';
import { CLOSURE_PROCESS_NONE } from '../closure/process';

const USER_ID = 'user_test_closure_load';
const ENTERED = new Date('2026-08-05T10:00:00.000Z');
const TRANSITIONED = new Date('2026-08-05T10:12:00.000Z');

// Turn timestamps MUST be relative to the real clock. deriveSensitivitySignals
// measures them against Date.now() and SESSION_BOUNDARY_MS (4h): an absolute
// date here passes on the day it is written and silently becomes a session
// resume the next day, which empties the derived signals and fails the test.
// ENTERED/TRANSITIONED above are only ever read back as stored column values,
// never compared to a clock, so they are safe as fixed dates.
const RECENT_TURN_AT = () => new Date(Date.now() - 5 * 60 * 1000);

function progressRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    currentStage: 3,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-01'),
    lastActivityAt: new Date('2026-08-05'),
    dischargedAt: null,
    anchorTextEncrypted: null,
    anchorSetAt: null,
    identityAnchorEncrypted: null,
    identityAnchorSetAt: null,
    processingChannel: null,
    adultSelfQualitiesEncrypted: null,
    lastIntensity: null,
    lastIntensityAt: null,
    lastDeepLayerContactAt: null,
    mii: {},
    stage8WeeksElapsed: 0,
    frozenForReview: false,
    frozenAt: null,
    frozenReason: null,
    continuityNoteEncrypted: null,
    taskContractEncrypted: null,
    // Activated Closure Phase 1 columns — defaults for an existing user.
    closureProcessState: 'NONE',
    closureRoute: null,
    closureEnteredAt: null,
    closureTransitionedAt: null,
    closureRoundCount: 0,
    closureCompletedAt: null,
    closureIncompleteAt: null,
    closureFreezeInterruptedAt: null,
    closureInitialScore: null,
    closureInitialScoreAt: null,
    closurePostScore: null,
    closurePostScoreAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  rpFindUnique.mockReset();
  journeyTurnFindMany.mockReset();
  journeyTurnFindMany.mockResolvedValue([]);
});

describe('loadJourneyState — closure process state', () => {
  it('defaults to NONE for an existing user with untouched columns', async () => {
    rpFindUnique.mockResolvedValue(progressRow());
    const state = await loadJourneyState(USER_ID);
    expect(state?.closureProcess).toEqual(CLOSURE_PROCESS_NONE);
  });

  it('loads a persisted in-flight process verbatim off the row', async () => {
    rpFindUnique.mockResolvedValue(
      progressRow({
        closureProcessState: 'AWAITING_POST_SCORE',
        closureRoute: 'ACTIVATED_CLOSE',
        closureEnteredAt: ENTERED,
        closureTransitionedAt: TRANSITIONED,
        closureRoundCount: 1,
      }),
    );
    const state = await loadJourneyState(USER_ID);
    expect(state?.closureProcess).toEqual({
      state: 'AWAITING_POST_SCORE',
      route: 'ACTIVATED_CLOSE',
      enteredAt: ENTERED,
      transitionedAt: TRANSITIONED,
      roundCount: 1,
      completedAt: null,
      incompleteAt: null,
      initialScore: null,
      initialScoreAt: null,
      postScore: null,
      postScoreAt: null,
      freezeInterruptedAt: null,
    });
  });

  it('loads the terminal states and their historical markers', async () => {
    rpFindUnique.mockResolvedValue(
      progressRow({
        closureProcessState: 'INCOMPLETE',
        closureRoute: 'ACTIVATED_CLOSE',
        closureEnteredAt: ENTERED,
        closureTransitionedAt: TRANSITIONED,
        closureRoundCount: 2,
        closureIncompleteAt: TRANSITIONED,
      }),
    );
    const state = await loadJourneyState(USER_ID);
    expect(state?.closureProcess.state).toBe('INCOMPLETE');
    expect(state?.closureProcess.incompleteAt).toEqual(TRANSITIONED);
    expect(state?.closureProcess.roundCount).toBe(2);
  });

  it('degrades a corrupt persisted state to NONE instead of trapping the user', async () => {
    rpFindUnique.mockResolvedValue(
      progressRow({ closureProcessState: 'WHATEVER', closureRoundCount: 42 }),
    );
    const state = await loadJourneyState(USER_ID);
    expect(state?.closureProcess.state).toBe('NONE');
  });

  it('is NOT inferred from model-reported cycle status', async () => {
    // Every state report in history claims an OPEN cycle, and the derived
    // signal agrees — but the process state stays NONE, because the process
    // is server-owned and nothing has entered it.
    rpFindUnique.mockResolvedValue(progressRow());
    journeyTurnFindMany.mockImplementation((args: { select?: Record<string, unknown> }) => {
      if (args?.select && 'stateReportEncrypted' in args.select) {
        return Promise.resolve([
          {
            createdAt: RECENT_TURN_AT(),
            stateReportEncrypted: `enc(${JSON.stringify({
              intensity: 7,
              safetyFlag: 'none',
              recommendedAction: 'stay',
              cycleStatus: 'open',
              cycleCanClose: true,
              clinicalRead: 'mid-process',
            })})`,
          },
        ]);
      }
      return Promise.resolve([{ createdAt: RECENT_TURN_AT(), stageAtTurn: 3 }]);
    });

    const state = await loadJourneyState(USER_ID);
    // Derived, model-reported signal — unchanged behaviour.
    expect(state?.hasOpenCycle).toBe(true);
    // Server-owned process state — untouched by any of that.
    expect(state?.closureProcess).toEqual(CLOSURE_PROCESS_NONE);
  });

  it('an in-flight process does not alter the derived cycle signals', async () => {
    rpFindUnique.mockResolvedValue(
      progressRow({
        closureProcessState: 'DELIVERING_STABILISATION',
        closureRoute: 'ACTIVATED_CLOSE',
        closureEnteredAt: ENTERED,
        closureTransitionedAt: TRANSITIONED,
        closureRoundCount: 1,
      }),
    );
    const state = await loadJourneyState(USER_ID);
    expect(state?.closureProcess.state).toBe('DELIVERING_STABILISATION');
    // No turns in history → the derived signals stay exactly as before.
    expect(state?.hasOpenCycle).toBe(false);
    expect(state?.openCycleDescription).toBeNull();
  });

  it('returns null for a user who has not started the Journey', async () => {
    rpFindUnique.mockResolvedValue(null);
    expect(await loadJourneyState(USER_ID)).toBeNull();
  });
});
