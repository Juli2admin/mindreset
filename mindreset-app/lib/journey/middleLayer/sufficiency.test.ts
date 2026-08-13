// Middle Layer PR 4 (2026-08-13) — sufficiency validation + rung derivation,
// SHADOW MODE.
//
// Two things are under test, and the second matters as much as the first:
//
//   1. The promotion rules are exactly the approved ones — §3a/§4 for the
//      Target, §1's four conditions for the mechanism — and where the
//      evidence cannot decide a condition, the validator refuses rather
//      than guessing.
//   2. Running it changes NOTHING a user could perceive: the assembled
//      prompt is byte-identical, and the only new writes are the two
//      server-owned status columns.

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
    journeyPart: { findMany: vi.fn(() => Promise.resolve([])), create: vi.fn(), update: vi.fn() },
    journeyForeignFile: { findMany: vi.fn(() => Promise.resolve([])), create: vi.fn(), update: vi.fn() },
    journeyPattern: { findUnique: vi.fn(() => Promise.resolve(null)), create: vi.fn(), update: vi.fn() },
    journeySignatureImage: { findMany: vi.fn(() => Promise.resolve([])), create: vi.fn() },
  },
}));

vi.mock('@/lib/encrypt', () => ({
  encrypt: (s: string) => `enc(${s})`,
  decrypt: (s: string) => s.replace(/^enc\((.*)\)$/, '$1'),
}));

import {
  validateTargetSufficiency,
  validateMechanismSufficiency,
  deriveLicensedRung,
  evaluateSufficiency,
  SUFFICIENCY_REASONS,
  TARGET_VALIDATED_STATUSES,
  MECHANISM_VALIDATED_STATUSES,
} from './sufficiency';
import { buildSufficiencyShadowLine } from './shadow-log';
import type { TherapeuticTarget, MechanismCandidate, TaskContract } from '../stateReport/schema';
import { PATTERN_PROVENANCES } from '../stateReport/schema';
import { applyStateReportToProgress } from '../state/save';
import { assembleSystemPromptBlocks } from '../prompts/assemble';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import type { JourneyState } from '../state/types';

const R = SUFFICIENCY_REASONS;

/** The canonical §4 worked example, fully established. */
const FULL_TARGET: TherapeuticTarget = {
  phenomenon:
    'when someone pushes into her plans, her body objects immediately, she accommodates anyway, then attacks herself for the delay',
  inTheirTerms: 'I can never just say no in the moment',
  direction: 'to be able to decline in the moment',
  corroboration: ['the interview last week', 'the same thing with her sister in March'],
  provenance: 'user',
  status: 'held',
};

const LEGACY: TaskContract = {
  presentingRequest: 'I want to stop freezing when people ask me for things',
  expectedHelp: 'somewhere to think it through out loud',
  currentFocus: 'the interview last week',
  completionCriterion: 'being able to say no without the spiral afterwards',
};

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_pr4', currentStage: 1, currentDepth: 'surface',
    startedAt: new Date('2026-06-15'), lastActivityAt: new Date('2026-06-23'),
    dischargedAt: null, anchorText: null, anchorSetAt: null, identityAnchor: null,
    identityAnchorSetAt: null, processingChannel: null, adultSelfQualities: null,
    lastIntensity: null, lastIntensityAt: null, lastDeepLayerContactAt: null, mii: {},
    stage8WeeksElapsed: 0, frozenForReview: false, frozenAt: null, frozenReason: null,
    continuityNote: null, parts: [], foreignFiles: [], signatureImages: [], patterns: [],
    sessionCount: 1, daysEngaged: 1, thisSessionMessageCount: 0, stageJustAdvanced: false,
    hoursSinceLastTurn: null, isSessionResume: false, hasOpenCycle: false,
    openCycleDescription: null, sessionRejectedModalities: [], recentChannelShift: false,
    taskContract: null, onboardingAnswers: null, closureProcess: CLOSURE_PROCESS_NONE,
    workingMemory: null, ...overrides,
  };
}

