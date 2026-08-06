// Tests that model output cannot reach the server-owned closure process
// state — Phase 1 (2026-08-05).
//
// The requirement under test: a failed, missing, malformed or closure-claiming
// state report must never write, clear or otherwise disturb the persisted
// process fields. The process is server-owned; the state report is the model's
// clinical reading. applyStateReportToProgress is the only place a state
// report touches RecodeProgress, so this is where the boundary is proved.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
const rpFindUniqueImpl = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      findUnique: (...args: unknown[]) => rpFindUniqueImpl(...args),
      update: vi.fn((args: { where: unknown; data: Record<string, unknown> }) => {
        rpUpdates.push(args);
        return Promise.resolve({});
      }),
    },
    journeyPart: {
      findMany: vi.fn(() => Promise.resolve([])),
      create: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeyForeignFile: {
      findMany: vi.fn(() => Promise.resolve([])),
      create: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeyPattern: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeySignatureImage: {
      findMany: vi.fn(() => Promise.resolve([])),
      create: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock('@/lib/encrypt', () => ({
  encrypt: (s: string) => `enc(${s})`,
  decrypt: (s: string) => s.replace(/^enc\((.*)\)$/, '$1'),
}));

import { parseStateReport } from '../stateReport/parse';
import { applyStateReportToProgress } from '../state/save';

const USER_ID = 'user_test_closure_isolation';

/** An in-flight process, as it would stand on the row mid-sequence. */
const IN_FLIGHT_ROW = {
  anchorTextEncrypted: null,
  mii: {},
  taskContractEncrypted: null,
  currentDepth: 'middle',
  closureProcessState: 'AWAITING_POST_SCORE',
};

beforeEach(() => {
  rpUpdates.length = 0;
  rpFindUniqueImpl.mockReset();
  rpFindUniqueImpl.mockResolvedValue(IN_FLIGHT_ROW);
});

function closureKeys(data: Record<string, unknown>): string[] {
  return Object.keys(data).filter((k) => k.startsWith('closure'));
}

describe('state reports never write the closure process state', () => {
  it('a missing state report writes no closure field', async () => {
    // What route.ts produces when the model emitted no <state-report> at all.
    await applyStateReportToProgress(USER_ID, parseStateReport(null));
    expect(rpUpdates).toHaveLength(1);
    expect(closureKeys(rpUpdates[0].data)).toEqual([]);
  });

  it('a malformed state report writes no closure field', async () => {
    await applyStateReportToProgress(USER_ID, parseStateReport('{not json at all'));
    expect(closureKeys(rpUpdates[0].data)).toEqual([]);
  });

  it('a full, healthy state report writes no closure field', async () => {
    const report = parseStateReport(
      JSON.stringify({
        intensity: 4,
        safetyFlag: 'none',
        recommendedAction: 'stay',
        continuityNote: 'we stayed with the chest tightness',
        channel: 'kinesthetic',
      }),
    );
    await applyStateReportToProgress(USER_ID, report);
    expect(closureKeys(rpUpdates[0].data)).toEqual([]);
  });

  it('a model closure CLAIM cannot end the server-owned process', async () => {
    // cycleStatus / cycleCanClose are the model's clinical reading. They are
    // not the process authority and must not reach these columns.
    const report = parseStateReport(
      JSON.stringify({
        intensity: 2,
        safetyFlag: 'none',
        recommendedAction: 'stay',
        cycleStatus: 'closed',
        cycleCanClose: true,
        stabilityCheck: { score: 9, scale: 'stability', source: 'user_reported' },
      }),
    );
    await applyStateReportToProgress(USER_ID, report);
    expect(closureKeys(rpUpdates[0].data)).toEqual([]);
  });

  it('a red-flag report cannot end the server-owned process either', async () => {
    const report = parseStateReport(
      JSON.stringify({
        intensity: 10,
        safetyFlag: 'red_flag',
        recommendedAction: 'red_flag',
      }),
    );
    await applyStateReportToProgress(USER_ID, report);
    expect(closureKeys(rpUpdates[0].data)).toEqual([]);
  });

  it('leaves the persisted process untouched across a whole turn of reports', async () => {
    for (const raw of [
      null,
      '{"intensity":5,"safetyFlag":"none","recommendedAction":"stay"}',
      '{"intensity":3,"safetyFlag":"none","recommendedAction":"advance","cycleStatus":"closed"}',
    ]) {
      await applyStateReportToProgress(USER_ID, parseStateReport(raw));
    }
    for (const update of rpUpdates) {
      expect(closureKeys(update.data)).toEqual([]);
    }
    // The row the save layer read is the one the orchestrator wrote; nothing
    // in this path proposes a new value for it.
    expect(rpFindUniqueImpl).toHaveBeenCalled();
  });
});
