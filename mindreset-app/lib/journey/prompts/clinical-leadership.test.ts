// Clinical-leadership restoration (2026-08-24) — fixes 1+2+3 from the
// regression investigation of the 2026-08-23 production session.
//
// THE DIAGNOSIS, in one paragraph. The rebuild made `licensedRung` the only
// door to depth, and the door's key is a set of structured emissions —
// `taskContract.target`, `instanceOffered`/`instanceConfirmed` with stable
// keys, `recognitionOffered`/`recognitionConfirmed` — that the model had
// never once produced in production, because they lived only in the
// output-format reference and not in the per-turn checklist that drives
// behaviour. targetStatus therefore sat at TARGET_ABSENT, the rung at 1
// forever, and the state block handed the model an interviewer's job
// description every turn while the instructions that command action ("begin
// Rung 2 now", "waiting is the failure") were all conditional on states that
// could never arrive. On top of that, naming the treatment path was itself
// classified as Rung-3 speech, and Adult-Self building had no rung home.
//
// THE FIX, deliberately without touching the validator: (1) checklist items
// 13–15 give the emissions concrete per-turn triggers; (2) the state block's
// rung-progress line is dynamic — it names which §3a requirements are met
// and the EXACT emissions still missing; (3) canon licenses naming the
// working path at any rung while keeping causal formulation §3b-gated; (4)
// canon licenses stabilisation and Adult-Self building/re-activation at
// Rung 1, with the directive that an absent Adult Self under deepening
// material makes building it the next move.
//
// NOT CHANGED, asserted below: evaluateSufficiency's requirements (two
// confirmed instances, later-turn confirmation, provenance), licensed-rung
// derivation, and the §3b gate on sharing causal formulations.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt, loadSpec } from './load-spec';
import { assembleSystemPromptBlocks } from './assemble';
import {
  evaluateSufficiency,
  deriveLicensedRung,
  MIDDLE_LAYER_STATE_NONE,
} from '../middleLayer/sufficiency';
import { EMPTY_EVIDENCE, type EvidenceSet } from '../middleLayer/evidence';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import type { JourneyState } from '../state/types';
import type { TaskContract } from '../stateReport/schema';

const master = loadMasterJourneyPrompt() ?? '';
const middleLayerCanon = loadSpec('MIDDLE_LAYER.md');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_clinical_leadership_test',
    currentStage: 3,
    currentDepth: 'surface',
    startedAt: new Date('2026-07-01'),
    lastActivityAt: new Date('2026-08-24'),
    dischargedAt: null,
    anchorText: 'гарден-центр и свой сад',
    anchorSetAt: new Date('2026-07-28'),
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'emotional',
    adultSelfQualities: 'та, которая не хочет предавать себя',
    lastIntensity: 6,
    lastIntensityAt: new Date('2026-08-24'),
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
    sessionCount: 5,
    daysEngaged: 10,
    thisSessionMessageCount: 5,
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
    middleLayer: MIDDLE_LAYER_STATE_NONE,
    middleLayerProgress: null,
    workingMemory: null,
    ...overrides,
  } as JourneyState;
}

/** The state block — the third (first uncached) block of the assembly. */
function stateBlockFor(state: JourneyState): string {
  const blocks = assembleSystemPromptBlocks(state);
  return (blocks[2] as { text: string }).text;
}

const exchange = (
  kind: 'recognition' | 'instance' | 'mechanism',
  subject: string,
  o: { offeredAt?: Date; confirmedAt?: Date | null; contradictedAt?: Date | null } = {},
) => ({
  kind,
  subject,
  offeredAt: o.offeredAt ?? new Date('2026-08-20T10:00:00Z'),
  confirmedAt: o.confirmedAt ?? null,
  contradictedAt: o.contradictedAt ?? null,
});

