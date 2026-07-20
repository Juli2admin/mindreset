// Tests for the Journey P3 session task contract (2026-07-19, audit RC2).
//
// The clinical rule under test: the user's ask — presenting request,
// expected help, current focus, completion criterion, all in their own
// words — is captured once, held across the session, and protected from
// erosion. Three-layer behaviour:
//
//   1. parseStateReport accepts a sparse `taskContract` emission and DROPS
//      empty/generic values ("unclear", "n/a") so they can never reach the
//      merge.
//   2. applyStateReportToProgress merges field-wise against the stored
//      contract: a new non-empty value updates its field; absent fields
//      keep their stored value (no-clobber). presentingRequest is
//      revisable — the user may change direction.
//   3. The state block renders the contract FIRST (before intervention
//      selection); when none is captured yet it invites inference —
//      explicitly not a questionnaire.
//
// Plus a fixture pin: the master prompt's emission docs and clinical-
// reading bullets, asserted against the runtime loader output.

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

import { parseStateReport, parseTaskContract } from '../stateReport/parse';
import { applyStateReportToProgress, mergeTaskContract } from './save';
import { assembleSystemPromptBlocks } from '../prompts/assemble';
import { loadMasterJourneyPrompt } from '../prompts/load-spec';
import type { JourneyState } from './types';

const USER_ID = 'user_test_task_contract';

const BASE_REPORT = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

beforeEach(() => {
  rpUpdates.length = 0;
  rpFindUniqueImpl.mockReset();
  rpFindUniqueImpl.mockResolvedValue({
    anchorTextEncrypted: 'enc(my bench)',
    mii: {},
    taskContractEncrypted: null,
  });
});

// ---------------------------------------------------------------------------
// 1. Parser
// ---------------------------------------------------------------------------

describe('parseStateReport / parseTaskContract — validation', () => {
  it('accepts a sparse contract emission (trimmed)', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE_REPORT,
        taskContract: {
          presentingRequest: '  I want to stop panicking before my mother visits  ',
          currentFocus: 'the panic in my chest',
        },
      }),
    );
    expect(r.taskContract).toEqual({
      presentingRequest: 'I want to stop panicking before my mother visits',
      currentFocus: 'the panic in my chest',
    });
  });

  it('DROPS generic/placeholder values so they cannot reach the merge', () => {
    for (const generic of ['none', 'n/a', 'unknown', 'unclear', 'not clear yet', 'tbd', '-', '...']) {
      const out = parseTaskContract({ presentingRequest: generic });
      expect(out, `"${generic}" should be dropped`).toBeUndefined();
    }
  });

  it('drops values under 3 chars and non-strings', () => {
    expect(parseTaskContract({ presentingRequest: 'ab' })).toBeUndefined();
    expect(parseTaskContract({ presentingRequest: 42 })).toBeUndefined();
    expect(parseTaskContract('help me')).toBeUndefined();
    expect(parseTaskContract(null)).toBeUndefined();
  });

  it('caps each field at 300 chars', () => {
    const out = parseTaskContract({ expectedHelp: 'x'.repeat(500) });
    expect(out?.expectedHelp).toHaveLength(300);
  });

  it('returns undefined (absent field) when no field survives — not an empty object', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE_REPORT, taskContract: { presentingRequest: 'n/a' } }),
    );
    expect(r.taskContract).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Merge (pure) + persistence
// ---------------------------------------------------------------------------

describe('mergeTaskContract — field-wise no-clobber merge', () => {
  it('absent fields keep their stored value', () => {
    const merged = mergeTaskContract(
      { presentingRequest: 'stop panicking at work', expectedHelp: 'understand why it happens' },
      { currentFocus: 'the mother visit next week' },
    );
    expect(merged).toEqual({
      presentingRequest: 'stop panicking at work',
      expectedHelp: 'understand why it happens',
      currentFocus: 'the mother visit next week',
    });
  });

  it('presentingRequest IS revisable — the user may change direction', () => {
    const merged = mergeTaskContract(
      { presentingRequest: 'stop panicking at work' },
      { presentingRequest: 'actually I want to work on my marriage' },
    );
    expect(merged?.presentingRequest).toBe('actually I want to work on my marriage');
  });

  it('short/empty patch values never overwrite a stored field', () => {
    const merged = mergeTaskContract(
      { presentingRequest: 'stop panicking at work' },
      { presentingRequest: '' },
    );
    expect(merged?.presentingRequest).toBe('stop panicking at work');
  });

  it('returns null only when both sides are empty', () => {
    expect(mergeTaskContract(null, {})).toBeNull();
    expect(mergeTaskContract({ currentFocus: 'the panic' }, {})).toEqual({
      currentFocus: 'the panic',
    });
  });
});

