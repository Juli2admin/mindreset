// Middle Layer PR 3 (2026-08-13) — Therapeutic Target + mechanism
// differential representation.
//
// Both structures live inside the EXISTING taskContractEncrypted blob, so
// the thing most at risk is the legacy contract that already lives there.
// These tests are weighted accordingly: the first and largest group proves
// the legacy shape is untouched, and the last group proves that storing
// Middle Layer data changes nothing the model ever sees.
//
// Nothing here asserts that a Target is sufficient, valid, or earned. No
// such judgement exists yet — PR 3 is representation only, and `status` /
// `level` are self-reported claims, not verdicts.

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

import {
  parseStateReport,
  parseTaskContract,
  parseTherapeuticTarget,
  parseMechanismDifferential,
} from './parse';
import { EPISTEMIC_LEVELS, TARGET_STATUSES } from './schema';
import type { TaskContract } from './schema';
import { mergeTaskContract } from '../state/save';
import { assembleSystemPromptBlocks } from '../prompts/assemble';
import { loadMasterJourneyPrompt } from '../prompts/load-spec';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import type { JourneyState } from '../state/types';

/** Mirrors the fixture in prompts/state-block.test.ts. */
function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_pr3_target_differential',
    currentStage: 1,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-15'),
    lastActivityAt: new Date('2026-06-23'),
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
    closureProcess: CLOSURE_PROCESS_NONE,
    workingMemory: null,
    ...overrides,
  };
}

const BASE = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

// The canonical worked example from MIDDLE_LAYER.md §4, used throughout so
// the fixtures are the approved case rather than invented material.
const TARGET = {
  phenomenon:
    'when someone pushes into her plans, her body objects immediately, she accommodates anyway, then attacks herself for the delay',
  inTheirTerms: 'I can never just say no in the moment',
  direction: 'to be able to decline in the moment',
  corroboration: ['the interview last week', 'the same thing with her sister in March'],
  provenance: 'user' as const,
  status: 'held' as const,
};

const LEGACY: TaskContract = {
  presentingRequest: 'I want to stop freezing when people ask me for things',
  expectedHelp: 'somewhere to think it through out loud',
  currentFocus: 'the interview last week',
  completionCriterion: 'being able to say no without the spiral afterwards',
};

beforeEach(() => {
  rpUpdates.length = 0;
  rpFindUniqueImpl.mockReset();
  rpFindUniqueImpl.mockResolvedValue({
    stage: 3,
    taskContractEncrypted: null,
    mii: {},
  });
});

// ---------------------------------------------------------------------------
// 1. LEGACY COMPATIBILITY — the thing most at risk
// ---------------------------------------------------------------------------

