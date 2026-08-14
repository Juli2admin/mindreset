// Middle Layer PR 4 + PR 4b (2026-08-13) — sufficiency validation, evidence
// exchanges, and rung derivation. SHADOW MODE.
//
// Three things are under test, and the third matters as much as the first:
//
//   1. The promotion rules are exactly the approved ones — §3a/§4 for the
//      Target, §1's four conditions for the mechanism — evaluated against
//      CODE-OWNED evidence rather than model self-report.
//   2. Rung 3 is now genuinely reachable through evidence, and unreachable
//      by assertion.
//   3. Running any of it changes NOTHING a user could perceive.
//
// PR 4b note: this file replaces PR 4's fixtures. PR 4 established Targets on
// `corroboration: ['a','b'] + provenance:'user'`; owner decisions 2 and 3
// require user-confirmed recognition and user-confirmed instances, so those
// fixtures no longer establish and are rewritten here rather than relaxed.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
const rpFindUniqueImpl = vi.fn();
const evidenceRows: Array<Record<string, unknown>> = [];
let evidenceId = 0;

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      findUnique: (...args: unknown[]) => rpFindUniqueImpl(...args),
      update: vi.fn((args: { where: unknown; data: Record<string, unknown> }) => {
        rpUpdates.push(args);
        return Promise.resolve({});
      }),
    },
    journeyEvidenceExchange: {
      findMany: vi.fn((args?: { where?: Record<string, unknown> }) => {
        const w = args?.where ?? {};
        return Promise.resolve(
          evidenceRows.filter((r) => {
            if (w.kind && r.kind !== w.kind) return false;
            if (w.offeredAt && r.offeredAt === null) return false;
            if (w.confirmedAt === null && r.confirmedAt !== null) return false;
            if (w.contradictedAt === null && r.contradictedAt !== null) return false;
            return true;
          }),
        );
      }),
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        const row = {
          id: `ev${++evidenceId}`,
          offeredAt: null,
          confirmedAt: null,
          contradictedAt: null,
          ...args.data,
        };
        evidenceRows.push(row);
        return Promise.resolve(row);
      }),
      update: vi.fn((args: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = evidenceRows.find((r) => r.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return Promise.resolve(row ?? {});
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
import type { EvidenceSet, EvidenceKind } from './evidence';
import { EMPTY_EVIDENCE, applyEvidenceExchanges, loadEvidence } from './evidence';
import { buildSufficiencyShadowLine } from './shadow-log';
import type { TherapeuticTarget, MechanismCandidate, TaskContract } from '../stateReport/schema';
import { PATTERN_PROVENANCES } from '../stateReport/schema';
import { parseStateReport } from '../stateReport/parse';
import { applyStateReportToProgress } from '../state/save';
import { assembleSystemPromptBlocks } from '../prompts/assemble';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import type { JourneyState } from '../state/types';
import { MIDDLE_LAYER_STATE_NONE } from '../middleLayer/sufficiency';

const R = SUFFICIENCY_REASONS;

const T0 = new Date('2026-08-01T10:00:00Z');
const T1 = new Date('2026-08-02T10:00:00Z');
const T2 = new Date('2026-08-03T10:00:00Z');
const T3 = new Date('2026-08-04T10:00:00Z');

/** Terse evidence-set builder. Times are explicit so ordering is visible. */
function ev(
  ...rows: Array<{
    kind: EvidenceKind;
    subject: string;
    offeredAt?: Date | null;
    confirmedAt?: Date | null;
    contradictedAt?: Date | null;
  }>
): EvidenceSet {
  return {
    exchanges: rows.map((r) => ({
      kind: r.kind,
      subject: r.subject,
      offeredAt: r.offeredAt ?? T0,
      confirmedAt: r.confirmedAt ?? null,
      contradictedAt: r.contradictedAt ?? null,
    })),
  };
}

const INSTANCE_A = 'the interview last week';
const INSTANCE_B = 'the same thing with her sister in March';
const INSTANCE_C = 'the childhood memory of the dinner table';
const READING = 'an introjected rule about never excluding anyone';
const RIVAL = 'a situational power response — she was a prospective employer';
const RECOGNITION = 'I can never just say no in the moment';

const FULL_TARGET: TherapeuticTarget = {
  phenomenon:
    'when someone pushes into her plans, her body objects immediately, she accommodates anyway, then attacks herself for the delay',
  inTheirTerms: RECOGNITION,
  direction: 'to be able to decline in the moment',
  corroboration: [INSTANCE_A, INSTANCE_B],
  provenance: 'user',
  status: 'held',
};

/** Evidence that fully establishes FULL_TARGET. */
const TARGET_EVIDENCE = ev(
  { kind: 'recognition', subject: RECOGNITION, confirmedAt: T1 },
  { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
  { kind: 'instance', subject: INSTANCE_B, confirmedAt: T2 },
);

const LEADING: MechanismCandidate = {
  reading: READING,
  supports: ["the phrasing is her mother's"],
  corroboration: [INSTANCE_A, INSTANCE_B],
  countsAgainst: [],
  level: 'working_formulation',
  provenance: 'elicited',
};

const RIVAL_TESTED: MechanismCandidate = {
  reading: RIVAL,
  countsAgainst: [INSTANCE_B],
  level: 'hypothesis',
};

/** Evidence that fully establishes the mechanism (with RIVAL_TESTED present). */
const MECHANISM_EVIDENCE = ev(
  { kind: 'recognition', subject: RECOGNITION, confirmedAt: T1 },
  { kind: 'mechanism', subject: READING, confirmedAt: T2 },
  { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
  { kind: 'instance', subject: INSTANCE_B, confirmedAt: T2 },
);

const LEGACY: TaskContract = {
  presentingRequest: 'I want to stop freezing when people ask me for things',
  expectedHelp: 'somewhere to think it through out loud',
  currentFocus: 'the interview last week',
  completionCriterion: 'being able to say no without the spiral afterwards',
};

const BASE = { intensity: 4, safetyFlag: 'none' as const, recommendedAction: 'stay' as const };

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_pr4b', currentStage: 1, currentDepth: 'surface',
    startedAt: new Date('2026-06-15'), lastActivityAt: new Date('2026-06-23'),
    dischargedAt: null, anchorText: null, anchorSetAt: null, identityAnchor: null,
    identityAnchorSetAt: null, processingChannel: null, adultSelfQualities: null,
    lastIntensity: null, lastIntensityAt: null, lastDeepLayerContactAt: null, mii: {},
    stage8WeeksElapsed: 0, frozenForReview: false, frozenAt: null, frozenReason: null,
    continuityNote: null, parts: [], foreignFiles: [], signatureImages: [], patterns: [],
    sessionCount: 1, daysEngaged: 1, thisSessionMessageCount: 0, stageJustAdvanced: false,
    hoursSinceLastTurn: null, isSessionResume: false, hasOpenCycle: false,
    openCycleDescription: null, sessionRejectedModalities: [], recentChannelShift: false,
    taskContract: null, onboardingAnswers: null, closureProcess: CLOSURE_PROCESS_NONE, middleLayer: MIDDLE_LAYER_STATE_NONE,
    workingMemory: null, ...overrides,
  };
}

beforeEach(() => {
  rpUpdates.length = 0;
  evidenceRows.length = 0;
  evidenceId = 0;
  rpFindUniqueImpl.mockReset();
  rpFindUniqueImpl.mockResolvedValue({
    anchorTextEncrypted: null, mii: {}, taskContractEncrypted: null,
    currentDepth: 'surface', closureProcessState: 'NONE',
  });
});

// ===========================================================================
// 1. INTEGRITY — what the model cannot do
// ===========================================================================

describe('integrity boundary', () => {
  it('CRITICAL: the parser strips model-emitted stamps', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        mechanismConfirmed: { reading: READING, confirmedAt: '2026-08-01T00:00:00Z' },
        instanceConfirmed: { instance: INSTANCE_A, confirmedAt: '2026-08-01T00:00:00Z' },
        recognitionConfirmed: { recognition: RECOGNITION, contradictedAt: null, offeredAt: 'now' },
      }),
    );
    expect(r.mechanismConfirmed).toEqual({ reading: READING });
    expect(r.instanceConfirmed).toEqual({ instance: INSTANCE_A });
    expect(r.recognitionConfirmed).toEqual({ recognition: RECOGNITION });
    for (const field of [r.mechanismConfirmed, r.instanceConfirmed, r.recognitionConfirmed]) {
      expect(field).not.toHaveProperty('confirmedAt');
      expect(field).not.toHaveProperty('offeredAt');
      expect(field).not.toHaveProperty('contradictedAt');
    }
  });

  it('CRITICAL: same-turn offer + confirm never confirms', async () => {
    await applyEvidenceExchanges('u1', {
      ...BASE,
      mechanismOffered: { reading: READING },
      mechanismConfirmed: { reading: READING },
    });
    const loaded = await loadEvidence('u1');
    expect(loaded.exchanges).toHaveLength(1);
    expect(loaded.exchanges[0].offeredAt).not.toBeNull();
    expect(loaded.exchanges[0].confirmedAt).toBeNull();
  });

  it('a confirmation with no prior offer is a no-op', async () => {
    await applyEvidenceExchanges('u1', { ...BASE, instanceConfirmed: { instance: INSTANCE_A } });
    expect((await loadEvidence('u1')).exchanges).toHaveLength(0);
  });

  it('an offer on one turn and a confirmation on the next DOES confirm', async () => {
    await applyEvidenceExchanges('u1', { ...BASE, mechanismOffered: { reading: READING } });
    await applyEvidenceExchanges('u1', { ...BASE, mechanismConfirmed: { reading: READING } });
    const loaded = await loadEvidence('u1');
    expect(loaded.exchanges).toHaveLength(1);
    expect(loaded.exchanges[0].confirmedAt).not.toBeNull();
  });

  it('a contradiction is recorded even when its wording routes to nothing', async () => {
    await applyEvidenceExchanges('u1', {
      ...BASE,
      mechanismContradicted: { reading: 'a wording never formally offered' },
    });
    const loaded = await loadEvidence('u1');
    expect(loaded.exchanges).toHaveLength(1);
    expect(loaded.exchanges[0].contradictedAt).not.toBeNull();
  });

  it('a contradiction clears an existing confirmation', async () => {
    await applyEvidenceExchanges('u1', { ...BASE, mechanismOffered: { reading: READING } });
    await applyEvidenceExchanges('u1', { ...BASE, mechanismConfirmed: { reading: READING } });
    await applyEvidenceExchanges('u1', { ...BASE, mechanismContradicted: { reading: READING } });
    const row = (await loadEvidence('u1')).exchanges[0];
    expect(row.confirmedAt).toBeNull();
    expect(row.contradictedAt).not.toBeNull();
  });
});

