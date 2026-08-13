// Middle Layer PR 2 (2026-08-13) — JourneyPattern provenance.
//
// Provenance records WHERE a pattern claim came from: the user said it (U),
// the clinician offered it and the user confirmed/corrected it (E), or the
// clinician supplied it unconfirmed (C). Absent means UNKNOWN.
//
// This PR is representation only — nothing consumes provenance for gating.
// These tests therefore pin exactly two things:
//
//   1. round-trip fidelity for each of the three legal values, through the
//      parser and into the persistence layer;
//   2. that absence is preserved as absence — a legacy report with no
//      provenance, or an invalid value, must never be coerced into 'user'
//      (or into any other value), because unknown must earn no evidentiary
//      credit when PR 4's validator starts reading this field.

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Prisma must be mocked BEFORE importing save.ts — same pattern as
// release-semantics.test.ts. We capture journeyPattern create/update args so
// the persistence assertions can look at the exact `data` written.
const patternCreates: Array<{ data: Record<string, unknown> }> = [];
const patternUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
const patternFindUniqueImpl = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      findUnique: vi.fn(() =>
        Promise.resolve({ anchorTextEncrypted: null, mii: {} }),
      ),
      update: vi.fn(() => Promise.resolve({})),
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
      findUnique: (...args: unknown[]) => patternFindUniqueImpl(...args),
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        patternCreates.push(args);
        return Promise.resolve({});
      }),
      update: vi.fn((args: { where: unknown; data: Record<string, unknown> }) => {
        patternUpdates.push(args);
        return Promise.resolve({});
      }),
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

import { parseStateReport, parsePatternsTouched } from './parse';
import { PATTERN_PROVENANCES } from './schema';
import type { PatternProvenance } from './schema';
import { applyStateReportToProgress } from '../state/save';

const USER_ID = 'user_test_pattern_provenance';

const BASE = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

