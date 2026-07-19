// Tests for Journey P1 release semantics (2026-07-19, audit A8/B6).
//
// The clinical rule under test: a symbolic release is a HYPOTHESIS until the
// user confirms it across time. Three-layer behaviour:
//
//   1. parseStateReport accepts the new `releaseConfirmed` and
//      `releaseInvalidated` emissions (and still accepts the existing
//      `foreignFileReleased`).
//   2. applyStateReportToProgress:
//      - foreignFileReleased stamps releaseClaimedAt only — NEVER releasedAt
//      - releaseConfirmed stamps releasedAt, but only for a file with a
//        standing claim from an EARLIER turn (same-turn claim+confirm is a
//        guarded no-op)
//      - releaseInvalidated clears both stamps (reopens the file), even for
//        a previously-confirmed release
//   3. The state block renders the three phases distinctly: identified /
//      release claimed (PROVISIONAL) / released (confirmed).
//
// The Stage 5 gate reads releasedAt, so these semantics are what make
// "release held across time" — not "release ritual narrated once" — the
// thing that opens Stage 5 → 6. See stage5-gate.test.ts for the gate side.

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock prisma BEFORE importing the modules under test — same pattern as
// mii6-check.test.ts. We capture journeyForeignFile.update/.create args so
// tests can assert exactly which stamps are written.
const ffUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
const ffCreates: Array<{ data: Record<string, unknown> }> = [];
const ffFindManyImpl = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      findUnique: vi.fn(() =>
        Promise.resolve({ anchorTextEncrypted: 'enc(my bench)', mii: {} }),
      ),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeyPart: {
      findMany: vi.fn(() => Promise.resolve([])),
      create: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeyForeignFile: {
      findMany: (...args: unknown[]) => ffFindManyImpl(...args),
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        ffCreates.push(args);
        return Promise.resolve({});
      }),
      update: vi.fn((args: { where: unknown; data: Record<string, unknown> }) => {
        ffUpdates.push(args);
        return Promise.resolve({});
      }),
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
import { applyStateReportToProgress } from './save';
import { assembleSystemPromptBlocks } from '../prompts/assemble';
import type { JourneyState, JourneyForeignFile } from './types';

const USER_ID = 'user_test_release_semantics';
const VOICE = 'the "must be useful" voice';

const BASE_REPORT = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

beforeEach(() => {
  ffUpdates.length = 0;
  ffCreates.length = 0;
  ffFindManyImpl.mockReset();
  ffFindManyImpl.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// 1. Parser
// ---------------------------------------------------------------------------

describe('parseStateReport — releaseConfirmed / releaseInvalidated', () => {
  it('accepts releaseConfirmed with a description (trimmed)', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE_REPORT, releaseConfirmed: { description: `  ${VOICE}  ` } }),
    );
    expect(r.releaseConfirmed).toEqual({ description: VOICE });
  });

  it('drops releaseConfirmed with an empty description', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE_REPORT, releaseConfirmed: { description: '   ' } }),
    );
    expect(r.releaseConfirmed).toBeUndefined();
  });

  it('drops releaseConfirmed that is not an object', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE_REPORT, releaseConfirmed: VOICE }),
    );
    expect(r.releaseConfirmed).toBeUndefined();
  });

  it('accepts releaseInvalidated with description and reason', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE_REPORT,
        releaseInvalidated: { description: VOICE, reason: 'voice reactivated at work' },
      }),
    );
    expect(r.releaseInvalidated).toEqual({
      description: VOICE,
      reason: 'voice reactivated at work',
    });
  });

  it('accepts releaseInvalidated without a reason', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE_REPORT, releaseInvalidated: { description: VOICE } }),
    );
    expect(r.releaseInvalidated).toEqual({ description: VOICE });
  });

  it('caps the releaseInvalidated reason at 200 chars', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE_REPORT,
        releaseInvalidated: { description: VOICE, reason: 'x'.repeat(500) },
      }),
    );
    expect(r.releaseInvalidated?.reason).toHaveLength(200);
  });

  it('still accepts the existing foreignFileReleased emission', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE_REPORT,
        foreignFileReleased: { description: VOICE, returnedTo: "my mother's house" },
      }),
    );
    expect(r.foreignFileReleased?.description).toBe(VOICE);
  });
});

// ---------------------------------------------------------------------------
// 2. Persistence
// ---------------------------------------------------------------------------