// ===========================================================================
// 2. TARGET SUFFICIENCY (§3a) — decisions 2 and 3
// ===========================================================================

describe('validateTargetSufficiency', () => {
  it('establishes with confirmed recognition + two confirmed instances', () => {
    const v = validateTargetSufficiency(FULL_TARGET, TARGET_EVIDENCE);
    expect(v.status).toBe('established');
    expect(v.reasons).toEqual([R.TARGET_ESTABLISHED]);
  });

  it('no Target → none', () => {
    for (const empty of [undefined, null]) {
      const v = validateTargetSufficiency(empty, TARGET_EVIDENCE);
      expect(v.status).toBe('none');
      expect(v.reasons).toEqual([R.TARGET_ABSENT]);
    }
  });

  const PARTS: Array<[keyof TherapeuticTarget, string]> = [
    ['phenomenon', R.TARGET_PHENOMENON_MISSING],
    ['inTheirTerms', R.TARGET_IN_THEIR_TERMS_MISSING],
    ['direction', R.TARGET_DIRECTION_MISSING],
  ];
  for (const [part, reason] of PARTS) {
    it(`missing §4 part "${part}" → proposed`, () => {
      const t = { ...FULL_TARGET };
      delete t[part];
      const v = validateTargetSufficiency(t, TARGET_EVIDENCE);
      expect(v.established).toBe(false);
      expect(v.reasons).toContain(reason);
    });
  }

  it('DECISION 2: bare `elicited` provenance is NOT enough without a confirmed recognition', () => {
    const v = validateTargetSufficiency(
      { ...FULL_TARGET, provenance: 'elicited' },
      ev(
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T2 },
      ),
    );
    expect(v.established).toBe(false);
    expect(v.reasons).toContain(R.TARGET_RECOGNITION_UNCONFIRMED);
  });

  it('DECISION 3: corroboration STRINGS alone establish nothing', () => {
    const v = validateTargetSufficiency(FULL_TARGET, ev({ kind: 'recognition', subject: RECOGNITION, confirmedAt: T1 }));
    expect(v.parts.corroborationCount).toBe(0);
    expect(v.reasons).toContain(R.TARGET_CORROBORATION_UNCONFIRMED);
  });

  it('DECISION 3: one confirmed instance is not enough, however striking', () => {
    const v = validateTargetSufficiency(
      FULL_TARGET,
      ev(
        { kind: 'recognition', subject: RECOGNITION, confirmedAt: T1 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
      ),
    );
    expect(v.parts.corroborationCount).toBe(1);
    expect(v.established).toBe(false);
  });

  it('null provenance earns no credit even with full evidence', () => {
    const t = { ...FULL_TARGET };
    delete t.provenance;
    expect(validateTargetSufficiency(t, TARGET_EVIDENCE).reasons).toContain(R.TARGET_PROVENANCE_UNKNOWN);
  });

  it('clinician provenance alone cannot establish a Target', () => {
    expect(
      validateTargetSufficiency({ ...FULL_TARGET, provenance: 'clinician' }, TARGET_EVIDENCE).reasons,
    ).toContain(R.TARGET_PROVENANCE_CLINICIAN_ONLY);
  });

  it("the model's self-reported status never substitutes for validation", () => {
    expect(validateTargetSufficiency({ phenomenon: 'x'.repeat(20), status: 'held' }, TARGET_EVIDENCE).established).toBe(false);
    expect(validateTargetSufficiency({ ...FULL_TARGET, status: 'proposed' }, TARGET_EVIDENCE).established).toBe(true);
  });
});