beforeEach(() => {
  patternCreates.length = 0;
  patternUpdates.length = 0;
  patternFindUniqueImpl.mockReset();
  patternFindUniqueImpl.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// 1. The value domain
// ---------------------------------------------------------------------------

describe('PATTERN_PROVENANCES', () => {
  it('is exactly user | elicited | clinician — no "unknown" member', () => {
    expect(PATTERN_PROVENANCES).toEqual(['user', 'elicited', 'clinician']);
    expect(PATTERN_PROVENANCES).not.toContain('unknown');
  });
});

// ---------------------------------------------------------------------------
// 2. Parser — round trip
// ---------------------------------------------------------------------------

describe('parsePatternsTouched — provenance round trip', () => {
  for (const p of PATTERN_PROVENANCES) {
    it(`preserves provenance "${p}" verbatim`, () => {
      expect(
        parsePatternsTouched([
          { category: 'mother_voice', description: 'you should have asked', provenance: p },
        ]),
      ).toEqual([
        { category: 'mother_voice', description: 'you should have asked', provenance: p },
      ]);
    });
  }

  it('keeps provenance alongside context', () => {
    expect(
      parsePatternsTouched([
        {
          category: 'inner_child_wound',
          description: 'the nine year old',
          context: { ageTag: 9 },
          provenance: 'elicited',
        },
      ]),
    ).toEqual([
      {
        category: 'inner_child_wound',
        description: 'the nine year old',
        context: { ageTag: 9 },
        provenance: 'elicited',
      },
    ]);
  });

  it('carries provenance per entry, not per report', () => {
    const r = parsePatternsTouched([
      { category: 'money_shame', description: 'money is not for me', provenance: 'user' },
      { category: 'body_shame', description: 'a shape I supplied', provenance: 'clinician' },
      { category: 'father_voice', description: 'no provenance given' },
    ]);
    expect(r?.[0].provenance).toBe('user');
    expect(r?.[1].provenance).toBe('clinician');
    expect(r?.[2].provenance).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Parser — absence and invalidity are preserved as absence
// ---------------------------------------------------------------------------

describe('parsePatternsTouched — unknown stays unknown', () => {
  it('LEGACY: an entry with no provenance parses fine and has no provenance key', () => {
    const r = parsePatternsTouched([
      { category: 'fear_of_visibility', description: 'I hide when people watch' },
    ]);
    expect(r).toHaveLength(1);
    expect(r?.[0]).not.toHaveProperty('provenance');
    expect(r?.[0].provenance).toBeUndefined();
  });

  it('never coerces an absent provenance to "user"', () => {
    const r = parsePatternsTouched([
      { category: 'fear_of_visibility', description: 'I hide' },
    ]);
    expect(r?.[0].provenance).not.toBe('user');
  });

  it('drops invalid values rather than guessing — the entry itself survives', () => {
    const bad: unknown[] = [
      'unknown',
      'User',
      'USER',
      'ELICITED',
      'self',
      'ai',
      'therapist',
      '',
      '  user  ',
      null,
      42,
      true,
      ['user'],
      { value: 'user' },
    ];
    for (const value of bad) {
      const r = parsePatternsTouched([
        { category: 'money_shame', description: 'money is not for me', provenance: value },
      ]);
      // The pattern is still recorded — a bad provenance must not cost us
      // the pattern note itself.
      expect(r).toHaveLength(1);
      expect(r?.[0].category).toBe('money_shame');
      // ...but the provenance is absent, not defaulted.
      expect(r?.[0]).not.toHaveProperty('provenance');
    }
  });

  it('dedup by category carries the later entry\'s provenance, including its absence', () => {
    const r = parsePatternsTouched([
      { category: 'mother_voice', description: 'first', provenance: 'clinician' },
      { category: 'mother_voice', description: 'second', provenance: 'user' },
    ]);
    expect(r).toEqual([
      { category: 'mother_voice', description: 'second', provenance: 'user' },
    ]);

    const r2 = parsePatternsTouched([
      { category: 'mother_voice', description: 'first', provenance: 'user' },
      { category: 'mother_voice', description: 'second' },
    ]);
    expect(r2).toEqual([{ category: 'mother_voice', description: 'second' }]);
    expect(r2?.[0]).not.toHaveProperty('provenance');
  });
});

// ---------------------------------------------------------------------------
// 4. Full state-report parse — backward compatibility
// ---------------------------------------------------------------------------

describe('parseStateReport — provenance', () => {
  it('BACKWARD COMPAT: a legacy report with no provenance anywhere parses unchanged', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        patternsTouched: [
          { category: 'fear_of_visibility', description: 'I hide' },
          { category: 'mother_voice', description: 'you should have asked' },
        ],
      }),
    );
    expect(r.patternsTouched).toEqual([
      { category: 'fear_of_visibility', description: 'I hide' },
      { category: 'mother_voice', description: 'you should have asked' },
    ]);
    expect(r.patternsTouched?.[0]).not.toHaveProperty('provenance');
    expect(r.patternsTouched?.[1]).not.toHaveProperty('provenance');
  });

  it('carries each provenance value through the full report parse', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        patternsTouched: PATTERN_PROVENANCES.map((p, i) => ({
          category: `pattern_${i}`,
          description: `described as ${p}`,
          provenance: p,
        })),
      }),
    );
    expect(r.patternsTouched?.map((e) => e.provenance)).toEqual([
      'user',
      'elicited',
      'clinician',
    ]);
  });

  it('a mixed report keeps valid provenance and leaves the invalid one absent', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        patternsTouched: [
          { category: 'money_shame', description: 'mine', provenance: 'user' },
          { category: 'body_shame', description: 'guessed', provenance: 'unknown' },
        ],
      }),
    );
    expect(r.patternsTouched?.[0].provenance).toBe('user');
    expect(r.patternsTouched?.[1]).not.toHaveProperty('provenance');
  });
});

// ---------------------------------------------------------------------------
// 5. Persistence
// ---------------------------------------------------------------------------