beforeEach(() => {
  rpUpdates.length = 0;
  rpFindUniqueImpl.mockReset();
  rpFindUniqueImpl.mockResolvedValue({
    anchorTextEncrypted: null, mii: {}, taskContractEncrypted: null,
    currentDepth: 'surface', closureProcessState: 'NONE',
  });
});

// ---------------------------------------------------------------------------
// 1. TARGET PROMOTION MATRIX (§3a — the four parts of §4)
// ---------------------------------------------------------------------------

describe('validateTargetSufficiency — full promotion matrix', () => {
  it('establishes the canonical §4 example', () => {
    const v = validateTargetSufficiency(FULL_TARGET);
    expect(v.status).toBe('established');
    expect(v.established).toBe(true);
    expect(v.reasons).toContain(R.TARGET_ESTABLISHED);
  });

  it('ALWAYS records that independence was not code-verified, even when established', () => {
    // The count was met; §1's actual standard is that the sources be
    // genuinely independent, and no code can check that. The residual must
    // never be dropped, or the log starts overstating what was proved.
    expect(validateTargetSufficiency(FULL_TARGET).reasons).toContain(
      R.TARGET_INDEPENDENCE_NOT_CODE_VERIFIABLE,
    );
  });

  it('no Target at all → none / TARGET_ABSENT', () => {
    for (const empty of [undefined, null]) {
      const v = validateTargetSufficiency(empty);
      expect(v.status).toBe('none');
      expect(v.established).toBe(false);
      expect(v.reasons).toEqual([R.TARGET_ABSENT]);
    }
  });

  // Each §4 part, removed one at a time.
  const PART_CASES: Array<[keyof TherapeuticTarget, string]> = [
    ['phenomenon', R.TARGET_PHENOMENON_MISSING],
    ['inTheirTerms', R.TARGET_IN_THEIR_TERMS_MISSING],
    ['direction', R.TARGET_DIRECTION_MISSING],
  ];
  for (const [part, reason] of PART_CASES) {
    it(`missing §4 part "${part}" → proposed, ${reason}`, () => {
      const t = { ...FULL_TARGET };
      delete t[part];
      const v = validateTargetSufficiency(t);
      expect(v.status).toBe('proposed');
      expect(v.established).toBe(false);
      expect(v.reasons).toContain(reason);
    });
  }

  it('§4.4 — one corroborating source is NOT enough, however striking', () => {
    const v = validateTargetSufficiency({ ...FULL_TARGET, corroboration: ['the interview'] });
    expect(v.established).toBe(false);
    expect(v.reasons).toContain(R.TARGET_CORROBORATION_INSUFFICIENT);
  });

  it('§4.4 — no corroboration at all is not enough', () => {
    const t = { ...FULL_TARGET };
    delete t.corroboration;
    expect(validateTargetSufficiency(t).reasons).toContain(R.TARGET_CORROBORATION_INSUFFICIENT);
  });

  it('§4.4 — two sources meet the count', () => {
    expect(validateTargetSufficiency(FULL_TARGET).parts.corroborationCount).toBe(2);
  });

  it('reports every failing condition at once, not just the first', () => {
    const v = validateTargetSufficiency({ phenomenon: 'something happens sometimes' });
    expect(v.reasons).toEqual(
      expect.arrayContaining([
        R.TARGET_IN_THEIR_TERMS_MISSING,
        R.TARGET_DIRECTION_MISSING,
        R.TARGET_CORROBORATION_INSUFFICIENT,
        R.TARGET_PROVENANCE_UNKNOWN,
      ]),
    );
  });

  it("the model's self-reported status never substitutes for validation", () => {
    // status:'held' is a claim. An incomplete Target claiming 'held' is
    // still refused — this is the self-report ratchet the repair exists to break.
    const v = validateTargetSufficiency({ phenomenon: 'x'.repeat(20), status: 'held' });
    expect(v.status).toBe('proposed');
    expect(v.established).toBe(false);
  });

  it("and a complete Target is established even when self-reported 'proposed'", () => {
    expect(validateTargetSufficiency({ ...FULL_TARGET, status: 'proposed' }).established).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. PROVENANCE — §1(4). The one fully enforceable condition.
// ---------------------------------------------------------------------------

describe('provenance earns credit only as §1(4) allows', () => {
  it('NULL/absent provenance earns NO credit — a complete Target is still refused', () => {
    const t = { ...FULL_TARGET };
    delete t.provenance;
    const v = validateTargetSufficiency(t);
    expect(v.established).toBe(false);
    expect(v.reasons).toContain(R.TARGET_PROVENANCE_UNKNOWN);
  });

  it('clinician provenance ALONE cannot establish a Target', () => {
    const v = validateTargetSufficiency({ ...FULL_TARGET, provenance: 'clinician' });
    expect(v.established).toBe(false);
    expect(v.status).toBe('proposed');
    expect(v.reasons).toContain(R.TARGET_PROVENANCE_CLINICIAN_ONLY);
  });

  it('user and elicited both carry weight; clinician and absent do not', () => {
    const outcomes = PATTERN_PROVENANCES.map((p) => [
      p,
      validateTargetSufficiency({ ...FULL_TARGET, provenance: p }).established,
    ]);
    expect(outcomes).toEqual([['user', true], ['elicited', true], ['clinician', false]]);
    const t = { ...FULL_TARGET };
    delete t.provenance;
    expect(validateTargetSufficiency(t).established).toBe(false);
  });

  it('clinician provenance ALONE cannot make a mechanism §1(4)-clean', () => {
    const v = validateMechanismSufficiency([
      { reading: 'an introjected rule', level: 'working_formulation', provenance: 'clinician' },
    ]);
    expect(v.reasons).toContain(R.MECHANISM_PROVENANCE_CLINICIAN_ONLY);
    expect(v.reasons).not.toContain(R.MECHANISM_PROVENANCE_OK);
  });

  it('absent mechanism provenance is reported as unknown, never as credit', () => {
    const v = validateMechanismSufficiency([
      { reading: 'an introjected rule', level: 'working_formulation' },
    ]);
    expect(v.reasons).toContain(R.MECHANISM_PROVENANCE_UNKNOWN);
  });
});

// ---------------------------------------------------------------------------
// 3. MECHANISM PROMOTION MATRIX (§3b — §1's four conditions)
// ---------------------------------------------------------------------------

describe('validateMechanismSufficiency — full promotion matrix', () => {
  const LEADING: MechanismCandidate = {
    reading: 'an introjected rule about never excluding anyone',
    supports: ['the phrasing is her mother\'s', 'it predates the job'],
    countsAgainst: [],
    level: 'working_formulation',
    provenance: 'elicited',
  };

  it('no differential → none, fail-closed', () => {
    for (const empty of [undefined, null, []]) {
      const v = validateMechanismSufficiency(empty);
      expect(v.status).toBe('none');
      expect(v.established).toBe(false);
      expect(v.reasons).toContain(R.MECHANISM_DIFFERENTIAL_ABSENT);
      expect(v.reasons).toContain(R.MECHANISM_FAIL_CLOSED);
    }
  });

  it('candidates with none leading → candidate', () => {
    const v = validateMechanismSufficiency([
      { reading: 'an introjected rule', level: 'hypothesis' },
      { reading: 'a protective part', level: 'observation' },
    ]);
    expect(v.status).toBe('candidate');
    expect(v.candidateCount).toBe(2);
    expect(v.leadingCount).toBe(0);
    expect(v.reasons).toContain(R.MECHANISM_NONE_LEADING);
  });

  it("a self-reported working_formulation is recorded as 'leading', NOT established", () => {
    const v = validateMechanismSufficiency([LEADING]);
    expect(v.status).toBe('leading');
    expect(v.established).toBe(false);
    expect(v.leadingCount).toBe(1);
  });

  it('CRITICAL: mechanism sufficiency is NEVER met — fails closed in every case', () => {
    const cases: MechanismCandidate[][] = [
      [LEADING],
      [LEADING, { reading: 'a protective part', level: 'observation' }],
      [{ ...LEADING, provenance: 'user' }],
      [{ ...LEADING, supports: Array.from({ length: 20 }, (_, i) => `support ${i}`) }],
      [{ ...LEADING, countsAgainst: [] }],
    ];
    for (const differential of cases) {
      const v = validateMechanismSufficiency(differential);
      expect(v.established).toBe(false);
      expect(v.status).not.toBe('established');
      expect(v.reasons).toContain(R.MECHANISM_FAIL_CLOSED);
    }
  });

  it('names all three undecidable §1 conditions whenever a differential exists', () => {
    const v = validateMechanismSufficiency([LEADING]);
    expect(v.undecidable).toEqual([
      R.MECHANISM_COMPARATIVE_SUPPORT_NOT_DERIVABLE,
      R.MECHANISM_CORRECTION_SURVIVAL_NOT_DERIVABLE,
      R.MECHANISM_INDEPENDENT_CORROBORATION_NOT_REPRESENTED,
    ]);
  });

  it('§1(4) is still reported separately, so "refused" is distinguishable from "failed"', () => {
    // Clean provenance: refused only because the other conditions are undecidable.
    expect(validateMechanismSufficiency([LEADING]).reasons).toContain(R.MECHANISM_PROVENANCE_OK);
    // Dirty provenance: an actual rule failure, on top of the undecidables.
    expect(
      validateMechanismSufficiency([{ ...LEADING, provenance: 'clinician' }]).reasons,
    ).toContain(R.MECHANISM_PROVENANCE_CLINICIAN_ONLY);
  });

  it('more supports never buys promotion — verbosity is not evidence', () => {
    const thin = validateMechanismSufficiency([{ ...LEADING, supports: ['one thing'] }]);
    const fat = validateMechanismSufficiency([
      { ...LEADING, supports: Array.from({ length: 50 }, (_, i) => `support ${i}`) },
    ]);
    expect(thin.established).toBe(fat.established);
    expect(thin.status).toBe(fat.status);
  });
});

// ---------------------------------------------------------------------------
// 4. DEMOTION / CONTRADICTION, where representable
// ---------------------------------------------------------------------------

describe('demotion is real work (§1)', () => {
  it('losing a corroborating source demotes established → proposed', () => {
    expect(validateTargetSufficiency(FULL_TARGET).status).toBe('established');
    // corroboration is replaced wholesale on merge, so it CAN shrink.
    expect(
      validateTargetSufficiency({ ...FULL_TARGET, corroboration: ['the interview last week'] }).status,
    ).toBe('proposed');
  });

  it('provenance downgraded to clinician demotes established → proposed', () => {
    expect(
      validateTargetSufficiency({ ...FULL_TARGET, provenance: 'clinician' }).status,
    ).toBe('proposed');
  });

  it('demotion pulls the licensed rung back down with it', () => {
    expect(evaluateSufficiency({ target: FULL_TARGET }).licensedRung).toBe(2);
    expect(
      evaluateSufficiency({ target: { ...FULL_TARGET, provenance: 'clinician' } }).licensedRung,
    ).toBe(1);
  });

  it('dropping the leading candidate demotes leading → candidate', () => {
    const before = validateMechanismSufficiency([
      { reading: 'an introjected rule', level: 'working_formulation', provenance: 'user' },
      { reading: 'a protective part', level: 'hypothesis' },
    ]);
    expect(before.status).toBe('leading');
    const after = validateMechanismSufficiency([{ reading: 'a protective part', level: 'hypothesis' }]);
    expect(after.status).toBe('candidate');
  });
});

// ---------------------------------------------------------------------------
// 5. RUNG DERIVATION MATRIX (§6)
// ---------------------------------------------------------------------------

describe('deriveLicensedRung — full matrix', () => {
  it('covers all four combinations', () => {
    expect(deriveLicensedRung(false, false)).toBe(1);
    expect(deriveLicensedRung(true, false)).toBe(2);
    expect(deriveLicensedRung(true, true)).toBe(3);
    // Mechanism without Target: §6 opens Rung 3 on mechanism sufficiency
    // alone. Not reachable in practice, and not reachable at all today.
    expect(deriveLicensedRung(false, true)).toBe(3);
  });

  it('Rung 1 when there is no established Target', () => {
    expect(evaluateSufficiency({ target: { phenomenon: 'something recurring happens' } }).licensedRung).toBe(1);
  });

  it('Rung 2 when the Target is established and no mechanism is', () => {
    const v = evaluateSufficiency({
      ...LEGACY,
      target: FULL_TARGET,
      mechanismDifferential: [
        { reading: 'an introjected rule', level: 'working_formulation', provenance: 'user' },
      ],
    });
    expect(v.target.status).toBe('established');
    expect(v.mechanism.status).toBe('leading');
    expect(v.licensedRung).toBe(2);
  });

  it('Rung 3 is UNREACHABLE from real data — a fully-argued differential still yields 2', () => {
    const v = evaluateSufficiency({
      target: FULL_TARGET,
      mechanismDifferential: [
        {
          reading: 'an introjected rule about never excluding anyone',
          supports: ['her mother\'s phrasing', 'predates the job', 'holds with her sister'],
          countsAgainst: [],
          level: 'working_formulation',
          provenance: 'user',
        },
      ],
    });
    expect(v.licensedRung).toBe(2);
    expect(v.mechanism.established).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. LEGACY USERS
// ---------------------------------------------------------------------------

describe('legacy users derive Rung 1 safely', () => {
  it('no contract at all → Rung 1', () => {
    for (const empty of [undefined, null]) {
      const v = evaluateSufficiency(empty);
      expect(v.licensedRung).toBe(1);
      expect(v.target.status).toBe('none');
      expect(v.mechanism.status).toBe('none');
    }
  });

  it('a pre-PR-3 legacy contract → Rung 1, and nothing throws', () => {
    const v = evaluateSufficiency(LEGACY);
    expect(v.licensedRung).toBe(1);
    expect(v.target.reasons).toEqual([R.TARGET_ABSENT]);
  });

  it('Rung 1 is not a penalty — §6 makes it unconditionally available', () => {
    // The point of the assertion: a legacy user loses NOTHING. Rung 1 work
    // (reflection, grounding, staying with a feeling) is always open.
    expect(evaluateSufficiency(LEGACY).licensedRung).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. SHADOW LOG SHAPE + PRIVACY
// ---------------------------------------------------------------------------

describe('shadow log', () => {
  const verdict = evaluateSufficiency({
    ...LEGACY,
    target: FULL_TARGET,
    mechanismDifferential: [
      { reading: 'an introjected rule about never excluding anyone', level: 'working_formulation', provenance: 'user' },
      { reading: 'a situational power response', level: 'hypothesis' },
    ],
  });

  it('distinguishes target status, mechanism status, rung, reasons and missing evidence', () => {
    const line = buildSufficiencyShadowLine('user_abc', verdict);
    expect(line.target).toBe('established');
    expect(line.mechanism).toBe('leading');
    expect(line.rung).toBe(2);
    expect(line.targetReasons).toContain(R.TARGET_ESTABLISHED);
    expect(line.mechanismReasons).toContain(R.MECHANISM_FAIL_CLOSED);
    expect(line.missingEvidence).toHaveLength(3);
    expect(line.counts).toEqual({ targetPartsPresent: 3, corroboration: 2, candidates: 2, leading: 1 });
  });

  it('PRIVACY: carries no user content or clinical free text', () => {
    const serialised = JSON.stringify(buildSufficiencyShadowLine('user_abc', verdict));
    expect(serialised).not.toContain(FULL_TARGET.phenomenon!);
    expect(serialised).not.toContain(FULL_TARGET.inTheirTerms!);
    expect(serialised).not.toContain('introjected rule');
    expect(serialised).not.toContain('situational power');
    expect(serialised).not.toContain(LEGACY.presentingRequest!);
  });

  it('every emitted code belongs to the closed reason set', () => {
    const known = new Set<string>(Object.values(SUFFICIENCY_REASONS));
    const line = buildSufficiencyShadowLine('user_abc', verdict);
    for (const code of [...line.targetReasons, ...line.mechanismReasons, ...line.missingEvidence]) {
      expect(known.has(code)).toBe(true);
    }
    expect(TARGET_VALIDATED_STATUSES).toContain(line.target);
    expect(MECHANISM_VALIDATED_STATUSES).toContain(line.mechanism);
  });
});

// ---------------------------------------------------------------------------
// 8. NO USER-VISIBLE BEHAVIOUR CHANGE
// ---------------------------------------------------------------------------

describe('shadow mode changes nothing a user could perceive', () => {
  it('the assembled prompt is byte-identical with a fully established Target', () => {
    const plain = assembleSystemPromptBlocks(makeState({ taskContract: LEGACY }))
      .map((b) => b.text).join('\n');
    const withEverything = assembleSystemPromptBlocks(
      makeState({
        taskContract: {
          ...LEGACY,
          target: FULL_TARGET,
          mechanismDifferential: [
            { reading: 'an introjected rule', level: 'working_formulation', provenance: 'user' },
          ],
        },
      }),
    ).map((b) => b.text).join('\n');

    expect(withEverything).toBe(plain);
    expect(withEverything).not.toMatch(/rung/i);
    expect(withEverything).not.toMatch(/sufficiency/i);
    expect(withEverything).not.toContain(FULL_TARGET.phenomenon!);
  });

  it('persists BOTH status columns and nothing else new', async () => {
    rpFindUniqueImpl.mockResolvedValue({
      anchorTextEncrypted: null, mii: {},
      taskContractEncrypted: `enc(${JSON.stringify({ ...LEGACY, target: FULL_TARGET })})`,
      currentDepth: 'surface', closureProcessState: 'NONE',
    });
    await applyStateReportToProgress('user_pr4_persist', {
      intensity: 4, safetyFlag: 'none', recommendedAction: 'stay',
      taskContract: { currentFocus: 'the spiral afterwards' },
    });
    const written = rpUpdates.find((u) => 'middleLayerTargetStatus' in u.data);
    expect(written?.data.middleLayerTargetStatus).toBe('established');
    expect(written?.data.middleLayerMechanismStatus).toBe('none');
    // No rung column — the rung is derived, never stored.
    expect(written?.data).not.toHaveProperty('middleLayerLicensedRung');
    // And the shadow path did not touch any behavioural field.
    for (const forbidden of ['currentStage', 'currentDepth', 'closureProcessState', 'closureRoute']) {
      expect(written?.data).not.toHaveProperty(forbidden);
    }
  });

  it('a legacy user persists none/none — no crash, no Target invented', async () => {
    await applyStateReportToProgress('user_pr4_legacy', {
      intensity: 4, safetyFlag: 'none', recommendedAction: 'stay',
      taskContract: { currentFocus: 'the interview' },
    });
    const written = rpUpdates.find((u) => 'middleLayerTargetStatus' in u.data);
    expect(written?.data.middleLayerTargetStatus).toBe('none');
    expect(written?.data.middleLayerMechanismStatus).toBe('none');
  });

  it('a state save still succeeds when the stored contract is corrupt', async () => {
    // The shadow path must never cost a user their turn.
    rpFindUniqueImpl.mockResolvedValue({
      anchorTextEncrypted: null, mii: {},
      taskContractEncrypted: 'enc(not valid json {{{)',
      currentDepth: 'surface', closureProcessState: 'NONE',
    });
    await expect(
      applyStateReportToProgress('user_pr4_corrupt', {
        intensity: 4, safetyFlag: 'none', recommendedAction: 'stay',
      }),
    ).resolves.not.toThrow();
    expect(rpUpdates.length).toBeGreaterThan(0);
  });
});