// ===========================================================================
// 3. TARGET CONTRADICTION (owner ruling, 2026-08-13)
// ===========================================================================

describe('Target recognition contradiction', () => {
  const CONTRADICTED = ev(
    { kind: 'recognition', subject: RECOGNITION, confirmedAt: T1, contradictedAt: T2 },
    { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
    { kind: 'instance', subject: INSTANCE_B, confirmedAt: T1 },
  );

  it('demotes the Target and asks for a fresh recognition', () => {
    const v = validateTargetSufficiency(FULL_TARGET, CONTRADICTED);
    expect(v.status).toBe('proposed');
    expect(v.reasons).toContain(R.TARGET_AWAITING_FRESH_RECOGNITION);
  });

  it('NO LOCKOUT: corroboration and phenomenon survive the contradiction', () => {
    const v = validateTargetSufficiency(FULL_TARGET, CONTRADICTED);
    expect(v.parts.corroborationCount).toBe(2);
    expect(v.parts.phenomenon).toBe(true);
    expect(v.parts.direction).toBe(true);
    expect(v.reasons).not.toContain(R.TARGET_CORROBORATION_UNCONFIRMED);
  });

  it('a fresh recognition after the contradiction re-establishes — with NO new evidence required', () => {
    // The whole repair is a better sentence, checked with the user. Requiring
    // new episodes to fix a wording problem would be a category error.
    const v = validateTargetSufficiency(
      FULL_TARGET,
      ev(
        { kind: 'recognition', subject: RECOGNITION, confirmedAt: T1, contradictedAt: T2 },
        { kind: 'recognition', subject: 'more that I freeze than that I cannot say no', confirmedAt: T3 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T1 },
      ),
    );
    expect(v.status).toBe('established');
  });

  it('a recognition confirmed BEFORE the contradiction does not count', () => {
    const v = validateTargetSufficiency(
      FULL_TARGET,
      ev(
        { kind: 'recognition', subject: 'an earlier wording', confirmedAt: T0 },
        { kind: 'recognition', subject: RECOGNITION, contradictedAt: T2 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T1 },
      ),
    );
    expect(v.reasons).toContain(R.TARGET_AWAITING_FRESH_RECOGNITION);
  });

  it('code never distinguishes rejection from refinement — both need the same fresh recognition', async () => {
    // Emitted identically; the clinical difference is the Clinician's, not code's.
    await applyEvidenceExchanges('u1', { ...BASE, recognitionOffered: { recognition: RECOGNITION } });
    await applyEvidenceExchanges('u1', { ...BASE, recognitionContradicted: { recognition: RECOGNITION } });
    const loaded = await loadEvidence('u1');
    expect(loaded.exchanges[0].contradictedAt).not.toBeNull();
  });
});

// ===========================================================================
// 4. MECHANISM SUFFICIENCY (§3b) — Rung 3 becomes reachable
// ===========================================================================

describe('validateMechanismSufficiency', () => {
  it('LANDMARK: establishes on full code-owned evidence', () => {
    const v = validateMechanismSufficiency([LEADING, RIVAL_TESTED], MECHANISM_EVIDENCE);
    expect(v.status).toBe('established');
    expect(v.established).toBe(true);
    expect(v.reasons).toEqual([R.MECHANISM_ESTABLISHED]);
  });

  it('no differential → none', () => {
    for (const empty of [undefined, null, []]) {
      const v = validateMechanismSufficiency(empty, MECHANISM_EVIDENCE);
      expect(v.status).toBe('none');
      expect(v.reasons).toContain(R.MECHANISM_DIFFERENTIAL_ABSENT);
    }
  });

  it('§1(2): a reading never confirmed by the user cannot be established', () => {
    const v = validateMechanismSufficiency(
      [LEADING, RIVAL_TESTED],
      ev(
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T2 },
      ),
    );
    expect(v.established).toBe(false);
    expect(v.reasons).toContain(R.MECHANISM_OFFER_UNCONFIRMED);
  });

  it('§1(3): fewer than two confirmed instances cannot be established', () => {
    const v = validateMechanismSufficiency(
      [LEADING, RIVAL_TESTED],
      ev(
        { kind: 'mechanism', subject: READING, confirmedAt: T2 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
      ),
    );
    expect(v.reasons).toContain(R.MECHANISM_CORROBORATION_UNCONFIRMED);
  });

  it('§1(4): clinician provenance blocks promotion', () => {
    const v = validateMechanismSufficiency(
      [{ ...LEADING, provenance: 'clinician' }, RIVAL_TESTED],
      MECHANISM_EVIDENCE,
    );
    expect(v.reasons).toContain(R.MECHANISM_PROVENANCE_CLINICIAN_ONLY);
  });

  it('§1(1) structural: an untested rival blocks promotion', () => {
    const v = validateMechanismSufficiency(
      [LEADING, { reading: RIVAL, level: 'hypothesis' }],
      MECHANISM_EVIDENCE,
    );
    expect(v.established).toBe(false);
    expect(v.reasons).toContain(R.MECHANISM_ALTERNATIVES_UNTESTED);
  });

  it('§1(1) clinical: without a leading claim, nothing is established', () => {
    const v = validateMechanismSufficiency(
      [{ ...LEADING, level: 'hypothesis' }, RIVAL_TESTED],
      MECHANISM_EVIDENCE,
    );
    expect(v.status).toBe('candidate');
    expect(v.reasons).toContain(R.MECHANISM_NOT_CLAIMED_LEADING);
  });

  it('SELF-ASSERTION: level alone buys nothing without evidence', () => {
    const v = validateMechanismSufficiency(
      [{ reading: READING, level: 'working_formulation', provenance: 'user' }],
      EMPTY_EVIDENCE,
    );
    expect(v.status).toBe('leading');
    expect(v.established).toBe(false);
  });

  it('verbosity buys nothing — 50 supports, no confirmed evidence', () => {
    const v = validateMechanismSufficiency(
      [{ ...LEADING, supports: Array.from({ length: 50 }, (_, i) => `support ${i}`) }],
      EMPTY_EVIDENCE,
    );
    expect(v.established).toBe(false);
  });

  it('a contradicted candidate is reported as such', () => {
    const v = validateMechanismSufficiency(
      [LEADING],
      ev({ kind: 'mechanism', subject: READING, contradictedAt: T2 }),
    );
    expect(v.reasons).toContain(R.MECHANISM_CANDIDATE_CONTRADICTED);
  });
});

// ===========================================================================
// 5. DECISION 4 — contradiction freshness, and paraphrase laundering
// ===========================================================================

describe('decision 4 — freshness after contradiction', () => {
  it('LAUNDERING BLOCKED: a reworded candidate over the SAME evidence is refused', () => {
    // Turn 2: user contradicts. Turn 3+: model rewords and re-confirms, but
    // brings no new user-confirmed instance.
    const reworded: MechanismCandidate = {
      ...LEADING,
      reading: 'a rule she absorbed about never leaving anyone out',
    };
    const v = validateMechanismSufficiency(
      [reworded, RIVAL_TESTED],
      ev(
        { kind: 'mechanism', subject: READING, contradictedAt: T2 },
        { kind: 'mechanism', subject: reworded.reading, confirmedAt: T3 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T0 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T1 },
      ),
    );
    expect(v.established).toBe(false);
    expect(v.reasons).toContain(R.MECHANISM_AWAITING_POST_CONTRADICTION_EVIDENCE);
  });

  it('LEGITIMATE REVISION: genuinely new evidence after the contradiction reopens it', () => {
    const revised: MechanismCandidate = {
      ...LEADING,
      reading: 'a rule she absorbed about never leaving anyone out',
      corroboration: [INSTANCE_A, INSTANCE_C],
    };
    const v = validateMechanismSufficiency(
      [revised, RIVAL_TESTED],
      ev(
        { kind: 'mechanism', subject: READING, contradictedAt: T2 },
        { kind: 'mechanism', subject: revised.reading, confirmedAt: T3 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T0 },
        { kind: 'instance', subject: INSTANCE_C, confirmedAt: T3 }, // NEW, post-contradiction
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T3 },
      ),
    );
    expect(v.established).toBe(true);
  });

  it('the confirming exchange must ALSO postdate the contradiction', () => {
    const v = validateMechanismSufficiency(
      [LEADING, RIVAL_TESTED],
      ev(
        { kind: 'mechanism', subject: READING, confirmedAt: T1 },
        { kind: 'mechanism', subject: 'something else', contradictedAt: T2 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T3 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T3 },
      ),
    );
    expect(v.reasons).toContain(R.MECHANISM_AWAITING_POST_CONTRADICTION_EVIDENCE);
  });

  it('CLAUSE 6: a Target-recognition contradiction also freshness-bars the mechanism', () => {
    const v = validateMechanismSufficiency(
      [LEADING, RIVAL_TESTED],
      ev(
        { kind: 'recognition', subject: RECOGNITION, contradictedAt: T3 },
        { kind: 'mechanism', subject: READING, confirmedAt: T2 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T2 },
      ),
    );
    expect(v.established).toBe(false);
    expect(v.reasons).toContain(R.MECHANISM_AWAITING_POST_CONTRADICTION_EVIDENCE);
  });

  it('a contradiction never escapes rewording — max() spans all rows', () => {
    // Three differently-worded contradictions; the floor is the latest.
    const v = validateMechanismSufficiency(
      [LEADING, RIVAL_TESTED],
      ev(
        { kind: 'mechanism', subject: 'wording one', contradictedAt: T1 },
        { kind: 'mechanism', subject: 'wording two', contradictedAt: T3 },
        { kind: 'mechanism', subject: READING, confirmedAt: T2 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T2 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T2 },
      ),
    );
    expect(v.reasons).toContain(R.MECHANISM_AWAITING_POST_CONTRADICTION_EVIDENCE);
  });
});