describe('applyStateReportToProgress — claim / confirm / invalidate', () => {
  it('foreignFileReleased stamps releaseClaimedAt on the matched file — never releasedAt', async () => {
    ffFindManyImpl.mockResolvedValue([
      { id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` },
    ]);
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      foreignFileReleased: { description: VOICE, returnedTo: "my mother's house" },
    });
    expect(ffUpdates).toHaveLength(1);
    expect(ffUpdates[0].where).toEqual({ id: 'ff1' });
    expect(ffUpdates[0].data.releaseClaimedAt).toBeInstanceOf(Date);
    expect(ffUpdates[0].data).not.toHaveProperty('releasedAt');
  });

  it('foreignFileReleased with no prior identification creates the file with the claim only', async () => {
    ffFindManyImpl.mockResolvedValue([]);
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      foreignFileReleased: { description: VOICE },
    });
    expect(ffCreates).toHaveLength(1);
    expect(ffCreates[0].data.releaseClaimedAt).toBeInstanceOf(Date);
    expect(ffCreates[0].data).not.toHaveProperty('releasedAt');
  });

  it('releaseConfirmed on a later turn stamps releasedAt on the claimed file', async () => {
    ffFindManyImpl.mockResolvedValue([
      { id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` },
    ]);
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      releaseConfirmed: { description: VOICE },
    });
    expect(ffUpdates).toHaveLength(1);
    expect(ffUpdates[0].where).toEqual({ id: 'ff1' });
    expect(ffUpdates[0].data.releasedAt).toBeInstanceOf(Date);
  });

  it('GUARD: same-turn claim + confirm never stamps releasedAt', async () => {
    // The AI narrates a release AND claims user confirmation in one report.
    // Confirmation must come from a LATER turn — the same-turn confirm is
    // a no-op; only the provisional claim is written.
    ffFindManyImpl.mockResolvedValue([
      { id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` },
    ]);
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      foreignFileReleased: { description: VOICE },
      releaseConfirmed: { description: VOICE },
    });
    expect(ffUpdates).toHaveLength(1);
    expect(ffUpdates[0].data.releaseClaimedAt).toBeInstanceOf(Date);
    expect(ffUpdates[0].data).not.toHaveProperty('releasedAt');
  });

  it('releaseConfirmed with no matching standing claim writes nothing', async () => {
    ffFindManyImpl.mockResolvedValue([
      { id: 'ff_other', userDescriptionEncrypted: 'enc(a different voice)' },
    ]);
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      releaseConfirmed: { description: VOICE },
    });
    expect(ffUpdates).toHaveLength(0);
  });

  it('releaseInvalidated clears both stamps (reopens the file)', async () => {
    ffFindManyImpl.mockResolvedValue([
      { id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` },
    ]);
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      releaseInvalidated: { description: VOICE, reason: 'felt worse next morning' },
    });
    expect(ffUpdates).toHaveLength(1);
    expect(ffUpdates[0].where).toEqual({ id: 'ff1' });
    expect(ffUpdates[0].data).toEqual({ releaseClaimedAt: null, releasedAt: null });
  });
});

// ---------------------------------------------------------------------------
// 3. State-block render
// ---------------------------------------------------------------------------

function makeFile(overrides: Partial<JourneyForeignFile> = {}): JourneyForeignFile {
  return {
    id: 'file_render_test',
    userDescription: VOICE,
    originDescription: 'my mother',
    returnedTo: null,
    honouringPhrase: null,
    whatStaysAsMine: null,
    identifiedAt: new Date('2026-07-01'),
    releaseClaimedAt: null,
    releasedAt: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_render_release_test',
    currentStage: 5,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-15'),
    lastActivityAt: new Date('2026-07-18'),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-06-16'),
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: null,
    adultSelfQualities: null,
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
    foreignFiles: [],
    signatureImages: [],
    patterns: [],
    sessionCount: 10,
    daysEngaged: 20,
    thisSessionMessageCount: 3,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
    ...overrides,
  };
}

// State block index in the assembled prompt (see state-block.test.ts).
const STATE_BLOCK_INDEX = 2;

describe('state block — three release phases rendered distinctly', () => {
  it('renders an unclaimed file as identified', () => {
    const blocks = assembleSystemPromptBlocks(makeState({ foreignFiles: [makeFile()] }));
    const text = blocks[STATE_BLOCK_INDEX].text;
    expect(text).toContain(`"${VOICE}"`);
    expect(text).toContain('identified');
    expect(text).not.toContain('PROVISIONAL');
  });

  it('renders a claimed-but-unconfirmed release as PROVISIONAL', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ foreignFiles: [makeFile({ releaseClaimedAt: new Date('2026-07-17') })] }),
    );
    const text = blocks[STATE_BLOCK_INDEX].text;
    expect(text).toContain('release claimed (PROVISIONAL');
    expect(text).not.toContain('released (confirmed by user across time)');
  });

  it('renders a confirmed release as released', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        foreignFiles: [
          makeFile({
            releaseClaimedAt: new Date('2026-07-15'),
            releasedAt: new Date('2026-07-17'),
          }),
        ],
      }),
    );
    const text = blocks[STATE_BLOCK_INDEX].text;
    expect(text).toContain('released (confirmed by user across time)');
    expect(text).not.toContain('PROVISIONAL');
  });
});