describe('applyStateReportToProgress — contract persistence', () => {
  function writtenContract(): Record<string, unknown> | null {
    const withContract = rpUpdates.filter(
      (u) => typeof u.data.taskContractEncrypted === 'string',
    );
    if (withContract.length === 0) return null;
    const raw = (withContract[0].data.taskContractEncrypted as string).replace(
      /^enc\((.*)\)$/,
      '$1',
    );
    return JSON.parse(raw);
  }

  it('first capture writes the encrypted contract', async () => {
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      taskContract: { presentingRequest: 'stop panicking before visits' },
    });
    expect(writtenContract()).toEqual({ presentingRequest: 'stop panicking before visits' });
  });

  it('NO-CLOBBER: a sparse later emission merges with the stored contract', async () => {
    rpFindUniqueImpl.mockResolvedValue({
      anchorTextEncrypted: 'enc(my bench)',
      mii: {},
      taskContractEncrypted: `enc(${JSON.stringify({
        presentingRequest: 'stop panicking before visits',
        expectedHelp: 'understand where it comes from',
      })})`,
    });
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      taskContract: { currentFocus: 'the knot in my stomach' },
    });
    expect(writtenContract()).toEqual({
      presentingRequest: 'stop panicking before visits',
      expectedHelp: 'understand where it comes from',
      currentFocus: 'the knot in my stomach',
    });
  });

  it('no taskContract in the report → stored contract untouched', async () => {
    rpFindUniqueImpl.mockResolvedValue({
      anchorTextEncrypted: 'enc(my bench)',
      mii: {},
      taskContractEncrypted: `enc(${JSON.stringify({ presentingRequest: 'stop panicking' })})`,
    });
    await applyStateReportToProgress(USER_ID, { ...BASE_REPORT });
    expect(writtenContract()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. State-block render
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_render_contract_test',
    currentStage: 1,
    currentDepth: 'surface',
    startedAt: new Date('2026-07-01'),
    lastActivityAt: new Date('2026-07-18'),
    dischargedAt: null,
    anchorText: null,
    anchorSetAt: null,
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: null,
    adultSelfQualities: null,
    lastIntensity: null,
    lastIntensityAt: null,
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
    sessionCount: 1,
    daysEngaged: 1,
    thisSessionMessageCount: 0,
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

const STATE_BLOCK_INDEX = 2;

describe('state block — task contract render', () => {
  it('renders the captured contract in the user\'s words, before the stage label', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        taskContract: {
          presentingRequest: 'stop panicking before visits',
          expectedHelp: 'understand where it comes from',
          currentFocus: 'the knot in my stomach',
          completionCriterion: 'I can think about the visit without my chest tightening',
        },
      }),
    );
    const text = blocks[STATE_BLOCK_INDEX].text;
    expect(text).toContain("**Session task contract (the user's ask — in their words):**");
    expect(text).toContain('- Presenting request: "stop panicking before visits"');
    expect(text).toContain('- Expected help: "understand where it comes from"');
    expect(text).toContain('- Current working focus: "the knot in my stomach"');
    expect(text).toContain(
      '- What "addressed" looks like: "I can think about the visit without my chest tightening"',
    );
    // Contract precedes the router's stage label — available before
    // intervention selection.
    expect(text.indexOf('Session task contract')).toBeLessThan(
      text.indexOf("Router's stage label"),
    );
  });

  it('renders sparse contracts without empty lines for missing fields', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ taskContract: { presentingRequest: 'stop panicking before visits' } }),
    );
    const text = blocks[STATE_BLOCK_INDEX].text;
    expect(text).toContain('- Presenting request: "stop panicking before visits"');
    expect(text).not.toContain('- Expected help:');
    expect(text).not.toContain('- Current working focus:');
  });

  it('invites inference (never a questionnaire) when no contract is captured yet', () => {
    const blocks = assembleSystemPromptBlocks(makeState());
    const text = blocks[STATE_BLOCK_INDEX].text;
    expect(text).toContain('**No session task contract captured yet.**');
    expect(text).toContain('never run a questionnaire');
  });
});

// ---------------------------------------------------------------------------
// 4. Master-prompt fixture pins (runtime loader output)
// ---------------------------------------------------------------------------

describe('master prompt — task-contract wording', () => {
  const master = loadMasterJourneyPrompt() ?? '';

  it('documents the taskContract emission with all four fields', () => {
    const idx = master.indexOf('Session task contract (establish early; sparse updates after):');
    expect(idx).toBeGreaterThan(-1);
    const block = master.slice(idx, idx + 1200);
    expect(block).toContain('`taskContract`');
    expect(block).toContain('`presentingRequest`');
    expect(block).toContain('`expectedHelp`');
    expect(block).toContain('`currentFocus`');
    expect(block).toContain('`completionCriterion`');
    expect(block).toContain('it never silently replaces `presentingRequest`');
    expect(block).toContain('Never emit empty or generic values');
  });

  it('clinical reading opens with the ask and closes with request-addressed', () => {
    expect(master).toContain('**What are they asking for, and what do they expect?**');
    expect(master).toContain('**Has the original request been addressed?**');
    expect(master).toContain('Check it against the task contract before committing.');
  });

  it('closure check question 1 now points at the contract', () => {
    expect(master).toContain(
      'Has the request the user brought been addressed? (The session task contract in the state block holds it in their words.)',
    );
  });
});