// ===========================================================================
// 6. RUNG DERIVATION (§6)
// ===========================================================================

describe('deriveLicensedRung', () => {
  it('covers all four combinations', () => {
    expect(deriveLicensedRung(false, false)).toBe(1);
    expect(deriveLicensedRung(true, false)).toBe(2);
    expect(deriveLicensedRung(true, true)).toBe(3);
    expect(deriveLicensedRung(false, true)).toBe(3);
  });

  it('Rung 1 — no established Target', () => {
    expect(evaluateSufficiency({ target: { phenomenon: 'something recurring happens' } }).licensedRung).toBe(1);
  });

  it('Rung 2 — Target established, mechanism only self-reported leading', () => {
    const v = evaluateSufficiency(
      { ...LEGACY, target: FULL_TARGET, mechanismDifferential: [{ ...LEADING, corroboration: [] }] },
      TARGET_EVIDENCE,
    );
    expect(v.target.status).toBe('established');
    expect(v.mechanism.status).toBe('leading');
    expect(v.licensedRung).toBe(2);
  });

  it('LANDMARK: Rung 3 is genuinely reachable through evidence', () => {
    const v = evaluateSufficiency(
      { ...LEGACY, target: FULL_TARGET, mechanismDifferential: [LEADING, RIVAL_TESTED] },
      MECHANISM_EVIDENCE,
    );
    expect(v.target.status).toBe('established');
    expect(v.mechanism.status).toBe('established');
    expect(v.licensedRung).toBe(3);
  });

  it('demotion pulls the rung back down', () => {
    const contradicted = ev(
      { kind: 'recognition', subject: RECOGNITION, confirmedAt: T1, contradictedAt: T2 },
      { kind: 'mechanism', subject: READING, confirmedAt: T1 },
      { kind: 'instance', subject: INSTANCE_A, confirmedAt: T1 },
      { kind: 'instance', subject: INSTANCE_B, confirmedAt: T1 },
    );
    const v = evaluateSufficiency(
      { target: FULL_TARGET, mechanismDifferential: [LEADING, RIVAL_TESTED] },
      contradicted,
    );
    expect(v.licensedRung).toBe(1);
  });
});

