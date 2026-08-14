// Middle Layer PR 5 (2026-08-14) — canon injection, investigation moves,
// and emission activation.
//
// PRs 1-4b built the Middle Layer and every piece of machinery behind it
// while it sat un-injected: the canon file was on disk but no code path
// loaded it, and nothing asked the model to produce the evidence PR 4b
// validates. PR 5 turns both on.
//
// What is under test here is exactly that boundary — the prompt now
// TEACHES and the model can now EMIT, while nothing yet ENFORCES. The last
// group is the one to read closely: it pins that PR 5 changed guidance,
// not gates.

import { describe, expect, it } from 'vitest';
import { assembleSystemPromptBlocks } from './assemble';
import { middleLayer, loadMasterJourneyPrompt } from './load-spec';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import type { JourneyState } from '../state/types';
import { parseStateReport } from '../stateReport/parse';
import { CANONICAL_MOVES, CANONICAL_MOVES_SET } from '../stateReport/schema';
import { MIDDLE_LAYER_STATE_NONE } from '../middleLayer/sufficiency';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_pr5', currentStage: 1, currentDepth: 'surface',
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

const BASE = { intensity: 4, safetyFlag: 'none' as const, recommendedAction: 'stay' as const };

const INVESTIGATION_MOVES = [
  'universal.investigate_gather',
  'universal.investigate_deepen',
  'universal.investigate_compare',
  'universal.investigate_discriminate',
  'universal.investigate_check',
  'universal.investigate_hold',
] as const;

function assembled(): string {
  return assembleSystemPromptBlocks(makeState()).map((b) => b.text).join('\n');
}

// ---------------------------------------------------------------------------
// 1. Injection — present, verbatim, and exactly once
// ---------------------------------------------------------------------------

describe('Middle Layer canon injection', () => {
  it('the canon reaches the assembled prompt', () => {
    const prompt = assembled();
    expect(prompt).toContain('THE MIDDLE LAYER — Investigation, Formulation, Target');
    expect(prompt).toContain('An indication is a reason to consider a mechanism. It is never permission to use it.');
    expect(prompt).toContain('Recognition of a cue or hypothesis never licenses intervention.');
  });

  it('CRITICAL: it appears exactly ONCE in the whole prompt', () => {
    const prompt = assembled();
    // Count on a sentence unique to the canon file. Duplication would mean
    // the model reads the ladder twice and could see two divergent copies
    // after any future edit to one of them.
    const marker = 'Everything you believe about the user sits at exactly one of four levels.';
    expect(prompt.split(marker)).toHaveLength(2); // 2 pieces = 1 occurrence
  });

  it('is injected VERBATIM — the canon is not rewritten on the way in', () => {
    const canon = middleLayer();
    expect(assembled()).toContain(canon);
  });

  it('carries the load-bearing sections the later PRs depend on', () => {
    const prompt = assembled();
    // §3a/§3b — the two sufficiencies
    expect(prompt).toContain('TARGET SUFFICIENCY');
    expect(prompt).toContain('MECHANISM SUFFICIENCY');
    // §6 — the three rungs
    expect(prompt).toContain('Rung 1');
    expect(prompt).toContain('Rung 2');
    expect(prompt).toContain('Rung 3');
    // §6 functional Rung 2 rule — no unconfirmed cause treated as true
    expect(prompt).toContain('without requiring an unconfirmed causal or mechanism hypothesis to be treated as true');
    // §7 stopping rule — Stage 1 must not become endless interviewing
    expect(prompt).toContain('discriminate hypotheses, increase decision-relevant sufficiency, or materially clarify the Target');
    // §6 high distress stays strict
    expect(prompt).toContain('never opens Rung 3');
  });
});

// ---------------------------------------------------------------------------
// 2. Reconciliation — no surviving "a cue licenses the work" reading
// ---------------------------------------------------------------------------