describe('legacy taskContract — unchanged by PR 3', () => {
  it('a legacy-only emission parses to exactly the legacy shape', () => {
    const parsed = parseTaskContract({ ...LEGACY });
    expect(parsed).toEqual(LEGACY);
    expect(parsed).not.toHaveProperty('target');
    expect(parsed).not.toHaveProperty('mechanismDifferential');
  });

  it('still drops generic placeholder values', () => {
    expect(
      parseTaskContract({
        presentingRequest: 'unclear',
        expectedHelp: 'n/a',
        currentFocus: 'tbd',
        completionCriterion: '...',
      }),
    ).toBeUndefined();
  });

  it('still enforces the 3-char floor and the 300-char cap', () => {
    const parsed = parseTaskContract({
      presentingRequest: 'ab',
      expectedHelp: 'x'.repeat(500),
    });
    expect(parsed).not.toHaveProperty('presentingRequest');
    expect(parsed?.expectedHelp).toHaveLength(300);
  });

  it('still returns undefined when nothing survives', () => {
    expect(parseTaskContract({})).toBeUndefined();
    expect(parseTaskContract(null)).toBeUndefined();
    expect(parseTaskContract([])).toBeUndefined();
    expect(parseTaskContract('a contract')).toBeUndefined();
  });

  it('CRITICAL: currentFocus and completionCriterion survive the compatibility layer', () => {
    // Straight through the parser...
    const parsed = parseTaskContract({ ...LEGACY });
    expect(parsed?.currentFocus).toBe(LEGACY.currentFocus);
    expect(parsed?.completionCriterion).toBe(LEGACY.completionCriterion);

    // ...and through a merge that also carries new-shape data.
    const merged = mergeTaskContract(LEGACY, {
      target: TARGET,
      mechanismDifferential: [{ reading: 'an introjected rule about never excluding anyone' }],
    });
    expect(merged?.currentFocus).toBe(LEGACY.currentFocus);
    expect(merged?.completionCriterion).toBe(LEGACY.completionCriterion);
    expect(merged?.presentingRequest).toBe(LEGACY.presentingRequest);
    expect(merged?.expectedHelp).toBe(LEGACY.expectedHelp);
  });

  it('a stored legacy contract merges exactly as before when the patch is legacy-only', () => {
    const merged = mergeTaskContract(LEGACY, { currentFocus: 'her sister, not the interview' });
    expect(merged).toEqual({ ...LEGACY, currentFocus: 'her sister, not the interview' });
  });

  it('no-clobber still holds: an absent field keeps its stored value', () => {
    const merged = mergeTaskContract(LEGACY, { presentingRequest: 'actually, the job thing' });
    expect(merged?.expectedHelp).toBe(LEGACY.expectedHelp);
    expect(merged?.currentFocus).toBe(LEGACY.currentFocus);
  });

  it('a legacy contract stored before PR 3 loads and re-saves without acquiring new keys', async () => {
    const { applyStateReportToProgress } = await import('../state/save');
    rpFindUniqueImpl.mockResolvedValue({
      stage: 3,
      taskContractEncrypted: `enc(${JSON.stringify(LEGACY)})`,
      mii: {},
    });
    await applyStateReportToProgress('user_pr3_legacy', {
      ...BASE,
      taskContract: { currentFocus: 'the spiral afterwards' },
    });
    const written = rpUpdates.find((u) => 'taskContractEncrypted' in u.data);
    const stored = JSON.parse(
      String(written?.data.taskContractEncrypted).replace(/^enc\((.*)\)$/, '$1'),
    );
    expect(Object.keys(stored).sort()).toEqual([
      'completionCriterion',
      'currentFocus',
      'expectedHelp',
      'presentingRequest',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Target — parse and round trip
// ---------------------------------------------------------------------------

describe('parseTherapeuticTarget', () => {
  it('round-trips the canonical §4 worked example intact', () => {
    expect(parseTherapeuticTarget({ ...TARGET })).toEqual(TARGET);
  });

  it('accepts a partial Target — mid-investigation is a normal state', () => {
    expect(parseTherapeuticTarget({ phenomenon: TARGET.phenomenon })).toEqual({
      phenomenon: TARGET.phenomenon,
    });
  });

  it('returns undefined for an object with no surviving part', () => {
    expect(parseTherapeuticTarget({})).toBeUndefined();
    expect(parseTherapeuticTarget({ phenomenon: 'ab', direction: 'n/a' })).toBeUndefined();
    expect(parseTherapeuticTarget(null)).toBeUndefined();
    expect(parseTherapeuticTarget(['a target'])).toBeUndefined();
  });

  it('applies the contract string rules to every text part', () => {
    const r = parseTherapeuticTarget({
      phenomenon: '  ' + TARGET.phenomenon + '  ',
      inTheirTerms: 'unknown',
      direction: 'x'.repeat(400),
    });
    expect(r?.phenomenon).toBe(TARGET.phenomenon);
    expect(r).not.toHaveProperty('inTheirTerms');
    expect(r?.direction).toHaveLength(300);
  });

  it('dedups corroboration but does NOT cap it', () => {
    const r = parseTherapeuticTarget({
      phenomenon: TARGET.phenomenon,
      corroboration: ['the interview', 'the interview', ...Array.from({ length: 20 }, (_, i) => `episode ${i}`)],
    });
    // 1 unique + 20 = 21. How many corroborating episodes a pattern has is a
    // clinical fact about the case; truncating it would discard evidence.
    expect(r?.corroboration).toHaveLength(21);
    expect(r?.corroboration?.[0]).toBe('the interview');
    expect(r?.corroboration?.at(-1)).toBe('episode 19');
  });

  it('drops a non-array corroboration rather than wrapping it', () => {
    const r = parseTherapeuticTarget({
      phenomenon: TARGET.phenomenon,
      corroboration: 'the interview last week',
    });
    expect(r).not.toHaveProperty('corroboration');
  });

  for (const status of TARGET_STATUSES) {
    it(`accepts status "${status}"`, () => {
      expect(parseTherapeuticTarget({ phenomenon: TARGET.phenomenon, status })?.status).toBe(status);
    });
  }

  it('leaves an invalid status ABSENT rather than defaulting', () => {
    for (const bad of ['sufficient', 'confirmed', 'Held', 'HELD', '', null, 1, true, ['held']]) {
      const r = parseTherapeuticTarget({ phenomenon: TARGET.phenomenon, status: bad });
      expect(r).toBeDefined();
      expect(r).not.toHaveProperty('status');
    }
  });

  it('validates provenance with PR 2\'s union and never coerces', () => {
    expect(parseTherapeuticTarget({ phenomenon: TARGET.phenomenon, provenance: 'elicited' })?.provenance).toBe('elicited');
    const r = parseTherapeuticTarget({ phenomenon: TARGET.phenomenon, provenance: 'unknown' });
    expect(r).not.toHaveProperty('provenance');
  });

  it('has no field for a mechanism — the cause stays out of the Target (§4.4)', () => {
    const r = parseTherapeuticTarget({
      phenomenon: TARGET.phenomenon,
      mechanism: 'an introjected rule',
      formulation: 'introject',
    });
    expect(r).not.toHaveProperty('mechanism');
    expect(r).not.toHaveProperty('formulation');
  });
});

// ---------------------------------------------------------------------------
// 3. Mechanism differential — parse and round trip
// ---------------------------------------------------------------------------

describe('parseMechanismDifferential', () => {
  // The five competing readings named in MIDDLE_LAYER.md §3b.
  const DIFFERENTIAL = [
    {
      reading: 'an introjected rule about never excluding anyone',
      supports: ['the phrasing is her mother\'s, not hers'],
      countsAgainst: ['it does not happen with her brother'],
      level: 'hypothesis' as const,
      provenance: 'clinician' as const,
    },
    { reading: 'a protective part managing rejection risk', level: 'hypothesis' as const },
    { reading: 'a learned relational adaptation', level: 'observation' as const },
    { reading: 'threat / freeze / fawn responding', level: 'observation' as const },
    { reading: 'a situational power response — she was a prospective employer', level: 'hypothesis' as const },
  ];

  it('round-trips the full §3b differential intact', () => {
    expect(parseMechanismDifferential(DIFFERENTIAL)).toEqual(DIFFERENTIAL);
  });

  it('holds an ordinary situational reading as a first-class member (§5.1)', () => {
    const r = parseMechanismDifferential(DIFFERENTIAL);
    expect(r?.map((c) => c.reading)).toContain(
      'a situational power response — she was a prospective employer',
    );
  });

  it('requires `reading` — an entry without one is dropped, siblings survive', () => {
    const r = parseMechanismDifferential([
      { supports: ['something'], level: 'hypothesis' },
      { reading: 'a protective part managing rejection risk' },
      { reading: 'ab' },
      { reading: 'unclear' },
    ]);
    expect(r).toEqual([{ reading: 'a protective part managing rejection risk' }]);
  });

  it('returns undefined for a non-array or an all-invalid array', () => {
    expect(parseMechanismDifferential(undefined)).toBeUndefined();
    expect(parseMechanismDifferential({ reading: 'x' })).toBeUndefined();
    expect(parseMechanismDifferential([])).toBeUndefined();
    expect(parseMechanismDifferential([null, 'a reading', 42])).toBeUndefined();
  });

  for (const level of EPISTEMIC_LEVELS) {
    it(`accepts level "${level}"`, () => {
      expect(parseMechanismDifferential([{ reading: 'a protective part', level }])?.[0].level).toBe(level);
    });
  }

  it('REJECTS level "therapeutic_target" — no mechanism may claim the Target rung', () => {
    const r = parseMechanismDifferential([
      { reading: 'an introjected rule', level: 'therapeutic_target' },
    ]);
    expect(r?.[0]).not.toHaveProperty('level');
    expect(r?.[0].reading).toBe('an introjected rule');
  });

  it('leaves an invalid level ABSENT rather than defaulting', () => {
    for (const bad of ['sufficient', 'confirmed', 'Hypothesis', '', null, 2, ['hypothesis']]) {
      const r = parseMechanismDifferential([{ reading: 'an introjected rule', level: bad }]);
      expect(r?.[0]).not.toHaveProperty('level');
    }
  });

  it('dedups by reading — last wins — but does NOT cap the candidate list', () => {
    const r = parseMechanismDifferential([
      { reading: 'an introjected rule', level: 'observation' },
      { reading: 'an introjected rule', level: 'hypothesis' },
      ...Array.from({ length: 20 }, (_, i) => ({ reading: `reading number ${i}` })),
    ]);
    // 1 unique + 20 = 21. Truncating a differential would misrepresent it as
    // narrower than it is — the opposite of what §1 asks the differential to do.
    expect(r).toHaveLength(21);
    expect(r?.[0]).toEqual({ reading: 'an introjected rule', level: 'hypothesis' });
    expect(r?.at(-1)).toEqual({ reading: 'reading number 19' });
  });

  it('does NOT cap supports or countsAgainst', () => {
    const r = parseMechanismDifferential([
      {
        reading: 'an introjected rule',
        supports: Array.from({ length: 20 }, (_, i) => `support ${i}`),
        countsAgainst: Array.from({ length: 20 }, (_, i) => `against ${i}`),
      },
    ]);
    expect(r?.[0].supports).toHaveLength(20);
    expect(r?.[0].countsAgainst).toHaveLength(20);
  });

  it('nothing accumulates across turns — a large differential is still bounded by one emission', () => {
    // The invariant that makes the absence of a cap safe: the differential is
    // replaced wholesale on merge, so a 21-candidate emission followed by a
    // 1-candidate emission stores ONE candidate, not 22.
    const big = Array.from({ length: 21 }, (_, i) => ({ reading: `reading number ${i}` }));
    const merged = mergeTaskContract(
      { ...LEGACY, mechanismDifferential: big },
      { mechanismDifferential: [{ reading: 'the one that survived' }] },
    );
    expect(merged?.mechanismDifferential).toHaveLength(1);
  });

  it('corroboration is likewise replaced wholesale, not appended', () => {
    const merged = mergeTaskContract(
      { ...LEGACY, target: { ...TARGET, corroboration: ['a', 'b', 'c'].map((s) => `episode ${s}`) } },
      { target: { corroboration: ['episode d'] } },
    );
    expect(merged?.target?.corroboration).toEqual(['episode d']);
    // ...while the other Target parts still merge field-wise.
    expect(merged?.target?.phenomenon).toBe(TARGET.phenomenon);
  });
});

// ---------------------------------------------------------------------------
// 4. Full report parse + merge semantics
// ---------------------------------------------------------------------------

describe('parseStateReport / mergeTaskContract — new shape', () => {
  it('carries Target and differential through a full report parse', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        taskContract: {
          ...LEGACY,
          target: TARGET,
          mechanismDifferential: [{ reading: 'an introjected rule about never excluding anyone' }],
        },
      }),
    );
    expect(r.taskContract?.presentingRequest).toBe(LEGACY.presentingRequest);
    expect(r.taskContract?.target).toEqual(TARGET);
    expect(r.taskContract?.mechanismDifferential).toHaveLength(1);
  });

  it('a target-only emission is NOT discarded for lacking legacy fields', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, taskContract: { target: { phenomenon: TARGET.phenomenon } } }),
    );
    expect(r.taskContract?.target?.phenomenon).toBe(TARGET.phenomenon);
    expect(r.taskContract).not.toHaveProperty('presentingRequest');
  });

  it('Target merges FIELD-WISE — a partial emission does not erase settled parts', () => {
    const stored: TaskContract = { ...LEGACY, target: { ...TARGET } };
    const merged = mergeTaskContract(stored, { target: { direction: 'to notice it sooner' } });
    expect(merged?.target?.direction).toBe('to notice it sooner');
    expect(merged?.target?.phenomenon).toBe(TARGET.phenomenon);
    expect(merged?.target?.inTheirTerms).toBe(TARGET.inTheirTerms);
    expect(merged?.target?.status).toBe('held');
  });

  it('an omitted Target preserves the stored one', () => {
    const stored: TaskContract = { ...LEGACY, target: { ...TARGET } };
    expect(mergeTaskContract(stored, { currentFocus: 'her sister' })?.target).toEqual(TARGET);
  });

  it('the differential REPLACES WHOLESALE — a candidate can be dropped (§1 demotion)', () => {
    const stored: TaskContract = {
      ...LEGACY,
      mechanismDifferential: [
        { reading: 'an introjected rule about never excluding anyone' },
        { reading: 'a protective part managing rejection risk' },
      ],
    };
    const merged = mergeTaskContract(stored, {
      mechanismDifferential: [{ reading: 'a protective part managing rejection risk' }],
    });
    expect(merged?.mechanismDifferential).toEqual([
      { reading: 'a protective part managing rejection risk' },
    ]);
    expect(merged?.mechanismDifferential?.map((c) => c.reading)).not.toContain(
      'an introjected rule about never excluding anyone',
    );
  });

  it('an omitted differential preserves the stored one', () => {
    const stored: TaskContract = {
      ...LEGACY,
      mechanismDifferential: [{ reading: 'an introjected rule about never excluding anyone' }],
    };
    expect(mergeTaskContract(stored, { currentFocus: 'her sister' })?.mechanismDifferential).toEqual(
      stored.mechanismDifferential,
    );
  });

  it('persists the new shape into the encrypted blob and round-trips it', async () => {
    const { applyStateReportToProgress } = await import('../state/save');
    rpFindUniqueImpl.mockResolvedValue({
      stage: 3,
      taskContractEncrypted: `enc(${JSON.stringify(LEGACY)})`,
      mii: {},
    });
    await applyStateReportToProgress('user_pr3_roundtrip', {
      ...BASE,
      taskContract: {
        target: TARGET,
        mechanismDifferential: [
          { reading: 'a situational power response', level: 'hypothesis', provenance: 'clinician' },
        ],
      },
    });
    const written = rpUpdates.find((u) => 'taskContractEncrypted' in u.data);
    const stored: TaskContract = JSON.parse(
      String(written?.data.taskContractEncrypted).replace(/^enc\((.*)\)$/, '$1'),
    );
    expect(stored.target).toEqual(TARGET);
    expect(stored.mechanismDifferential).toEqual([
      { reading: 'a situational power response', level: 'hypothesis', provenance: 'clinician' },
    ]);
    // ...and the legacy fields underneath are all still there.
    expect(stored.presentingRequest).toBe(LEGACY.presentingRequest);
    expect(stored.completionCriterion).toBe(LEGACY.completionCriterion);
  });
});

