// Tests for freeze interruption of an Activated Closure sequence —
// Phase 1, owner-approved Option B (2026-08-05).
//
// Approved semantics under test:
//
//   When a freeze BEGINS on an active sequence — record the interruption via
//   `closureFreezeInterruptedAt` and change nothing else. The process state
//   and the round count stay exactly as they were, and the sequence does NOT
//   become INCOMPLETE while the freeze holds. Freeze has absolute precedence
//   and must not quietly bookkeep a frozen user's process.
//
//   While frozen — closure orchestration never runs (the hook sits behind the
//   freeze branch in the turn route), so nothing advances and the four-hour
//   timeout cannot fire.
//
//   On the FIRST UNFROZEN turn — the prior sequence is not resumed. It is
//   converted to INCOMPLETE, the round count is reset, and the marker is
//   cleared. Phase 1 stops there; it does not enter AWAITING_INITIAL_SCORE.
//
// The marker is what makes this survive a freeze cleared by HAND IN SQL — the
// documented method — because `clearFreezeForReview` nulls `frozenAt` and
// `frozenReason`, leaving nothing else on the row to detect the freeze from,
// and inferring it from JourneyTurn history is forbidden.

import { describe, expect, it, vi, beforeEach } from 'vitest';

type RpUpdateArgs = { where: unknown; data: Record<string, unknown> };

const rpUpdates: RpUpdateArgs[] = [];
const rpFindUnique = vi.fn();
const rpUpdateImpl = vi.fn((args: RpUpdateArgs) => {
  rpUpdates.push(args);
  return Promise.resolve({});
});

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      findUnique: (...a: unknown[]) => rpFindUnique(...a),
      update: (args: RpUpdateArgs) => rpUpdateImpl(args),
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
    },
  },
}));

import { freezeJourney } from '../safety/freeze';
import { runClosureOrchestration } from './orchestrator';
import {
  CLOSURE_PROCESS_NONE,
  CLOSURE_PROCESS_STATES,
  INTERRUPTED_PROCESS_MS,
  MAX_STABILISATION_ROUNDS,
  isActiveProcessState,
  markFreezeInterruption,
  normaliseClosureProcess,
  resolveClosureProcessForTurn,
  type ClosureProcess,
  type ClosureProcessState,
} from './process';

const USER_ID = 'user_test_freeze_interruption';
const NOW = new Date('2026-08-05T12:00:00.000Z');
const at = (msAgo: number) => new Date(NOW.getTime() - msAgo);

/** Phase 2 shim — see orchestrator.test.ts. Freeze precedence is unchanged. */
const runOrch = (current: Parameters<typeof runClosureOrchestration>[1]['current']) =>
  runClosureOrchestration(USER_ID, {
    current,
    userMessage: '',
    locale: null,
    loadSessionTurns: async () => [],
    now: NOW,
  });

const ACTIVE_STATES = CLOSURE_PROCESS_STATES.filter(isActiveProcessState);
const INACTIVE_STATES: ClosureProcessState[] = ['NONE', 'CLOSED', 'INCOMPLETE'];

function makeProcess(overrides: Partial<ClosureProcess> = {}): ClosureProcess {
  return { ...CLOSURE_PROCESS_NONE, ...overrides };
}

/** An in-flight sequence, one stabilisation round already delivered. */
function inFlight(
  state: ClosureProcessState,
  overrides: Partial<ClosureProcess> = {},
): ClosureProcess {
  return makeProcess({
    state,
    route: 'ACTIVATED_CLOSE',
    enteredAt: at(900_000),
    transitionedAt: at(600_000),
    roundCount: 1,
    ...overrides,
  });
}

beforeEach(() => {
  rpUpdates.length = 0;
  rpFindUnique.mockReset();
  rpUpdateImpl.mockClear();
  rpUpdateImpl.mockImplementation((args) => {
    rpUpdates.push(args);
    return Promise.resolve({});
  });
});