describe('reconciliation with the stage specs', () => {
  it('the canon header tells the model how to read stage Indications', () => {
    const prompt = assembled();
    expect(prompt).toContain('an indication is a reason to *consider* a mechanism, never permission to *use* it');
    expect(prompt).toContain("the Middle Layer's sufficiency gates take precedence");
  });

  // -------------------------------------------------------------------------
  // F1 / F2 — the two licensing ambiguities found by the pre-merge audit.
  //
  // F1: the header's cross-stage freedom ("if the user is doing
  //     foreign-material release work, use the Stage 5 playbook even if the
  //     router still labels them Stage 1") named a Rung-3 practice and
  //     attached no evidence condition, and it deleted the stage specs' own
  //     conjunctive gates by declaring stage numbers not capability gates.
  //     That was the surviving route to the original cue -> mechanism jump.
  //
  // F2: the operational layer states ONE gate for deep causal work —
  //     "gathered AND checked with the user". Under the Middle Layer that is
  //     Target Sufficiency and opens Rung 2 only. Left unmapped, the two
  //     sufficiencies had no expression in the layer where the model
  //     actually decides when to act.
  // -------------------------------------------------------------------------

  it('F1: reaching for a playbook is explicitly NOT permission to work at its depth', () => {
    const prompt = assembled();
    expect(prompt).toContain('reaching for a playbook is not permission to do the depth of work inside it');
    expect(prompt).toContain('Which playbook you open and how deep you go are two different decisions');
  });

  it('F1: Rung 3 work needs Mechanism Sufficiency whichever playbook it came from', () => {
    const prompt = assembled();
    expect(prompt).toContain('requires **Mechanism Sufficiency (§3b)**, in whichever stage\'s playbook you found it');
    // The four Rung-3 practices are named where the licence is granted, so
    // the fix reaches the exact examples the old wording invited.
    expect(prompt).toContain('foreign-material release, parts work advanced as a causal claim, deep imagery organised around a cause, identity-level work');
  });

  it('F1: cross-stage freedom SURVIVES — stage labels are not capability gates again', () => {
    const prompt = assembled();
    // The fix must not have re-imposed stage sequencing by the back door.
    expect(prompt).toContain('stage numbers remain bookkeeping and not capability gates');
    expect(prompt).toContain('you may reach for whichever stage\'s procedural methodology fits the work');
    expect(prompt).toContain('Stage numbers are a bookkeeping label for progression tracking; they are NOT capability gates.');
    // Rung 1 and Rung 2 work stays reachable from any playbook.
    expect(prompt).toContain('Rung 1 and Rung 2 work from any playbook remains open to you');
  });

  it('F2: gathered-and-checked is mapped to Target Sufficiency and Rung 2', () => {
    const prompt = assembled();
    expect(prompt).toContain('"Gathered and checked" is the Target gate, not the mechanism gate');
    expect(prompt).toContain('it is **Target Sufficiency (§3a)**');
    expect(prompt).toContain('establishes the **Target** and opens **Rung 2**');
  });

  it('F2: gathered-and-checked explicitly does NOT license Rung 3', () => {
    const prompt = assembled();
    expect(prompt).toContain('It does **not**, by itself, license causal or mechanism-level work');
    expect(prompt).toContain('**Rung 3 additionally requires Mechanism Sufficiency (§3b)**');
    // And the older wording is re-read rather than contradicted.
    expect(prompt).toContain('read it as "therefore Rung 2 is permitted"');
  });

  it('F2: the gather-before-depth rule is preserved, not removed', () => {
    const prompt = assembled();
    // Still necessary — just no longer sufficient for Rung 3.
    expect(prompt).toContain('That instruction stands and remains necessary');
    // The master prompt's own rule is untouched by PR 5.
    expect(prompt).toContain('never on the strength of one statement, image, metaphor or felt sense');
  });

  it('the precedence rule is scoped to licensing only — practice content untouched', () => {
    const prompt = assembled();
    expect(prompt).toContain('The Middle Layer overrides nothing about *how* any practice is done');
    expect(prompt).toContain('It governs only *whether you may do it yet*');
  });

  it('the Middle Layer is announced as one of the canon sources', () => {
    const prompt = assembled();
    expect(prompt).toContain('Four sources of clinical method');
    expect(prompt).toContain('**2. The Middle Layer**');
  });

  it('the Stage 5 indication list is still present — reconciled, not deleted', () => {
    // The clinical content of every spec stands exactly as written. Only
    // the LICENSING reading is overridden, and only by the header above.
    const prompt = assembled();
    expect(prompt).toContain('I feel pressure that isn\'t mine.');
  });

  it('the canon block still ends with the full stage playbooks', () => {
    const blocks = assembleSystemPromptBlocks(makeState());
    expect(blocks[0].text).toContain('ALL 8 STAGE SPECS');
    // Middle Layer sits BEFORE the playbooks it gates (§0).
    const canonIdx = blocks[0].text.indexOf('THE MIDDLE LAYER');
    const stagesIdx = blocks[0].text.indexOf('ALL 8 STAGE SPECS');
    expect(canonIdx).toBeGreaterThan(-1);
    expect(canonIdx).toBeLessThan(stagesIdx);
  });
});

