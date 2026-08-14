// Middle Layer PR 8′ (2026-08-14) — the Rung-3 persistence guard.
//
// PR 7′ stopped unlicensed Rung-3 signals earning ADVANCEMENT credit. This
// stops the same class of work becoming AUTHORITATIVE PERSISTED STATE.
//
// Two things are under test, and the second is the one that keeps this
// change safe rather than merely strict:
//
//   1. Below rung 3, the three Category-A capture paths write nothing.
//   2. Everything protective still works — demotion at every rung, aftercare
//      at every rung, the archived report untouched, and every
//      context-dependent field persisting exactly as before.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
const ffCreates: Array<{ data: Record<string, unknown> }> = [];
const ffUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
const partCreates: Array<{ data: Record<string, unknown> }> = [];
const rpFindUniqueImpl = vi.fn();
const ffFindManyImpl = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      findUnique: (...args: unknown[]) => rpFindUniqueImpl(...args),
      update: vi.fn((args: { where: unknown; data: Record<string, unknown> }) => {
        rpUpdates.push(args);
        return Promise.resolve({});
      }),
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
    journeyPart: {
      findMany: vi.fn(() => Promise.resolve([])),
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        partCreates.push(args);
        return Promise.resolve({});
      }),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeyPattern: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeyEvidenceExchange: {
      findMany: vi.fn(() => Promise.resolve([])),
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

import { isRung3Licensed, RUNG3_PERSISTENCE_REFUSED } from './rung3-persistence';
import { applyStateReportToProgress } from '../state/save';
import type { StateReport } from '../stateReport/schema';

const USER = 'user_pr8';
const VOICE = 'the "must be useful" voice';
const ANCHOR = 'I am someone who makes things because she loves to';

const BASE = { intensity: 4, safetyFlag: 'none' as const, recommendedAction: 'stay' as const };

/** Progress row at a given licence. */
function progress(rung3: boolean) {
  return {
    anchorTextEncrypted: 'enc(the trees outside my window)',
    mii: {},
    taskContractEncrypted: null,
    currentDepth: 'surface',
    closureProcessState: 'NONE',
    middleLayerTargetStatus: rung3 ? 'established' : 'established',
    middleLayerMechanismStatus: rung3 ? 'established' : 'leading',
  };
}

function lastProgressWrite() {
  return rpUpdates[rpUpdates.length - 1]?.data ?? {};
}

beforeEach(() => {
  rpUpdates.length = 0;
  ffCreates.length = 0;
  ffUpdates.length = 0;
  partCreates.length = 0;
  rpFindUniqueImpl.mockReset();
  ffFindManyImpl.mockReset();
  ffFindManyImpl.mockResolvedValue([]);
  rpFindUniqueImpl.mockResolvedValue(progress(false));
});

// ===========================================================================
// 0. The licence itself
// ===========================================================================

describe('isRung3Licensed', () => {
  it('is true only when the persisted mechanism status is established', () => {
    expect(isRung3Licensed({ middleLayerTargetStatus: 'established', middleLayerMechanismStatus: 'established' })).toBe(true);
    expect(isRung3Licensed({ middleLayerTargetStatus: 'established', middleLayerMechanismStatus: 'leading' })).toBe(false);
    expect(isRung3Licensed({ middleLayerTargetStatus: 'proposed', middleLayerMechanismStatus: 'none' })).toBe(false);
  });

  it('FAILS CLOSED on legacy, missing and corrupt state', () => {
    expect(isRung3Licensed(null)).toBe(false);
    expect(isRung3Licensed({})).toBe(false);
    expect(isRung3Licensed({ middleLayerTargetStatus: null, middleLayerMechanismStatus: null })).toBe(false);
    for (const bad of ['ESTABLISHED', 'sufficient', 'true', 'rung3', '']) {
      expect(isRung3Licensed({ middleLayerTargetStatus: bad, middleLayerMechanismStatus: bad })).toBe(false);
    }
  });
});

// ===========================================================================
// 1. foreignFileReleased
// ===========================================================================

describe('foreignFileReleased', () => {
  const report: StateReport = { ...BASE, foreignFileReleased: { description: VOICE } };

  it('REFUSED below rung 3 — no row created, no claim stamped', async () => {
    await applyStateReportToProgress(USER, report);
    expect(ffCreates).toHaveLength(0);
    expect(ffUpdates).toHaveLength(0);
  });

  it('does not create a file row through the RELEASE path when unlicensed', async () => {
    ffFindManyImpl.mockResolvedValue([]); // nothing identified yet
    await applyStateReportToProgress(USER, report);
    expect(ffCreates).toHaveLength(0);
  });

  it('works normally at rung 3 — claim stamped, releasedAt never', async () => {
    rpFindUniqueImpl.mockResolvedValue(progress(true));
    ffFindManyImpl.mockResolvedValue([{ id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` }]);
    await applyStateReportToProgress(USER, report);
    expect(ffUpdates).toHaveLength(1);
    expect(ffUpdates[0].data.releaseClaimedAt).toBeInstanceOf(Date);
    expect(ffUpdates[0].data).not.toHaveProperty('releasedAt');
  });
});

// ===========================================================================
// 2. releaseConfirmed — the authoritative release
// ===========================================================================

describe('releaseConfirmed', () => {
  const report: StateReport = { ...BASE, releaseConfirmed: { description: VOICE } };

  it('REFUSED below rung 3 — releasedAt is never stamped', async () => {
    ffFindManyImpl.mockResolvedValue([{ id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` }]);
    await applyStateReportToProgress(USER, report);
    expect(ffUpdates).toHaveLength(0);
  });

  it('stamps releasedAt at rung 3', async () => {
    rpFindUniqueImpl.mockResolvedValue(progress(true));
    ffFindManyImpl.mockResolvedValue([{ id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` }]);
    await applyStateReportToProgress(USER, report);
    expect(ffUpdates).toHaveLength(1);
    expect(ffUpdates[0].data.releasedAt).toBeInstanceOf(Date);
  });
});

// ===========================================================================
// 3. identityAnchor
// ===========================================================================

describe('identityAnchor', () => {
  const report: StateReport = { ...BASE, identityAnchor: ANCHOR };

  it('REFUSED below rung 3 — no identity authority persisted', async () => {
    await applyStateReportToProgress(USER, report);
    const d = lastProgressWrite();
    expect(d).not.toHaveProperty('identityAnchorEncrypted');
    expect(d).not.toHaveProperty('identityAnchorSetAt');
  });

  it('persists at rung 3', async () => {
    rpFindUniqueImpl.mockResolvedValue(progress(true));
    await applyStateReportToProgress(USER, report);
    const d = lastProgressWrite();
    expect(d.identityAnchorEncrypted).toBe(`enc(${ANCHOR})`);
    expect(d.identityAnchorSetAt).toBeInstanceOf(Date);
  });

  it('the turn still completes and other fields still persist when refused', async () => {
    await applyStateReportToProgress(USER, {
      ...report,
      channel: 'visual',
      adultSelfQualities: 'the calm older me',
      continuityNote: 'she is testing whether I will push',
    });
    const d = lastProgressWrite();
    expect(d).not.toHaveProperty('identityAnchorEncrypted');
    expect(d.processingChannel).toBe('visual');
    expect(d.adultSelfQualitiesEncrypted).toBe('enc(the calm older me)');
    expect(d.continuityNoteEncrypted).toBeDefined();
    expect(d.lastActivityAt).toBeInstanceOf(Date);
  });
});

// ===========================================================================
// 4. PERMANENT EXEMPTIONS
// ===========================================================================

describe('exemptions — these must work at EVERY rung', () => {
  it('releaseInvalidated reopens the file at rung 1', async () => {
    ffFindManyImpl.mockResolvedValue([{ id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` }]);
    await applyStateReportToProgress(USER, {
      ...BASE,
      releaseInvalidated: { description: VOICE, reason: 'the voice is back' },
    });
    expect(ffUpdates).toHaveLength(1);
    expect(ffUpdates[0].data.releaseClaimedAt).toBeNull();
    expect(ffUpdates[0].data.releasedAt).toBeNull();
  });

  it('releaseInvalidated works at rung 3 too — nothing about it is rung-conditional', async () => {
    rpFindUniqueImpl.mockResolvedValue(progress(true));
    ffFindManyImpl.mockResolvedValue([{ id: 'ff1', userDescriptionEncrypted: `enc(${VOICE})` }]);
    await applyStateReportToProgress(USER, {
      ...BASE,
      releaseInvalidated: { description: VOICE },
    });
    expect(ffUpdates).toHaveLength(1);
    expect(ffUpdates[0].data.releasedAt).toBeNull();
  });

  it('AFTERCARE: deep practice still stamps lastDeepLayerContactAt at rung 1', async () => {
    // If unlicensed deep work happened, the 48/72h check-in must still fire.
    // Suppressing it would remove care from the session that most needs it.
    await applyStateReportToProgress(USER, {
      ...BASE,
      practiceRun: { kind: 'generated', name: 'inner room', status: 'completed', depth: 'deep' },
    });
    expect(lastProgressWrite().lastDeepLayerContactAt).toBeInstanceOf(Date);
  });

  it('AFTERCARE fires even on the same turn a Rung-3 capture is refused', async () => {
    await applyStateReportToProgress(USER, {
      ...BASE,
      identityAnchor: ANCHOR,
      practiceRun: { kind: 'generated', name: 'inner room', status: 'completed', depth: 'deep' },
    });
    const d = lastProgressWrite();
    expect(d).not.toHaveProperty('identityAnchorEncrypted'); // refused
    expect(d.lastDeepLayerContactAt).toBeInstanceOf(Date); // still recorded
  });

  it('practiceRun.depth is never used as a rung proxy in the guard', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync('lib/journey/middleLayer/rung3-persistence.ts', 'utf8')
      .replace(/\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/practiceRun/);
    expect(src).not.toMatch(/depth/);
    expect(src).not.toContain('releaseInvalidated');
    expect(src).not.toContain('lastDeepLayerContactAt');
  });
});

