// Measurement-first closure orchestration — Phase 2 (2026-08-08).
//
// The settled architecture under test (owner decision 2026-08-08):
//
//   historical destabilisation  ->  "does this close require a CURRENT
//                                    stability measurement?"    (proportionality)
//   the user's own current score ->  "is the user stable enough to close?"
//                                                               (current state)
//
// Historical destabilisation is NOT current activation. A session that spiked
// earlier and has genuinely settled must be able to close normally — that is
// what keeps the trigger a measurement requirement rather than a verdict.
//
// The acceptance case is the verified live failure of 2026-08-08 08:49:22:
// intensity reached 6 on eleven turns, the user asked to stop, and the session
// closed with no stability measurement ever taken.

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

import { runClosureOrchestration, measurementRequired } from './orchestrator';
import { CLOSURE_PROCESS_NONE, type ClosureProcess } from './process';
import { STABILITY_QUESTION_EN, STABILITY_QUESTION_RU } from './stability-question';
import type { ClosureTurn } from './guard';

const USER_ID = 'user_test_measurement_first';

// Clock-relative, never absolute: the session-boundary walk measures against
// the value passed in, and an absolute date near "now" passes on the day it is
// written and breaks the build the next day (#364).
const NOW = new Date(Date.now());
const MIN = 60 * 1000;
const minsAgo = (m: number) => new Date(NOW.getTime() - m * MIN);

function turn(m: number, intensity: number, safetyFlag = 'none'): ClosureTurn {
  return { n: 0, createdAt: minsAgo(m), intensity, safetyFlag, cycleStatus: 'open' };
}

function proc(overrides: Partial<ClosureProcess> = {}): ClosureProcess {
  return { ...CLOSURE_PROCESS_NONE, ...overrides };
}

const run = (
  current: ClosureProcess,
  userMessage: string,
  turns: ClosureTurn[] = [],
  locale: string | null = null,
) =>
  runClosureOrchestration(USER_ID, {
    current,
    userMessage,
    locale,
    loadSessionTurns: async () => turns,
    now: NOW,
  });

beforeEach(() => {
  rpUpdates.length = 0;
});

describe('proportionality — historical destabilisation only decides IF a measurement is needed', () => {
  it('a settled session requires no measurement', () => {
    expect(measurementRequired([turn(10, 3), turn(5, 4)], NOW)).toBe(false);
  });

  it('a session that reached the destabilisation intensity requires one', () => {
    expect(measurementRequired([turn(10, 3), turn(5, 6)], NOW)).toBe(true);
  });

  it('a safety flag also requires one', () => {
    expect(measurementRequired([turn(5, 3, 'watch')], NOW)).toBe(true);
  });

  it('a spike in a PREVIOUS session does not', () => {
    // Older than the session boundary relative to the newer turn.
    expect(measurementRequired([turn(2, 4), turn(60 * 24, 9)], NOW)).toBe(false);
  });
});

describe('entry — only an explicit session exit is considered', () => {
  it('an ordinary turn proceeds and loads no history', async () => {
    let loaded = false;
    const d = await runClosureOrchestration(USER_ID, {
      current: proc(),
      userMessage: 'сегодня было тяжело',
      locale: null,
      loadSessionTurns: async () => {
        loaded = true;
        return [];
      },
      now: NOW,
    });
    expect(d.kind).toBe('proceed');
    expect(loaded).toBe(false);
    expect(rpUpdates).toHaveLength(0);
  });

  it('an activity stop never enters', async () => {
    const d = await run(proc(), 'не хочу об этом разговаривать', [turn(5, 8)]);
    expect(d.kind).toBe('proceed');
    expect(d.process.state).toBe('NONE');
  });

  it('a session exit with no destabilisation stays an ordinary close', async () => {
    const d = await run(proc(), 'мне пора', [turn(10, 3), turn(5, 4)]);
    expect(d.kind).toBe('proceed');
    expect(d.process.state).toBe('NONE');
    expect(rpUpdates).toHaveLength(0);
  });
});