describe('applyStateReportToProgress — JourneyPattern provenance persistence', () => {
  for (const p of PATTERN_PROVENANCES) {
    it(`writes provenance "${p}" on a new pattern row`, async () => {
      await applyStateReportToProgress(USER_ID, {
        ...BASE,
        patternsTouched: [
          { category: 'mother_voice', description: 'you should have asked', provenance: p },
        ],
      });
      expect(patternCreates).toHaveLength(1);
      expect(patternCreates[0].data.provenance).toBe(p);
    });

    it(`writes provenance "${p}" on an existing pattern row`, async () => {
      patternFindUniqueImpl.mockResolvedValue({ id: 'jp1', context: null });
      await applyStateReportToProgress(USER_ID, {
        ...BASE,
        patternsTouched: [
          { category: 'mother_voice', description: 'deeper this time', provenance: p },
        ],
      });
      expect(patternUpdates).toHaveLength(1);
      expect(patternUpdates[0].where).toEqual({ id: 'jp1' });
      expect(patternUpdates[0].data.provenance).toBe(p);
    });
  }

  it('LEGACY: a pattern with no provenance creates a row with NO provenance key (column stays NULL)', async () => {
    await applyStateReportToProgress(USER_ID, {
      ...BASE,
      patternsTouched: [
        { category: 'fear_of_visibility', description: 'I hide when people watch' },
      ],
    });
    expect(patternCreates).toHaveLength(1);
    expect(patternCreates[0].data).not.toHaveProperty('provenance');
    // Explicitly: absence is never turned into a positive claim.
    expect(patternCreates[0].data.provenance).not.toBe('user');
  });

  it('OMISSION: an update with no provenance leaves the stored value untouched', async () => {
    // Mirrors the file's existing convention for `context` — an omitted
    // field is not written, so a previously recorded provenance survives.
    patternFindUniqueImpl.mockResolvedValue({ id: 'jp1', context: null });
    await applyStateReportToProgress(USER_ID, {
      ...BASE,
      patternsTouched: [{ category: 'mother_voice', description: 'said again' }],
    });
    expect(patternUpdates).toHaveLength(1);
    expect(patternUpdates[0].data).not.toHaveProperty('provenance');
  });

  it('LAST WRITE WINS: a supplied provenance overwrites on update', async () => {
    patternFindUniqueImpl.mockResolvedValue({ id: 'jp1', context: null });
    await applyStateReportToProgress(USER_ID, {
      ...BASE,
      patternsTouched: [
        { category: 'mother_voice', description: 'the user owned it', provenance: 'user' },
      ],
    });
    expect(patternUpdates[0].data.provenance).toBe('user');
  });

  it('persists provenance and merged context together', async () => {
    patternFindUniqueImpl.mockResolvedValue({
      id: 'jp1',
      context: { channel: 'visual' },
    });
    await applyStateReportToProgress(USER_ID, {
      ...BASE,
      patternsTouched: [
        {
          category: 'inner_child_wound',
          description: 'the nine year old',
          context: { ageTag: 9 },
          provenance: 'elicited',
        },
      ],
    });
    expect(patternUpdates).toHaveLength(1);
    expect(patternUpdates[0].data.context).toEqual({ channel: 'visual', ageTag: 9 });
    expect(patternUpdates[0].data.provenance).toBe('elicited');
  });

  it('persists per-entry provenance across a multi-pattern turn', async () => {
    const report = {
      ...BASE,
      patternsTouched: [
        { category: 'money_shame', description: 'mine', provenance: 'user' as PatternProvenance },
        { category: 'body_shame', description: 'offered', provenance: 'clinician' as PatternProvenance },
        { category: 'father_voice', description: 'no provenance' },
      ],
    };
    await applyStateReportToProgress(USER_ID, report);
    expect(patternCreates).toHaveLength(3);
    expect(patternCreates[0].data.provenance).toBe('user');
    expect(patternCreates[1].data.provenance).toBe('clinician');
    expect(patternCreates[2].data).not.toHaveProperty('provenance');
  });
});
