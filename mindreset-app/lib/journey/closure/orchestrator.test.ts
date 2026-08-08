// Tests for the Activated Closure pre-LLM orchestration hook — Phase 1.
//
// The hook is structural. What it must do in Phase 1:
//   * read the persisted, server-owned process state;
//   * apply the two automatic non-clinical transitions;
//   * persist only when something actually changed;
//   * return a typed decision that always proceeds with the ordinary turn.
//
// What it must NOT do: enter Activated Closure, emit a response, or let a
// database failure cost the user a turn.

import { describe, expect, it, vi, beforeEach } from 'vitest';

type RpUpdateArgs = { where: unknown; data: Record<string, unknown> };

const rpUpdates: RpUpdateArgs[] = [];
const rpUpdateImpl = vi.fn((args: RpUpdateArgs) => {
  rpUpdates.push(args);
  return Promise.resolve({});
});

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: { update: (args: RpUpdateArgs) => rpUpdateImpl(args) },
  },
}));

import {
  decideClosureOrchestration,
  runClosureOrchestration,
} from './orchestrator';
import {
  CLOSURE_PROCESS_NONE,
  INTERRUPTED_PROCESS_MS,
  type ClosureProcess,
} from './process';

const USER_ID = 'user_test_closure_orchestrator';
const NOW = new Date('2026-08-05T12:00:00.000Z');
const at = (msAgo: number) => new Date(NOW.getTime() - msAgo);

/**
 * Phase 2 shim. The hook now takes an input object; these Phase 1 cases only
 * exercise the automatic transitions, so they pass an empty message and no
 * session history — no exit intent, no measurement, no behaviour change.
 */
const runOrch = (
  current: Parameters<typeof runClosureOrchestration>[1]['current'],
  overrides: Partial<Parameters<typeof runClosureOrchestration>[1]> = {},
) =>
  runClosureOrchestration(USER_ID, {
    current,
    userMessage: '',
    locale: null,
    loadSessionTurns: async () => [],
    now: NOW,
    ...overrides,
  });

function makeProcess(overrides: Partial<ClosureProcess> = {}): ClosureProcess {
  return { ...CLOSURE_PROCESS_NONE, ...overrides };
}

beforeEach(() => {
  rpUpdates.length = 0;
  rpUpdateImpl.mockClear();
  rpUpdateImpl.mockImplementation((args) => {
    rpUpdates.push(args);
    return Promise.resolve({});
  });
});

describe('decideClosureOrchestration (pure)', () => {
  it('always proceeds — Phase 1 never short-circuits the turn', () => {
    const states: ClosureProcess[] = [
      makeProcess(),
      makeProcess({ state: 'CLOSED', completedAt: at(1000) }),
      makeProcess({ state: 'INCOMPLETE', incompleteAt: at(1000) }),
      makeProcess({ state: 'AWAITING_POST_SCORE', transitionedAt: at(1000) }),
    ];
    for (const p of states) {
      expect(decideClosureOrchestration(p, NOW).decision.kind).toBe('proceed');
    }
  });

  it('reports no resolution for an idle process', () => {
    const { decision } = decideClosureOrchestration(makeProcess(), NOW);
    expect(decision.resolved).toBeNull();
    expect(decision.process).toEqual(CLOSURE_PROCESS_NONE);
  });

  it('surfaces the interrupted-process resolution', () => {
    const { decision } = decideClosureOrchestration(
      makeProcess({
        state: 'AWAITING_POST_SCORE',
        route: 'ACTIVATED_CLOSE',
        transitionedAt: at(INTERRUPTED_PROCESS_MS + 1),
      }),
      NOW,
    );
    expect(decision.resolved).toBe('interrupted_process_expired');
    expect(decision.process.state).toBe('INCOMPLETE');
  });

  it('surfaces the CLOSED re-arm resolution', () => {
    const { decision } = decideClosureOrchestration(
      makeProcess({ state: 'CLOSED', completedAt: at(1000) }),
      NOW,
    );
    expect(decision.resolved).toBe('closed_reset_on_new_turn');
    expect(decision.process.state).toBe('NONE');
  });
});

