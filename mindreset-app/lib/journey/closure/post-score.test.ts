// AWAITING_POST_SCORE and the refusal path — Phase 2 (2026-08-08).
//
// Everything after the first measurement. AWAITING_INITIAL_SCORE is covered in
// measurement-first.test.ts; this file covers the states that only become
// reachable once a stabilisation round has run, plus the one exit the owner
// specified for a user who will not give a number (Q5, 2026-08-08):
//
//   one re-ask, then release as INCOMPLETE. Never a third ask, never a
//   fabricated score, never a claimed successful close.
//
// The rounds ceiling is the other required exit: below threshold with rounds
// exhausted is INCOMPLETE, not another practice and not a silent close.

import { describe, expect, it, vi, beforeEach } from 'vitest';

type RpUpdateArgs = { where: unknown; data: Record<string, unknown> };
const rpUpdates: RpUpdateArgs[] = [];
vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      update: (args: RpUpdateArgs) => {
        rpUpdates.push(args);
        return Promise.resolve({});
      },
    },
  },
}));

import { runClosureOrchestration } from './orchestrator';
import { CLOSURE_PROCESS_NONE, MAX_STABILISATION_ROUNDS, type ClosureProcess } from './process';
import { STABILITY_QUESTION_EN } from './stability-question';

const USER_ID = 'user_test_post_score';

const NOW = new Date(Date.now());
const MIN = 60 * 1000;
const minsAgo = (m: number) => new Date(NOW.getTime() - m * MIN);

function proc(overrides: Partial<ClosureProcess> = {}): ClosureProcess {
  return { ...CLOSURE_PROCESS_NONE, ...overrides };
}

const run = (current: ClosureProcess, userMessage: string, spoken = 1) =>
  runClosureOrchestration(USER_ID, {
    current,
    userMessage,
    locale: null,
    loadSessionTurns: async () => [],
    countUserMessagesSince: async () => spoken,
    now: NOW,
  });

/** A process that has had one stabilisation round and is awaiting the re-check. */
function awaitingPost(roundCount = 1): ClosureProcess {
  return proc({
    state: 'AWAITING_POST_SCORE',
    route: 'ACTIVATED_CLOSE',
    enteredAt: minsAgo(6),
    transitionedAt: minsAgo(1),
    roundCount,
    initialScore: 4,
    initialScoreAt: minsAgo(5),
  });
}

beforeEach(() => {
  rpUpdates.length = 0;
});

describe('DELIVERING_STABILISATION has a real executor and a real exit', () => {
  it('constrains the turn rather than proceeding unmarked', async () => {
    const d = await run(
      proc({
        state: 'DELIVERING_STABILISATION',
        route: 'ACTIVATED_CLOSE',
        enteredAt: minsAgo(3),
        transitionedAt: minsAgo(1),
        roundCount: 1,
        initialScore: 4,
        initialScoreAt: minsAgo(2),
      }),
      'хорошо',
    );
    expect(d.kind).toBe('constrain');
    if (d.kind !== 'constrain') return;
    expect(d.note).toBe('stabilisation');
    // It does NOT advance here — the exit is gated on structured evidence in
    // finaliseTurn (stabilisation-evidence.ts), not on reaching this branch.
    expect(d.process.state).toBe('DELIVERING_STABILISATION');
    expect(rpUpdates).toHaveLength(0);
  });
});

describe('AWAITING_POST_SCORE — the executor asks, then the score decides', () => {
  it('asks the stability question when the user has not yet spoken', async () => {
    const d = await run(awaitingPost(), '', 0);
    expect(d.kind).toBe('deliver');
    if (d.kind !== 'deliver') return;
    expect(d.text).toBe(STABILITY_QUESTION_EN);
    expect(d.step).toBe('stability_question');
    expect(d.process.state).toBe('AWAITING_POST_SCORE');
  });

  it('at or above threshold closes, and the route stays ACTIVATED_CLOSE', async () => {
    const d = await run(awaitingPost(), 'сейчас 7');
    expect(d.kind).toBe('constrain');
    if (d.kind !== 'constrain') return;
    expect(d.note).toBe('closing');
    expect(d.process.state).toBe('CLOSED');
    // Stabilisation was involved, so this was never a normal close.
    expect(d.process.route).toBe('ACTIVATED_CLOSE');
    expect(d.process.postScore).toBe(7);
  });

  it('below threshold with a round remaining runs another one', async () => {
    const d = await run(awaitingPost(1), '4');
    expect(d.kind).toBe('constrain');
    if (d.kind !== 'constrain') return;
    expect(d.note).toBe('stabilisation');
    expect(d.process.state).toBe('DELIVERING_STABILISATION');
    expect(d.process.roundCount).toBe(2);
    expect(d.process.postScore).toBe(4);
  });

  it('below threshold with rounds exhausted ends as INCOMPLETE', async () => {
    const d = await run(awaitingPost(MAX_STABILISATION_ROUNDS), '3');
    expect(d.kind).toBe('constrain');
    if (d.kind !== 'constrain') return;
    expect(d.note).toBe('incomplete');
    expect(d.process.state).toBe('INCOMPLETE');
    expect(d.process.incompleteAt).not.toBeNull();
    // The attempt stays on record; nothing claims a successful close.
    expect(d.process.completedAt).toBeNull();
  });
});

describe('Q5 — the user will not give a number', () => {
  it('re-asks exactly once', async () => {
    const d = await run(awaitingPost(), 'не знаю', 1);
    expect(d.kind).toBe('deliver');
    if (d.kind !== 'deliver') return;
    expect(d.step).toBe('stability_question_reask');
    expect(d.process.state).toBe('AWAITING_POST_SCORE');
    expect(rpUpdates).toHaveLength(0);
  });

  it('releases as INCOMPLETE on the second non-answer instead of asking again', async () => {
    const d = await run(awaitingPost(), 'просто хватит', 2);
    expect(d.kind).toBe('constrain');
    if (d.kind !== 'constrain') return;
    expect(d.note).toBe('incomplete');
    expect(d.process.state).toBe('INCOMPLETE');
    expect(d.process.postScore).toBeNull();
    expect(d.process.completedAt).toBeNull();
  });

  it('releases from the INITIAL score state on the same rule', async () => {
    const d = await run(
      proc({
        state: 'AWAITING_INITIAL_SCORE',
        enteredAt: minsAgo(3),
        transitionedAt: minsAgo(3),
      }),
      'я не хочу это обсуждать',
      3,
    );
    expect(d.kind).toBe('constrain');
    if (d.kind !== 'constrain') return;
    expect(d.note).toBe('incomplete');
    expect(d.process.state).toBe('INCOMPLETE');
    expect(d.process.initialScore).toBeNull();
  });

  it('an unreadable message count asks rather than releasing', async () => {
    const d = await runClosureOrchestration(USER_ID, {
      current: awaitingPost(),
      userMessage: 'не знаю',
      locale: null,
      loadSessionTurns: async () => [],
      countUserMessagesSince: async () => {
        throw new Error('db down');
      },
      now: NOW,
    });
    expect(d.kind).toBe('deliver');
    if (d.kind !== 'deliver') return;
    expect(d.step).toBe('stability_question_reask');
  });
});