// ===========================================================================
// 7. LEGACY / BACKWARD COMPATIBILITY
// ===========================================================================

describe('legacy users', () => {
  it('no contract → Rung 1', () => {
    for (const empty of [undefined, null]) {
      const v = evaluateSufficiency(empty, EMPTY_EVIDENCE);
      expect(v.licensedRung).toBe(1);
      expect(v.target.status).toBe('none');
      expect(v.mechanism.status).toBe('none');
    }
  });

  it('a pre-PR-3 legacy contract → Rung 1', () => {
    expect(evaluateSufficiency(LEGACY, EMPTY_EVIDENCE).licensedRung).toBe(1);
  });

  it('a Target with no evidence rows at all → Rung 1, fail closed', () => {
    expect(evaluateSufficiency({ target: FULL_TARGET }, EMPTY_EVIDENCE).licensedRung).toBe(1);
  });
});

// ===========================================================================
// 8. SHADOW LOG
// ===========================================================================

describe('shadow log', () => {
  const verdict = evaluateSufficiency(
    { ...LEGACY, target: FULL_TARGET, mechanismDifferential: [LEADING, RIVAL_TESTED] },
    MECHANISM_EVIDENCE,
  );

  it('reports statuses, rung, reasons and counts', () => {
    const line = buildSufficiencyShadowLine('user_abc', verdict);
    expect(line.target).toBe('established');
    expect(line.mechanism).toBe('established');
    expect(line.rung).toBe(3);
    expect(line.counts.corroboration).toBe(2);
    expect(line.counts.candidates).toBe(2);
  });

  it('counts recognition contradictions for review but never gates on them', () => {
    const pressed = evaluateSufficiency(
      { target: FULL_TARGET },
      ev(
        { kind: 'recognition', subject: 'a', contradictedAt: T1 },
        { kind: 'recognition', subject: 'b', contradictedAt: T2 },
        { kind: 'recognition', subject: 'c', confirmedAt: T3 },
        { kind: 'instance', subject: INSTANCE_A, confirmedAt: T3 },
        { kind: 'instance', subject: INSTANCE_B, confirmedAt: T3 },
      ),
    );
    expect(buildSufficiencyShadowLine('u', pressed).counts.recognitionContradictions).toBe(2);
    // Observability only: two withdrawals did NOT block the fresh recognition.
    expect(pressed.target.status).toBe('established');
  });

  it('PRIVACY: no user content or clinical free text', () => {
    const s = JSON.stringify(buildSufficiencyShadowLine('user_abc', verdict));
    expect(s).not.toContain(FULL_TARGET.phenomenon!);
    expect(s).not.toContain(RECOGNITION);
    expect(s).not.toContain('introjected rule');
    expect(s).not.toContain(INSTANCE_A);
    expect(s).not.toContain(LEGACY.presentingRequest!);
  });

  it('every emitted code belongs to the closed reason set', () => {
    const known = new Set<string>(Object.values(SUFFICIENCY_REASONS));
    const line = buildSufficiencyShadowLine('user_abc', verdict);
    for (const c of [...line.targetReasons, ...line.mechanismReasons, ...line.missingEvidence]) {
      expect(known.has(c)).toBe(true);
    }
    expect(TARGET_VALIDATED_STATUSES).toContain(line.target);
    expect(MECHANISM_VALIDATED_STATUSES).toContain(line.mechanism);
  });
});