describe('ACCEPTANCE — the verified 2026-08-08 08:49 failure', () => {
  it('the real exit phrase after an intensity-6 session demands a measurement', async () => {
    const session = [turn(20, 4), turn(12, 6), turn(6, 6), turn(1, 6)];
    const d = await run(proc(), 'Я, наверное, больше не хочу разговаривать', session);

    // The model is NOT called this turn.
    expect(d.kind).toBe('deliver');
    if (d.kind !== 'deliver') return;
    expect(d.text).toBe(STABILITY_QUESTION_EN);
    expect(d.step).toBe('stability_question');

    // Entered without a route — which route this is, is the score's answer.
    expect(d.process.state).toBe('AWAITING_INITIAL_SCORE');
    expect(d.process.route).toBeNull();
    expect(rpUpdates).toHaveLength(1);
    expect(rpUpdates[0].data.closureProcessState).toBe('AWAITING_INITIAL_SCORE');
    expect(rpUpdates[0].data.closureRoute).toBeNull();
  });

  it('asks in the user locale', async () => {
    const d = await run(
      proc(),
      'Я, наверное, больше не хочу разговаривать',
      [turn(1, 6)],
      'ru',
    );
    expect(d.kind).toBe('deliver');
    if (d.kind !== 'deliver') return;
    expect(d.text).toBe(STABILITY_QUESTION_RU);
  });
});

describe('the score decides the route', () => {
  const awaiting = () =>
    proc({ state: 'AWAITING_INITIAL_SCORE', enteredAt: minsAgo(1), transitionedAt: minsAgo(1) });

  it('at or above threshold → NORMAL_CLOSE, no stabilisation ever runs', async () => {
    const d = await run(awaiting(), '8');
    expect(d.kind).toBe('proceed');
    expect(d.process.state).toBe('AWAITING_CLOSE_CONFIRMATION');
    expect(d.process.route).toBe('NORMAL_CLOSE');
    expect(d.process.roundCount).toBe(0);
    expect(d.process.initialScore).toBe(8);
  });

  it('below threshold → ACTIVATED_CLOSE and a stabilisation round', async () => {
    const d = await run(awaiting(), 'наверное 4');
    expect(d.kind).toBe('proceed');
    expect(d.process.state).toBe('DELIVERING_STABILISATION');
    expect(d.process.route).toBe('ACTIVATED_CLOSE');
    expect(d.process.roundCount).toBe(1);
    expect(d.process.initialScore).toBe(4);
  });

  it('exactly at the threshold closes normally', async () => {
    const d = await run(awaiting(), '6');
    expect(d.process.route).toBe('NORMAL_CLOSE');
  });

  it('re-asks when the message carries no usable number', async () => {
    const d = await run(awaiting(), 'я не знаю, тяжело сказать');
    expect(d.kind).toBe('deliver');
    if (d.kind !== 'deliver') return;
    expect(d.step).toBe('stability_question_reask');
    expect(d.process.state).toBe('AWAITING_INITIAL_SCORE');
  });

  it('does not mistake an unrelated number for a score', async () => {
    const d = await run(awaiting(), '4 часа сна');
    expect(d.kind).toBe('deliver');
    if (d.kind !== 'deliver') return;
    expect(d.step).toBe('stability_question_reask');
    expect(d.process.initialScore).toBeNull();
  });
});

describe('CASE B — historical destabilisation is not latched as current activation', () => {
  it('a session that spiked to 8 and genuinely settled closes normally', async () => {
    // The spike makes a measurement REQUIRED...
    const session = [turn(30, 8), turn(20, 6), turn(4, 4)];
    const entered = await run(proc(), 'мне пора', session);
    expect(entered.kind).toBe('deliver');
    expect(entered.process.state).toBe('AWAITING_INITIAL_SCORE');

    // ...and the user's own current score decides it needs no stabilisation.
    const scored = await run(entered.process, '8');
    expect(scored.process.route).toBe('NORMAL_CLOSE');
    expect(scored.process.state).toBe('AWAITING_CLOSE_CONFIRMATION');
    expect(scored.process.roundCount).toBe(0);
  });
});

describe('fail-safe', () => {
  it('unreadable history takes no process action', async () => {
    const d = await runClosureOrchestration(USER_ID, {
      current: proc(),
      userMessage: 'мне пора',
      locale: null,
      loadSessionTurns: async () => {
        throw new Error('db down');
      },
      now: NOW,
    });
    expect(d.kind).toBe('proceed');
    expect(d.process.state).toBe('NONE');
    expect(rpUpdates).toHaveLength(0);
  });

  it('a frozen-path INCOMPLETE conversion still short-circuits nothing', async () => {
    const d = await run(proc({ state: 'INCOMPLETE', incompleteAt: minsAgo(5) }), 'мне пора');
    expect(d.kind).toBe('proceed');
  });
});
