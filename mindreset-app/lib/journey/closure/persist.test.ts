// The single closure writer — post-#366 cleanup (2026-08-08).
//
// The payload used to be spelled out by hand in two unrelated writers. That is
// a silent data-loss shape: add a field to ClosureProcess, update one writer,
// and the other drops it on write while memory believes it persisted. These
// tests exist so that cannot come back.
//
// The compile-time half is `satisfies Record<keyof ClosureProcess, ...>` in
// persist.ts, which makes an omission a type error. These are the runtime half:
// they assert the payload actually covers every field and carries its value.

import { describe, expect, it, vi, beforeEach } from 'vitest';

type RpUpdateArgs = { where: unknown; data: Record<string, unknown> };
const rpUpdates: RpUpdateArgs[] = [];
let failNextWrite = false;

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      update: (args: RpUpdateArgs) => {
        if (failNextWrite) return Promise.reject(new Error('db down'));
        rpUpdates.push(args);
        return Promise.resolve({});
      },
    },
  },
}));

import {
  CLOSURE_PROCESS_FIELDS,
  closureProcessWriteData,
  persistClosureProcess,
} from './persist';
import { CLOSURE_PROCESS_NONE, type ClosureProcess } from './process';

const USER_ID = 'user_test_persist';
const NOW = new Date(Date.now());

/** Every field set to a DISTINCT non-default value, so a dropped one shows up. */
const FULL: ClosureProcess = {
  state: 'AWAITING_POST_SCORE',
  route: 'ACTIVATED_CLOSE',
  enteredAt: new Date(NOW.getTime() - 5 * 60_000),
  transitionedAt: new Date(NOW.getTime() - 60_000),
  roundCount: 1,
  completedAt: new Date(NOW.getTime() - 10 * 60_000),
  incompleteAt: new Date(NOW.getTime() - 20 * 60_000),
  initialScore: 4,
  initialScoreAt: new Date(NOW.getTime() - 4 * 60_000),
  postScore: 7,
  postScoreAt: new Date(NOW.getTime() - 30_000),
  freezeInterruptedAt: new Date(NOW.getTime() - 2 * 60_000),
};

beforeEach(() => {
  rpUpdates.length = 0;
  failNextWrite = false;
});

describe('the payload covers every ClosureProcess field', () => {
  it('writes exactly one column per field — no field can be forgotten', () => {
    // THE regression pin. If ClosureProcess gains a field and persist.ts is not
    // updated, the `satisfies` clause fails to compile; if the mapping is
    // updated but the builder is not, this count goes out of step.
    const fields = Object.keys(FULL) as Array<keyof ClosureProcess>;
    const data = closureProcessWriteData(FULL);
    expect(Object.keys(data)).toHaveLength(fields.length);
    expect(CLOSURE_PROCESS_FIELDS.slice().sort()).toEqual(fields.slice().sort());
  });

  it('every column is prefixed `closure` and none is undefined', () => {
    const data = closureProcessWriteData(FULL) as Record<string, unknown>;
    for (const [column, value] of Object.entries(data)) {
      expect(column.startsWith('closure')).toBe(true);
      expect(value).not.toBeUndefined();
    }
  });

  it('carries each value through to its column', () => {
    const data = closureProcessWriteData(FULL) as Record<string, unknown>;
    expect(data.closureProcessState).toBe('AWAITING_POST_SCORE');
    expect(data.closureRoute).toBe('ACTIVATED_CLOSE');
    expect(data.closureRoundCount).toBe(1);
    expect(data.closureInitialScore).toBe(4);
    expect(data.closurePostScore).toBe(7);
    expect(data.closureEnteredAt).toEqual(FULL.enteredAt);
    expect(data.closureTransitionedAt).toEqual(FULL.transitionedAt);
    expect(data.closureCompletedAt).toEqual(FULL.completedAt);
    expect(data.closureIncompleteAt).toEqual(FULL.incompleteAt);
    expect(data.closureInitialScoreAt).toEqual(FULL.initialScoreAt);
    expect(data.closurePostScoreAt).toEqual(FULL.postScoreAt);
    expect(data.closureFreezeInterruptedAt).toEqual(FULL.freezeInterruptedAt);
  });

  it('writes nulls as nulls rather than omitting them', () => {
    // Entry CLEARS the scores. If a cleared field were omitted instead of
    // written null, a stale score would survive in the row.
    const data = closureProcessWriteData(CLOSURE_PROCESS_NONE) as Record<string, unknown>;
    expect(Object.keys(data)).toHaveLength(CLOSURE_PROCESS_FIELDS.length);
    expect(data.closureInitialScore).toBeNull();
    expect(data.closurePostScore).toBeNull();
    expect(data.closureRoute).toBeNull();
  });
});

describe('persistClosureProcess semantics are unchanged', () => {
  it('returns the new record and persisted:true on success', async () => {
    const r = await persistClosureProcess(USER_ID, CLOSURE_PROCESS_NONE, FULL, 'test');
    expect(r).toEqual({ process: FULL, persisted: true });
    expect(rpUpdates).toHaveLength(1);
    expect(rpUpdates[0].where).toEqual({ userId: USER_ID });
    expect(rpUpdates[0].data).toEqual(closureProcessWriteData(FULL));
  });

  it('a failed write returns the STORED record, never the attempted one', async () => {
    // Memory must never claim a transition the store refused.
    failNextWrite = true;
    const r = await persistClosureProcess(USER_ID, CLOSURE_PROCESS_NONE, FULL, 'test');
    expect(r.persisted).toBe(false);
    expect(r.process).toBe(CLOSURE_PROCESS_NONE);
    expect(rpUpdates).toHaveLength(0);
  });

  it('never throws — a persist failure must not cost the user a turn', async () => {
    failNextWrite = true;
    await expect(
      persistClosureProcess(USER_ID, CLOSURE_PROCESS_NONE, FULL, null),
    ).resolves.toBeDefined();
  });
});