// ===========================================================================
// 9. RUNTIME INERTNESS
// ===========================================================================

describe('shadow mode changes nothing a user could perceive', () => {
  it('the assembled prompt is byte-identical with a fully established Target', () => {
    const plain = assembleSystemPromptBlocks(makeState({ taskContract: LEGACY }))
      .map((b) => b.text).join('\n');
    const loaded = assembleSystemPromptBlocks(
      makeState({
        taskContract: { ...LEGACY, target: FULL_TARGET, mechanismDifferential: [LEADING, RIVAL_TESTED] },
      }),
    ).map((b) => b.text).join('\n');

    // The byte-identical assertion is the real proof of inertness, and it
    // is strictly stronger than any grep: whatever this user has stored
    // makes no difference to the prompt.
    //
    // PR 5 note: /rung/i and /sufficiency/i used to be asserted absent.
    // They are now legitimately present — the Middle Layer canon is
    // injected and it TEACHES the ladder and the two sufficiencies. What
    // must still never appear is this user's own material.
    expect(loaded).toBe(plain);
    expect(loaded).not.toContain(FULL_TARGET.phenomenon!);
    expect(loaded).not.toContain(FULL_TARGET.inTheirTerms!);
  });

  it('persists both status columns and no behavioural field', async () => {
    rpFindUniqueImpl.mockResolvedValue({
      anchorTextEncrypted: null, mii: {},
      taskContractEncrypted: `enc(${JSON.stringify({ ...LEGACY, target: FULL_TARGET })})`,
      currentDepth: 'surface', closureProcessState: 'NONE',
    });
    await applyStateReportToProgress('u_persist', {
      ...BASE,
      taskContract: { currentFocus: 'the spiral afterwards' },
    });
    const w = rpUpdates.find((u) => 'middleLayerTargetStatus' in u.data);
    expect(w?.data.middleLayerTargetStatus).toBe('proposed'); // no evidence rows yet
    expect(w?.data.middleLayerMechanismStatus).toBe('none');
    for (const forbidden of ['currentStage', 'currentDepth', 'closureProcessState', 'closureRoute']) {
      expect(w?.data).not.toHaveProperty(forbidden);
    }
  });

  it('a full evidence run through save() persists established/established', async () => {
    rpFindUniqueImpl.mockResolvedValue({
      anchorTextEncrypted: null, mii: {},
      taskContractEncrypted: `enc(${JSON.stringify({
        ...LEGACY, target: FULL_TARGET, mechanismDifferential: [LEADING, RIVAL_TESTED],
      })})`,
      currentDepth: 'surface', closureProcessState: 'NONE',
    });
    // Turn 1 — offers.
    await applyStateReportToProgress('u_full', {
      ...BASE,
      recognitionOffered: { recognition: RECOGNITION },
      mechanismOffered: { reading: READING },
      instanceOffered: { instance: INSTANCE_A },
    });
    // Turn 2 — the user answers, and a second instance is offered.
    await applyStateReportToProgress('u_full', {
      ...BASE,
      recognitionConfirmed: { recognition: RECOGNITION },
      mechanismConfirmed: { reading: READING },
      instanceConfirmed: { instance: INSTANCE_A },
      instanceOffered: { instance: INSTANCE_B },
    });
    // Turn 3 — the user confirms the second instance as distinct.
    await applyStateReportToProgress('u_full', {
      ...BASE,
      instanceConfirmed: { instance: INSTANCE_B },
    });
    const w = [...rpUpdates].reverse().find((u) => 'middleLayerTargetStatus' in u.data);
    expect(w?.data.middleLayerTargetStatus).toBe('established');
    expect(w?.data.middleLayerMechanismStatus).toBe('established');
  });

  it('a state save survives a corrupt stored contract', async () => {
    rpFindUniqueImpl.mockResolvedValue({
      anchorTextEncrypted: null, mii: {},
      taskContractEncrypted: 'enc(not valid json {{{)',
      currentDepth: 'surface', closureProcessState: 'NONE',
    });
    await expect(applyStateReportToProgress('u_corrupt', { ...BASE })).resolves.not.toThrow();
    expect(rpUpdates.length).toBeGreaterThan(0);
  });
});