/** The checklist section, same anchors the existing suites use. */
function checklist(): string {
  const start = master.indexOf(
    '**Before emitting the state report each turn, record the following.**',
  );
  const end = master.indexOf('Emitting these structured fields when they apply is required', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return master.slice(start, end);
}

// ---------------------------------------------------------------------------
// 1. The per-turn checklist now requests the Middle Layer emissions
// ---------------------------------------------------------------------------

describe('checklist items 13-15 make the sufficiency emissions per-turn work', () => {
  const list = checklist();

  it('item 13 — the Target, with a concrete trigger and an anti-wait clause', () => {
    const item = list.slice(list.indexOf('13. **Target.**'), list.indexOf('\n14. '));
    expect(item).toContain('`taskContract.target`');
    expect(item).toMatch(/recognised a recurring pattern as theirs/);
    expect(item).toContain('`phenomenon`');
    expect(item).toContain('`inTheirTerms`');
    expect(item).toContain('`direction`');
    expect(item).toContain('`provenance`');
    expect(item).toMatch(/Do NOT wait for the picture to be complete/);
    expect(item).toMatch(/does not exist for the platform/);
  });

  it('item 14 — occasions, with the full key protocol spelled out', () => {
    const item = list.slice(list.indexOf('14. **Occasions.**'), list.indexOf('\n15. '));
    expect(item).toContain('`instanceOffered: {instance: "<short-key>"}`');
    expect(item).toContain('`instanceConfirmed`');
    expect(item).toMatch(/same key/i);
    expect(item).toMatch(/earlier\*\* turn/i);
    expect(item).toContain('`target.corroboration`');
    expect(item).toMatch(/Two confirmed distinct occasions/);
  });

  it('item 15 — the mechanism differential and its exchanges', () => {
    const item = list.slice(list.indexOf('15. **Differential.**'), list.length);
    expect(item).toContain('`mechanismDifferential`');
    expect(item).toContain('`mechanismOffered`');
    expect(item).toContain('`mechanismConfirmed`');
    expect(item).toContain('`mechanismContradicted`');
    expect(item).toMatch(/lives only in `clinicalRead` or `continuityNote`/);
  });

  it('the earlier items and the closing sentence are untouched', () => {
    // The anchors the existing suites slice on must survive verbatim.
    expect(list).toContain('10. **Share-back.**');
    expect(list).toContain('11. **Signal tokens.**');
    expect(list).toContain('12. **Continuity.**');
    expect(master).toContain(
      'Emitting these structured fields when they apply is required',
    );
  });
});

// ---------------------------------------------------------------------------
// 2. The rung-progress block is dynamic and names exact missing emissions
// ---------------------------------------------------------------------------

describe('Rung-1 state output names the exact missing sufficiency requirements', () => {
  it('no target ever emitted → says so, names the emissions, in the rendered block', () => {
    const progress = evaluateSufficiency(null, EMPTY_EVIDENCE);
    const block = stateBlockFor(makeState({ middleLayerProgress: progress }));
    expect(block).toContain('no `taskContract.target` has ever been emitted');
    expect(block).toContain('`instanceOffered`');
    expect(block).toContain('`recognitionOffered`');
    expect(block).toMatch(/continuityNote` prose does not exist here/);
  });

  it('partial target → met parts listed as met, missing parts named with the emission', () => {
    const contract: TaskContract = {
      target: {
        phenomenon: 'she re-reads his messages and reverses into self-blame',
        provenance: 'user',
      },
    };
    const evidence: EvidenceSet = {
      exchanges: [
        exchange('recognition', 'the cycle is hers', {
          confirmedAt: new Date('2026-08-21T10:00:00Z'),
        }),
      ],
    };
    const progress = evaluateSufficiency(contract, evidence);
    const block = stateBlockFor(makeState({ middleLayerProgress: progress }));

    expect(block).toContain('already in place: `phenomenon`');
    expect(block).toContain('recognition confirmed');
    expect(block).toContain("still missing: `target.inTheirTerms` — the user's own words");
    expect(block).toContain('still missing: `target.direction`');
    expect(block).toContain('confirmed occasions: 0 of 2');
    expect(block).toContain('`instanceConfirmed` with the same key');
  });

  it('one confirmed occasion → counts 1 of 2, not a vague requirement', () => {
    const contract: TaskContract = {
      target: {
        phenomenon: 'the cycle',
        inTheirTerms: 'застряла и оправдываю его',
        direction: 'to stop abandoning herself in the reversal',
        corroboration: ['husband_vietnam', 'first_marriage'],
        provenance: 'user',
      },
    };
    const evidence: EvidenceSet = {
      exchanges: [
        exchange('recognition', 'the cycle is hers', {
          confirmedAt: new Date('2026-08-21T10:00:00Z'),
        }),
        exchange('instance', 'husband_vietnam', {
          confirmedAt: new Date('2026-08-21T10:05:00Z'),
        }),
        exchange('instance', 'first_marriage'), // offered, never confirmed
      ],
    };
    const progress = evaluateSufficiency(contract, evidence);
    expect(progress.target.established).toBe(false);
    const block = stateBlockFor(makeState({ middleLayerProgress: progress }));
    expect(block).toContain('confirmed occasions: 1 of 2');
  });

  it('the informational label is present and the rung line stays authoritative', () => {
    const progress = evaluateSufficiency(null, EMPTY_EVIDENCE);
    const block = stateBlockFor(makeState({ middleLayerProgress: progress }));
    expect(block).toContain(
      'Licensed depth — Middle Layer rung 1 (platform-derived fact, not your assessment)',
    );
    expect(block).toMatch(/informational — the rung above is the authority|nothing is in place yet/);
  });

  it('no progress verdict (legacy / failed read) → the original static line survives', () => {
    const block = stateBlockFor(makeState({ middleLayerProgress: null }));
    expect(block).toContain(
      'To reach Rung 2: the Target needs all four parts of §4',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Naming the working path is licensed below Mechanism Sufficiency
// ---------------------------------------------------------------------------

describe('working-path explanation is permitted at any rung', () => {
  it('the canon licence exists in §6', () => {
    expect(middleLayerCanon).toContain('**Naming the working path is speech at every rung**');
    expect(middleLayerCanon).toMatch(/asserts no cause and needs no sufficiency/);
    expect(middleLayerCanon).toMatch(/may be said at Rung 1/);
  });

  it('the master licenses it inside the depth-matching paragraph', () => {
    expect(master).toContain('**Naming the working path is not that, and is licensed at any rung:**');
    expect(master).toMatch(/a prerequisite \(stabilisation, building the Adult Self\) comes before deeper work/);
    expect(master).toMatch(/Withholding the path is not caution/);
  });

  it('without licensing causal certainty — the §3b gate on formulation sharing survives', () => {
    expect(master).toContain(
      'or sharing a meaningful causal formulation — needs **Mechanism Sufficiency** (§3b)',
    );
    expect(middleLayerCanon).toMatch(
      /What remains gated by §3b is asserting \*why the pattern runs\*/,
    );
    // §7's honest sentence is still the canon model of this speech.
    expect(middleLayerCanon).toContain(
      "I don't yet know why this happens — and we don't need to know yet to work on it",
    );
  });

  it('"never recite the formulation" no longer contradicts path-naming', () => {
    expect(master).toContain(
      'Never recite the formulation to the user (naming the working path — what is known, what is not, what comes next — is not reciting the formulation',
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Adult-Self building / stabilisation are Rung-1 work
// ---------------------------------------------------------------------------

describe('Adult-Self reactivation is explicitly available at Rung 1', () => {
  it('canon §6 Rung-1 bullet names stabilisation and Adult-Self building', () => {
    expect(middleLayerCanon).toMatch(
      /Rung 1 — any time, no target needed:.*building or re-activation of prerequisite capacities, the Adult Self above all/,
    );
    expect(middleLayerCanon).toMatch(
      /When the Adult Self is absent while material is deepening, building or re-activating it \*\*is\*\* the next move/,
    );
  });

  it('the master carries the directive as its own paragraph', () => {
    expect(master).toContain(
      '**When the Adult Self is absent and the material is deepening, building or re-activating the Adult Self is the next move — not another question.**',
    );
    expect(master).toMatch(/switching from investigation to prerequisite-building is the clinically leading act/);
  });

  it("the master's Rung-1 catalogue includes the resource work", () => {
    expect(master).toContain(
      'receiving a rupture — and building or re-activating the Adult Self and other prerequisite resources) is Rung 1',
    );
  });

  it('the rendered Rung-1 state block says it every turn, when Adult Self matters most', () => {
    const block = stateBlockFor(makeState());
    expect(block).toContain(
      'stabilisation and building or re-activating the Adult Self and other prerequisite resources',
    );
    expect(block).toContain(
      'When the Adult Self is absent while material is deepening, building it IS the next move',
    );
  });
});

// ---------------------------------------------------------------------------
// 5. The validator and the rung derivation did not move
// ---------------------------------------------------------------------------

describe('no validator or code-gate changes', () => {
  it('two confirmed instances are still required — one is not enough', () => {
    const contract: TaskContract = {
      target: {
        phenomenon: 'p',
        inTheirTerms: 't',
        direction: 'd',
        corroboration: ['k1', 'k2'],
        provenance: 'user',
      },
    };
    const oneConfirmed: EvidenceSet = {
      exchanges: [
        exchange('recognition', 'r', { confirmedAt: new Date('2026-08-21T10:00:00Z') }),
        exchange('instance', 'k1', { confirmedAt: new Date('2026-08-21T10:05:00Z') }),
        exchange('instance', 'k2'),
      ],
    };
    expect(evaluateSufficiency(contract, oneConfirmed).target.established).toBe(false);

    const twoConfirmed: EvidenceSet = {
      exchanges: [
        exchange('recognition', 'r', { confirmedAt: new Date('2026-08-21T10:00:00Z') }),
        exchange('instance', 'k1', { confirmedAt: new Date('2026-08-21T10:05:00Z') }),
        exchange('instance', 'k2', { confirmedAt: new Date('2026-08-21T10:06:00Z') }),
      ],
    };
    const verdict = evaluateSufficiency(contract, twoConfirmed);
    expect(verdict.target.established).toBe(true);
    expect(verdict.licensedRung).toBe(2);
  });

  it('rung derivation is untouched', () => {
    expect(deriveLicensedRung(false, false)).toBe(1);
    expect(deriveLicensedRung(true, false)).toBe(2);
    expect(deriveLicensedRung(true, true)).toBe(3);
  });

  it('the progress verdict is informational: MIDDLE_LAYER_STATE_NONE still renders rung 1', () => {
    // Even with an established-target verdict attached as progress, the
    // PERSISTED state alone decides the rendered rung.
    const contract: TaskContract = {
      target: {
        phenomenon: 'p', inTheirTerms: 't', direction: 'd',
        corroboration: ['k1', 'k2'], provenance: 'user',
      },
    };
    const evidence: EvidenceSet = {
      exchanges: [
        exchange('recognition', 'r', { confirmedAt: new Date('2026-08-21T10:00:00Z') }),
        exchange('instance', 'k1', { confirmedAt: new Date('2026-08-21T10:05:00Z') }),
        exchange('instance', 'k2', { confirmedAt: new Date('2026-08-21T10:06:00Z') }),
      ],
    };
    const progress = evaluateSufficiency(contract, evidence);
    expect(progress.licensedRung).toBe(2); // the verdict itself says 2...
    const block = stateBlockFor(makeState({ middleLayerProgress: progress }));
    // ...but the block renders the PERSISTED rung, which is still 1.
    expect(block).toContain('Licensed depth — Middle Layer rung 1');
  });
});