// ---------------------------------------------------------------------------
// 3. Cache boundaries — block order and caching unchanged
// ---------------------------------------------------------------------------

describe('prompt structure is unchanged', () => {
  it('still exactly 4 blocks, with the same cache boundaries', () => {
    const blocks = assembleSystemPromptBlocks(makeState());
    expect(blocks).toHaveLength(4);
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[2].cache_control).toBeUndefined(); // dynamic state block
    expect(blocks[3].cache_control).toBeUndefined();
  });

  it('the Middle Layer is in the CACHED canon block, not the dynamic state block', () => {
    const blocks = assembleSystemPromptBlocks(makeState());
    expect(blocks[0].text).toContain('THE MIDDLE LAYER');
    expect(blocks[2].text).not.toContain('THE MIDDLE LAYER');
  });
});

// ---------------------------------------------------------------------------
// 4. The six investigation moves
// ---------------------------------------------------------------------------

describe('investigation moves', () => {
  it('all six are in the canonical vocabulary', () => {
    for (const m of INVESTIGATION_MOVES) expect(CANONICAL_MOVES_SET.has(m)).toBe(true);
  });

  it('CRITICAL: all six are universal.* so they cannot advance a stage', () => {
    // move-based-advance.ts counts only `stage_N.*` moves. Investigating
    // must never, by itself, push a user through a stage.
    for (const m of INVESTIGATION_MOVES) expect(m.startsWith('universal.')).toBe(true);
    const stageScoped = CANONICAL_MOVES.filter((m) => m.startsWith('stage_'));
    expect(stageScoped).toHaveLength(22); // unchanged by PR 5
  });

  it('each round-trips through the parser', () => {
    for (const m of INVESTIGATION_MOVES) {
      const r = parseStateReport(JSON.stringify({ ...BASE, moveJustPerformed: [m] }));
      expect(r.moveJustPerformed).toEqual([m]);
    }
  });

  it('they combine with existing moves', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        moveJustPerformed: ['universal.witness_and_reflect', 'universal.investigate_discriminate'],
      }),
    );
    expect(r.moveJustPerformed).toEqual([
      'universal.witness_and_reflect',
      'universal.investigate_discriminate',
    ]);
  });

  it('all six are documented in the master prompt', () => {
    const master = loadMasterJourneyPrompt() ?? '';
    for (const m of INVESTIGATION_MOVES) expect(master).toContain(m);
  });

  it('an invented investigation move is still dropped', () => {
    // Existing parser behaviour, unchanged by PR 5: unknown IDs are dropped
    // and an all-unknown array leaves the field absent. Adding six real IDs
    // must not soften the vocabulary check — "investigate_interpret" is
    // exactly the move the Middle Layer exists to prevent.
    const r = parseStateReport(
      JSON.stringify({ ...BASE, moveJustPerformed: ['universal.investigate_interpret'] }),
    );
    expect(r.moveJustPerformed).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Emission activation — the model can now produce PR 4b's evidence
// ---------------------------------------------------------------------------

describe('emission activation', () => {
  const EXCHANGES = [
    'recognitionOffered', 'recognitionConfirmed', 'recognitionContradicted',
    'mechanismOffered', 'mechanismConfirmed', 'mechanismContradicted',
    'instanceOffered', 'instanceConfirmed',
  ];

  it('every exchange field is documented in the master prompt', () => {
    const master = loadMasterJourneyPrompt() ?? '';
    for (const f of EXCHANGES) expect(master).toContain(f);
  });

  it('the Target and differential are documented', () => {
    const master = loadMasterJourneyPrompt() ?? '';
    expect(master).toContain('mechanismDifferential');
    expect(master).toContain('phenomenon');
    expect(master).toContain('inTheirTerms');
    expect(master).toContain('working_formulation');
  });

  it('the offer → LATER-turn discipline is taught, not just the field names', () => {
    const master = loadMasterJourneyPrompt() ?? '';
    expect(master).toContain('offer now, outcome later');
    expect(master).toContain('A confirmation emitted on the same turn as its offer is discarded');
  });

  it('the no-repeated-pressing rule is taught', () => {
    const master = loadMasterJourneyPrompt() ?? '';
    expect(master).toContain('Do not re-offer variations of the same formulation until they agree');
    expect(master).toContain('a correction is information');
  });

  it('a full Middle Layer report parses end to end', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        moveJustPerformed: ['universal.investigate_check'],
        taskContract: {
          currentFocus: 'the interview last week',
          target: {
            phenomenon: 'she accommodates, then attacks herself for the delay',
            inTheirTerms: 'I can never just say no in the moment',
            direction: 'to be able to decline in the moment',
            corroboration: ['the interview last week', 'her sister in March'],
            provenance: 'user',
            status: 'proposed',
          },
          mechanismDifferential: [
            { reading: 'an introjected rule about never excluding anyone', level: 'hypothesis', provenance: 'clinician' },
            { reading: 'a situational power response', level: 'observation' },
          ],
        },
        recognitionOffered: { recognition: 'I can never just say no in the moment' },
        instanceOffered: { instance: 'her sister in March' },
      }),
    );
    expect(r.taskContract?.target?.provenance).toBe('user');
    expect(r.taskContract?.mechanismDifferential).toHaveLength(2);
    expect(r.recognitionOffered).toEqual({ recognition: 'I can never just say no in the moment' });
    expect(r.instanceOffered).toEqual({ instance: 'her sister in March' });
  });

  it('LEGACY: a report with none of this still parses', () => {
    const r = parseStateReport(JSON.stringify({ ...BASE, moveJustPerformed: ['universal.witness_and_reflect'] }));
    expect(r.taskContract).toBeUndefined();
    expect(r.recognitionOffered).toBeUndefined();
    expect(r.mechanismOffered).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. PR 5 changed GUIDANCE, not GATES
// ---------------------------------------------------------------------------

describe('PR 5 activates emission, never enforcement', () => {
  it('code-owned stamps are still stripped from every exchange', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        recognitionConfirmed: { recognition: 'I can never say no', confirmedAt: '2026-01-01T00:00:00Z' },
        mechanismConfirmed: { reading: 'an introjected rule', offeredAt: 'now', contradictedAt: null },
      }),
    );
    expect(r.recognitionConfirmed).toEqual({ recognition: 'I can never say no' });
    expect(r.mechanismConfirmed).toEqual({ reading: 'an introjected rule' });
  });

  it('the model cannot emit a validated status or a licensed rung', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        licensedRung: 3,
        middleLayerTargetStatus: 'established',
        middleLayerMechanismStatus: 'established',
        taskContract: {
          currentFocus: 'the interview',
          target: { phenomenon: 'she accommodates anyway', status: 'established' },
        },
      }),
    );
    expect(r).not.toHaveProperty('licensedRung');
    expect(r).not.toHaveProperty('middleLayerTargetStatus');
    expect(r).not.toHaveProperty('middleLayerMechanismStatus');
    // 'established' is not a member of TARGET_STATUSES — dropped, not honoured.
    expect(r.taskContract?.target).not.toHaveProperty('status');
  });

  it('PR 6: the state block NOW carries the licensed rung', () => {
    // Inverted deliberately. Through PR 5 this asserted the rung was absent
    // — that was the proof PR 5 had not done PR 6's job. PR 6 renders it, so
    // the assertion inverts rather than being deleted. Still advisory:
    // nothing refuses work on the strength of it (PR 7 / PR 8).
    const blocks = assembleSystemPromptBlocks(makeState());
    expect(blocks[2].text).toMatch(/Licensed depth — Middle Layer rung 1/);
  });

  it('the state block carries the rung but not the Middle Layer manual', () => {
    // PR 6 adds a short dynamic fact block, never a second copy of the
    // canon. The manual stays in the cached block above it.
    const blocks = assembleSystemPromptBlocks(makeState());
    expect(blocks[2].text).toContain('## Current user state');
    expect(blocks[2].text).not.toContain('THE MIDDLE LAYER');
    expect(blocks[2].text).not.toContain('mechanismDifferential');
    expect(blocks[2].text).not.toContain('Everything you believe about the user sits at exactly one of four levels.');
  });
});