describe('runClosureOrchestration (persisting)', () => {
  it('writes nothing for an idle process — the production no-op path', async () => {
    const decision = await runOrch(makeProcess());
    expect(rpUpdates).toHaveLength(0);
    expect(decision.kind).toBe('proceed');
    expect(decision.process.state).toBe('NONE');
  });

  it('writes nothing for a sequence still inside the four-hour boundary', async () => {
    await runOrch(makeProcess({
        state: 'DELIVERING_STABILISATION',
        route: 'ACTIVATED_CLOSE',
        transitionedAt: at(INTERRUPTED_PROCESS_MS - 1),
      }));
    expect(rpUpdates).toHaveLength(0);
  });

  it('persists the whole record on an interrupted-process conversion', async () => {
    const enteredAt = at(INTERRUPTED_PROCESS_MS + 600_000);
    await runOrch(makeProcess({
        state: 'AWAITING_POST_SCORE',
        route: 'ACTIVATED_CLOSE',
        enteredAt,
        transitionedAt: at(INTERRUPTED_PROCESS_MS + 1),
        roundCount: 1,
      }));
    expect(rpUpdates).toHaveLength(1);
    expect(rpUpdates[0].where).toEqual({ userId: USER_ID });
    expect(rpUpdates[0].data).toEqual({
      closureProcessState: 'INCOMPLETE',
      closureRoute: 'ACTIVATED_CLOSE',
      closureEnteredAt: enteredAt,
      closureTransitionedAt: NOW,
      closureRoundCount: 1,
      closureCompletedAt: null,
      closureIncompleteAt: NOW,
      closureFreezeInterruptedAt: null,
      closureInitialScore: null,
      closureInitialScoreAt: null,
      closurePostScore: null,
      closurePostScoreAt: null,
    });
  });

  it('persists the CLOSED re-arm', async () => {
    const completedAt = at(60_000);
    await runOrch(makeProcess({
        state: 'CLOSED',
        route: 'ACTIVATED_CLOSE',
        enteredAt: at(600_000),
        completedAt,
        roundCount: 2,
      }));
    expect(rpUpdates).toHaveLength(1);
    expect(rpUpdates[0].data).toMatchObject({
      closureProcessState: 'NONE',
      closureRoute: null,
      closureEnteredAt: null,
      closureRoundCount: 0,
      closureCompletedAt: completedAt,
    });
  });

  it('writes EVERY ClosureProcess field — payload and record must not diverge', async () => {
    await runOrch(makeProcess({ state: 'CLOSED', completedAt: at(1000) }));
    expect(Object.keys(rpUpdates[0].data).sort()).toEqual([
      'closureCompletedAt',
      'closureEnteredAt',
      'closureFreezeInterruptedAt',
      'closureIncompleteAt',
      'closureInitialScore',
      'closureInitialScoreAt',
      'closurePostScore',
      'closurePostScoreAt',
      'closureProcessState',
      'closureRoundCount',
      'closureRoute',
      'closureTransitionedAt',
    ]);
  });

  it('never touches currentStage, currentDepth or any clinical column', async () => {
    await runOrch(makeProcess({ state: 'CLOSED', completedAt: at(1000) }));
    for (const forbidden of [
      'currentStage',
      'currentDepth',
      'frozenForReview',
      'lastIntensity',
      'continuityNoteEncrypted',
      'taskContractEncrypted',
    ]) {
      expect(rpUpdates[0].data).not.toHaveProperty(forbidden);
    }
  });

  it('fails safe on a write error — reports the state the database still holds', async () => {
    rpUpdateImpl.mockImplementation(() => Promise.reject(new Error('db down')));
    const stored = makeProcess({
      state: 'AWAITING_POST_SCORE',
      route: 'ACTIVATED_CLOSE',
      transitionedAt: at(INTERRUPTED_PROCESS_MS + 1),
    });
    const decision = await runOrch(stored);
    // Memory must not claim a transition the store refused.
    expect(decision.kind).toBe('proceed');
    expect(decision.process).toEqual(stored);
    expect(decision.resolved).toBeNull();
  });

  it('does not throw when the database is unavailable', async () => {
    rpUpdateImpl.mockImplementation(() => Promise.reject(new Error('db down')));
    await expect(
      runOrch(makeProcess({ state: 'CLOSED', completedAt: at(1000) })),
    ).resolves.toMatchObject({ kind: 'proceed' });
  });
});