// ---------------------------------------------------------------------------
// 5. NOT AUTHORITATIVE — storing this changes nothing the model sees
// ---------------------------------------------------------------------------

describe('Target / differential are inert at runtime', () => {
  function render(taskContract: TaskContract | null): string {
    return assembleSystemPromptBlocks(makeState({ taskContract }))
      .map((b) => b.text)
      .join('\n');
  }

  it('a contract holding ONLY Middle Layer data renders as no contract at all', () => {
    const withNone = render(null);
    const withTargetOnly = render({
      target: TARGET,
      mechanismDifferential: [{ reading: 'an introjected rule about never excluding anyone' }],
    });

    // Byte-identical: the Target is stored, and the prompt cannot tell.
    expect(withTargetOnly).toBe(withNone);
    // Specifically, the "no contract yet" invitation is still shown...
    expect(withTargetOnly).toContain('No session task contract captured yet');
    // ...and THIS USER'S stored material did not leak into the prompt.
    //
    // PR 5 note: the canon now discusses mechanisms and names an
    // "introjected rule" as a worked example, so a bare substring grep for
    // that phrase no longer distinguishes canon from user data. The
    // byte-identical assertion above is the real proof and is unchanged —
    // it is strictly stronger than any grep. What still must never appear
    // is this user's own words.
    expect(withTargetOnly).not.toContain(TARGET.phenomenon);
    expect(withTargetOnly).not.toContain(TARGET.inTheirTerms);
  });

  it('a legacy contract renders identically whether or not a Target is attached', () => {
    const plain = render(LEGACY);
    const withTarget = render({
      ...LEGACY,
      target: TARGET,
      mechanismDifferential: [{ reading: 'an introjected rule about never excluding anyone' }],
    });

    expect(withTarget).toBe(plain);
    expect(withTarget).toContain(LEGACY.presentingRequest!);
    expect(withTarget).not.toContain(TARGET.phenomenon);
    expect(withTarget).not.toContain(TARGET.inTheirTerms);
  });

  it('PR 5: the master prompt NOW documents target and mechanismDifferential', () => {
    // Inverted deliberately. Through PRs 3-4b this asserted the fields were
    // absent from the prompt — that was the proof emission had not been
    // opened. PR 5 opens it, so the same assertion inverts rather than
    // being deleted: the representation must now be reachable.
    const master = loadMasterJourneyPrompt();
    expect(master).not.toBeNull();
    expect(master).toContain('mechanismDifferential');
    expect(master).toContain('recognitionOffered');
  });
});