// ===========================================================================
// 5. Context-dependent fields are untouched
// ===========================================================================

describe('context-dependent fields persist unchanged at rung 1', () => {
  it('partsTouched still creates parts', async () => {
    await applyStateReportToProgress(USER, {
      ...BASE,
      partsTouched: [{ description: 'the ten-year-old with two braids', channel: 'visual' }],
    });
    expect(partCreates).toHaveLength(1);
  });

  it('foreignFilesTouched — identification is NOT release, and still persists', async () => {
    await applyStateReportToProgress(USER, {
      ...BASE,
      foreignFilesTouched: [{ description: VOICE }],
    });
    expect(ffCreates).toHaveLength(1);
  });

  it('the Personal Anchor is not gated — it is Stage-1 capture, not identity work', async () => {
    rpFindUniqueImpl.mockResolvedValue({ ...progress(false), anchorTextEncrypted: null });
    await applyStateReportToProgress(USER, { ...BASE, anchorIdentified: 'the trees outside my window' });
    expect(lastProgressWrite().anchorTextEncrypted).toBe('enc(the trees outside my window)');
  });
});

// ===========================================================================
// 6. Audit preservation, failure behaviour, scope
// ===========================================================================

describe('preservation and scope', () => {
  it('the report object is not mutated when a capture is refused', async () => {
    const report: StateReport = {
      ...BASE,
      identityAnchor: ANCHOR,
      foreignFileReleased: { description: VOICE },
      releaseConfirmed: { description: VOICE },
    };
    await applyStateReportToProgress(USER, report);
    // writeAuditTurn archives THIS object — it must survive untouched so the
    // claim stays auditable and PR 7' can still see it at the gates.
    expect(report.identityAnchor).toBe(ANCHOR);
    expect(report.foreignFileReleased).toEqual({ description: VOICE });
    expect(report.releaseConfirmed).toEqual({ description: VOICE });
  });

  it('LEGACY: a missing progress row does not throw and persists nothing', async () => {
    rpFindUniqueImpl.mockResolvedValue(null);
    await expect(
      applyStateReportToProgress(USER, { ...BASE, identityAnchor: ANCHOR }),
    ).resolves.not.toThrow();
    expect(rpUpdates).toHaveLength(0);
  });

  it('CORRUPT: unrecognised status values fail closed without losing the turn', async () => {
    rpFindUniqueImpl.mockResolvedValue({
      ...progress(false),
      middleLayerTargetStatus: 'sufficient',
      middleLayerMechanismStatus: 'ESTABLISHED',
    });
    await applyStateReportToProgress(USER, { ...BASE, identityAnchor: ANCHOR, channel: 'visual' });
    const d = lastProgressWrite();
    expect(d).not.toHaveProperty('identityAnchorEncrypted');
    expect(d.processingChannel).toBe('visual'); // turn survived
  });

  it('the refusal codes are a closed set naming exactly the three guarded paths', () => {
    expect(Object.values(RUNG3_PERSISTENCE_REFUSED).sort()).toEqual([
      'foreignFileReleased',
      'identityAnchor',
      'releaseConfirmed',
    ]);
  });

  it('SCOPE: PR 8′ did not touch the advancement guard', async () => {
    const { readFileSync } = await import('fs');
    const save = readFileSync('lib/journey/state/save.ts', 'utf8');
    // Persistence uses isRung3Licensed; advancement uses rung3SignalsLicensed
    // and lives in the router. They must not have merged.
    expect(save).not.toContain('rung3SignalsLicensed');
    expect(save).not.toContain('RUNG_3_MOVE_IDS');
    const guard = readFileSync('lib/journey/middleLayer/rung3-advancement.ts', 'utf8');
    expect(guard).not.toContain('isRung3Licensed');
  });
});