// ---------------------------------------------------------------------------
// 1 + 2 + 8. Freeze begins
// ---------------------------------------------------------------------------
describe('freeze begins — marking the interruption', () => {
  it.each(ACTIVE_STATES)('sets the marker when a freeze lands during %s', async (state) => {
    rpFindUnique.mockResolvedValue({
      frozenForReview: false,
      closureProcessState: state,
      closureFreezeInterruptedAt: null,
    });
    await freezeJourney({ userId: USER_ID, source: 'keyword_scan' });

    expect(rpUpdates).toHaveLength(1);
    expect(rpUpdates[0].data.closureFreezeInterruptedAt).toBeInstanceOf(Date);
    expect(rpUpdates[0].data.frozenForReview).toBe(true);
  });

  it.each(INACTIVE_STATES)('does NOT set the marker during %s', async (state) => {
    rpFindUnique.mockResolvedValue({
      frozenForReview: false,
      closureProcessState: state,
      closureFreezeInterruptedAt: null,
    });
    await freezeJourney({ userId: USER_ID, source: 'verifier' });

    expect(rpUpdates).toHaveLength(1);
    expect(rpUpdates[0].data).not.toHaveProperty('closureFreezeInterruptedAt');
  });

  it('leaves the closure state and round count untouched when marking', async () => {
    rpFindUnique.mockResolvedValue({
      frozenForReview: false,
      closureProcessState: 'AWAITING_POST_SCORE',
      closureFreezeInterruptedAt: null,
    });
    await freezeJourney({ userId: USER_ID, source: 'state_report' });

    // The sequence is preserved exactly as it stood — only the marker is added.
    for (const forbidden of [
      'closureProcessState',
      'closureRoute',
      'closureRoundCount',
      'closureEnteredAt',
      'closureTransitionedAt',
      'closureIncompleteAt',
      'closureCompletedAt',
    ]) {
      expect(rpUpdates[0].data).not.toHaveProperty(forbidden);
    }
  });

  it('a freeze with no active sequence leaves closure state entirely unchanged', async () => {
    rpFindUnique.mockResolvedValue({
      frozenForReview: false,
      closureProcessState: 'NONE',
      closureFreezeInterruptedAt: null,
    });
    await freezeJourney({ userId: USER_ID, source: 'keyword_scan' });

    expect(Object.keys(rpUpdates[0].data).filter((k) => k.startsWith('closure')))
      .toEqual([]);
  });

  it('does not restamp an existing marker — freezeJourney is idempotent', () => {
    const first = at(60_000);
    const p = inFlight('DELIVERING_STABILISATION', { freezeInterruptedAt: first });
    const r = markFreezeInterruption(p, NOW);
    expect(r.marked).toBe(false);
    expect(r.process.freezeInterruptedAt).toEqual(first);
  });

  it('an already-frozen user is not re-marked', async () => {
    rpFindUnique.mockResolvedValue({
      frozenForReview: true,
      closureProcessState: 'AWAITING_POST_SCORE',
      closureFreezeInterruptedAt: at(60_000),
    });
    await freezeJourney({ userId: USER_ID, source: 'verifier' });
    expect(rpUpdates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. While frozen
// ---------------------------------------------------------------------------
describe('while frozen — the process is preserved', () => {
  it.each(ACTIVE_STATES)('%s is unchanged by marking', (state) => {
    const before = inFlight(state);
    const { process } = markFreezeInterruption(before, NOW);
    expect(process.state).toBe(before.state);
    expect(process.roundCount).toBe(before.roundCount);
    expect(process.route).toBe(before.route);
    expect(process.enteredAt).toEqual(before.enteredAt);
    expect(process.transitionedAt).toEqual(before.transitionedAt);
    expect(process.incompleteAt).toBeNull();
  });

  it('the four-hour timeout does not pre-empt the freeze rule', () => {
    // Long past the boundary AND marked. The freeze rule wins, which matters
    // because it is the one that resets the round count.
    const p = inFlight('AWAITING_POST_SCORE', {
      transitionedAt: at(INTERRUPTED_PROCESS_MS * 3),
      freezeInterruptedAt: at(INTERRUPTED_PROCESS_MS * 2),
      roundCount: MAX_STABILISATION_ROUNDS,
    });
    const r = resolveClosureProcessForTurn(p, NOW);
    expect(r.reason).toBe('freeze_interrupted');
    expect(r.process.roundCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4 + 5 + 6. First unfrozen turn
// ---------------------------------------------------------------------------
describe('first unfrozen turn — ending the interrupted attempt', () => {
  it.each(ACTIVE_STATES)('converts %s to INCOMPLETE', (state) => {
    const r = resolveClosureProcessForTurn(
      inFlight(state, { freezeInterruptedAt: at(300_000) }),
      NOW,
    );
    expect(r.changed).toBe(true);
    expect(r.reason).toBe('freeze_interrupted');
    expect(r.process.state).toBe('INCOMPLETE');
    expect(r.process.incompleteAt).toEqual(NOW);
  });

  it('resets the stabilisation round count', () => {
    const r = resolveClosureProcessForTurn(
      inFlight('AWAITING_POST_SCORE', {
        roundCount: MAX_STABILISATION_ROUNDS,
        freezeInterruptedAt: at(300_000),
      }),
      NOW,
    );
    expect(r.process.roundCount).toBe(0);
  });

  it('clears the marker', () => {
    const r = resolveClosureProcessForTurn(
      inFlight('DELIVERING_STABILISATION', { freezeInterruptedAt: at(300_000) }),
      NOW,
    );
    expect(r.process.freezeInterruptedAt).toBeNull();
  });

  it('does NOT enter AWAITING_INITIAL_SCORE automatically in Phase 1', () => {
    const r = resolveClosureProcessForTurn(
      inFlight('AWAITING_INITIAL_SCORE', { freezeInterruptedAt: at(300_000) }),
      NOW,
    );
    expect(r.process.state).toBe('INCOMPLETE');
  });

  it('keeps the attempt on record — route and entry time survive', () => {
    const enteredAt = at(900_000);
    const r = resolveClosureProcessForTurn(
      inFlight('AWAITING_POST_SCORE', {
        enteredAt,
        freezeInterruptedAt: at(300_000),
      }),
      NOW,
    );
    expect(r.process.route).toBe('ACTIVATED_CLOSE');
    expect(r.process.enteredAt).toEqual(enteredAt);
  });

  it('is idempotent — a second turn finds nothing left to do', () => {
    const first = resolveClosureProcessForTurn(
      inFlight('AWAITING_POST_SCORE', { freezeInterruptedAt: at(300_000) }),
      NOW,
    );
    const second = resolveClosureProcessForTurn(first.process, NOW);
    expect(second.changed).toBe(false);
    expect(second.process.state).toBe('INCOMPLETE');
  });

  it('persists the conversion through the orchestrator', async () => {
    const decision = await runOrch(inFlight('AWAITING_CLOSE_CONFIRMATION', {
        roundCount: 2,
        freezeInterruptedAt: at(300_000),
      }));
    expect(decision.kind).toBe('proceed');
    expect(decision.resolved).toBe('freeze_interrupted');
    expect(rpUpdates).toHaveLength(1);
    expect(rpUpdates[0].data).toMatchObject({
      closureProcessState: 'INCOMPLETE',
      closureRoundCount: 0,
      closureIncompleteAt: NOW,
      closureFreezeInterruptedAt: null,
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Manual SQL clear of frozenForReview
// ---------------------------------------------------------------------------
describe('a manual clear of frozenForReview still triggers interruption handling', () => {
  it('works from the marker alone, with no freeze evidence left on the row', () => {
    // clearFreezeForReview nulls frozenAt and frozenReason, and a manual SQL
    // clear bypasses that helper entirely — so nothing about the freeze
    // survives except this marker. It is sufficient on its own.
    const afterManualClear = inFlight('DELIVERING_STABILISATION', {
      freezeInterruptedAt: at(45_000),
    });
    const r = resolveClosureProcessForTurn(afterManualClear, NOW);
    expect(r.reason).toBe('freeze_interrupted');
    expect(r.process.state).toBe('INCOMPLETE');
  });

  it('fires well inside the four-hour boundary — the common cooldown-lift case', () => {
    // JOURNEY_COOLDOWN_MIN_WAIT_MS is 20 seconds, so most lifts happen far
    // sooner than four hours. Without the marker the sequence would simply
    // resume mid-flight.
    const p = inFlight('AWAITING_POST_SCORE', {
      transitionedAt: at(30_000),
      freezeInterruptedAt: at(25_000),
    });
    expect(resolveClosureProcessForTurn(p, NOW).process.state).toBe('INCOMPLETE');

    // Control: the identical record without a marker is left running.
    const unmarked = { ...p, freezeInterruptedAt: null };
    expect(resolveClosureProcessForTurn(unmarked, NOW).changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Storage-boundary invariant
// ---------------------------------------------------------------------------
describe('normaliseClosureProcess — freeze marker invariant', () => {
  it.each(ACTIVE_STATES)('keeps the marker on active state %s', (state) => {
    const stamp = at(1000);
    expect(
      normaliseClosureProcess({ state, freezeInterruptedAt: stamp })
        .freezeInterruptedAt,
    ).toEqual(stamp);
  });

  it.each(INACTIVE_STATES)('drops a stale marker on %s', (state) => {
    expect(
      normaliseClosureProcess({ state, freezeInterruptedAt: at(1000) })
        .freezeInterruptedAt,
    ).toBeNull();
  });

  it('a fresh entry never inherits a marker', () => {
    expect(CLOSURE_PROCESS_NONE.freezeInterruptedAt).toBeNull();
  });
});
