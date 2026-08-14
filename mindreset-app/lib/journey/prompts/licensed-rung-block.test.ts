// Middle Layer PR 6 (2026-08-14) — the licensed rung in the state block.
//
// PR 4/4b derived the rung and persisted the two statuses; nothing showed
// them to anyone. PR 6 tells the Clinician, as platform fact, what depth its
// evidence currently licenses.
//
// ADVISORY. Nothing refuses a turn on the strength of it — that is PR 7
// (depth gate) and PR 8 (Rung-3 capture refusal). The tests below are
// weighted to two things: the rung shown is the PERSISTED code-owned one and
// not anything the model reported, and no enforcement arrived with it.

import { describe, expect, it } from 'vitest';
import { assembleSystemPromptBlocks } from './assemble';
import {
  normaliseMiddleLayerState,
  MIDDLE_LAYER_STATE_NONE,
  deriveLicensedRung,
  type MiddleLayerState,
} from '../middleLayer/sufficiency';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import type { JourneyState } from '../state/types';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_pr6', currentStage: 1, currentDepth: 'surface',
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
    middleLayer: MIDDLE_LAYER_STATE_NONE, workingMemory: null, ...overrides,
  };
}

/** The state block is block index 2 — dynamic, uncached. */
function stateBlock(ml: MiddleLayerState): string {
  return assembleSystemPromptBlocks(makeState({ middleLayer: ml }))[2].text;
}

const RUNG_2: MiddleLayerState = {
  targetStatus: 'established', mechanismStatus: 'leading', licensedRung: 2, neverEvaluated: false,
};
const RUNG_3: MiddleLayerState = {
  targetStatus: 'established', mechanismStatus: 'established', licensedRung: 3, neverEvaluated: false,
};

// ---------------------------------------------------------------------------
// 1. Normalisation — one rung rule, conservative fallback
// ---------------------------------------------------------------------------

describe('normaliseMiddleLayerState', () => {
  it('LEGACY: null columns → none/none, Rung 1', () => {
    const s = normaliseMiddleLayerState({ targetStatus: null, mechanismStatus: null });
    expect(s).toEqual({
      targetStatus: 'none', mechanismStatus: 'none', licensedRung: 1, neverEvaluated: true,
    });
  });

  it('missing columns entirely → Rung 1', () => {
    expect(normaliseMiddleLayerState({}).licensedRung).toBe(1);
  });

  it('Target established, mechanism not → Rung 2', () => {
    expect(
      normaliseMiddleLayerState({ targetStatus: 'established', mechanismStatus: 'leading' }).licensedRung,
    ).toBe(2);
  });

  it('mechanism established → Rung 3', () => {
    expect(
      normaliseMiddleLayerState({ targetStatus: 'established', mechanismStatus: 'established' }).licensedRung,
    ).toBe(3);
  });

  it('CORRUPT: unrecognised values fall back to none/none, Rung 1', () => {
    for (const bad of ['sufficient', 'ESTABLISHED', 'true', '', 'rung3', '1']) {
      const s = normaliseMiddleLayerState({ targetStatus: bad, mechanismStatus: bad });
      expect(s.targetStatus).toBe('none');
      expect(s.mechanismStatus).toBe('none');
      expect(s.licensedRung).toBe(1);
    }
  });

  it("'leading' is the model's claim and licenses nothing", () => {
    expect(normaliseMiddleLayerState({ mechanismStatus: 'leading' }).licensedRung).toBe(1);
    expect(
      normaliseMiddleLayerState({ targetStatus: 'established', mechanismStatus: 'leading' }).licensedRung,
    ).toBe(2);
  });

  it('NO DUPLICATED LOGIC: agrees with deriveLicensedRung on every combination', () => {
    // The normaliser must not contain a second rung rule. Every combination
    // of the two persisted statuses is checked against the one function PR 4
    // already uses in the shadow path.
    for (const t of ['none', 'proposed', 'established']) {
      for (const m of ['none', 'candidate', 'leading', 'established']) {
        expect(normaliseMiddleLayerState({ targetStatus: t, mechanismStatus: m }).licensedRung).toBe(
          deriveLicensedRung(t === 'established', m === 'established'),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Rendering — the three rungs
// ---------------------------------------------------------------------------

describe('state block — licensed rung', () => {
  it('RUNG 1 renders for a legacy / no-evidence user', () => {
    const b = stateBlock(MIDDLE_LAYER_STATE_NONE);
    expect(b).toContain('Licensed depth — Middle Layer rung 1');
    expect(b).toContain('Target: none · Mechanism: none');
  });

  it('RUNG 1 does NOT read as "do nothing"', () => {
    const b = stateBlock(MIDDLE_LAYER_STATE_NONE);
    expect(b).toContain('Rung 1 is open, and it is real work');
    expect(b).toContain('reflection, clarification, bounded answers, grounding');
    expect(b).toContain('not an instruction to hold back or to do nothing');
    expect(b).toContain('act as soon as an action is selectable');
  });

  it('RUNG 2 renders when the Target is established and the mechanism is not', () => {
    const b = stateBlock(RUNG_2);
    expect(b).toContain('Licensed depth — Middle Layer rung 2');
    expect(b).toContain('Target: established · Mechanism: leading');
  });

  it('RUNG 2 permits Target-serving work WITHOUT causal certainty', () => {
    const b = stateBlock(RUNG_2);
    expect(b).toContain('any clinically appropriate work that directly serves it is available **now**');
    expect(b).toContain('You do **not** need to know why the pattern runs to work on it');
    // The functional Rung 2 rule, verbatim in substance.
    expect(b).toContain('does not require an unconfirmed causal hypothesis to be treated as true');
  });

  it('RUNG 2 does NOT instruct endless investigation', () => {
    const b = stateBlock(RUNG_2);
    expect(b).toContain('Do not keep investigating for causal certainty this decision does not need');
    expect(b).toContain('another general clarifying question here is the failure');
    expect(b).toContain('advances *through* this work, not instead of it');
  });

  it('RUNG 3 renders ONLY when the mechanism is established', () => {
    const b = stateBlock(RUNG_3);
    expect(b).toContain('Licensed depth — Middle Layer rung 3');
    expect(b).toContain('Rung 3 is open');
    expect(b).toContain('deep causal work organised around **that** mechanism is licensed');
    // Not reachable from a merely leading mechanism.
    expect(stateBlock(RUNG_2)).not.toContain('Rung 3 is open');
    expect(stateBlock(MIDDLE_LAYER_STATE_NONE)).not.toContain('Rung 3 is open');
  });

  it('shows what is missing, scaled to the current rung', () => {
    expect(stateBlock(MIDDLE_LAYER_STATE_NONE)).toContain('To reach Rung 2');
    expect(stateBlock(RUNG_2)).toContain('To reach Rung 3');
    // Nothing to chase once Rung 3 is open.
    expect(stateBlock(RUNG_3)).not.toContain('To reach Rung');
  });
});

// ---------------------------------------------------------------------------
// 3. The rung is platform fact, not the model's
// ---------------------------------------------------------------------------

describe('provenance of the rendered rung', () => {
  it('is framed as platform-derived, not the model\'s assessment', () => {
    const b = stateBlock(RUNG_2);
    expect(b).toContain('platform-derived fact, not your assessment');
    expect(b).toContain('Derived by code from persisted evidence');
    expect(b).toContain('You do not set this and cannot raise it');
  });

  it('names the specific routes that must NOT raise it', () => {
    const b = stateBlock(RUNG_2);
    expect(b).toContain('naming a cue, matching a playbook, recognising a stage pattern, or reporting a formulation as settled');
    expect(b).toContain('a status you emit is a claim, and this line is the finding');
  });

  it('CRITICAL: the rendered rung tracks the PERSISTED state, not the stored contract', () => {
    // A contract whose model-emitted target claims status 'held' — with NO
    // persisted evidence behind it — must still render Rung 1.
    const b = assembleSystemPromptBlocks(
      makeState({
        middleLayer: MIDDLE_LAYER_STATE_NONE,
        taskContract: {
          presentingRequest: 'I freeze when people ask me for things',
          target: {
            phenomenon: 'she accommodates anyway and then attacks herself',
            inTheirTerms: 'I can never just say no',
            direction: 'to decline in the moment',
            corroboration: ['the interview', 'her sister'],
            provenance: 'user',
            status: 'held',
          },
        },
      }),
    )[2].text;
    expect(b).toContain('Licensed depth — Middle Layer rung 1');
    expect(b).toContain('Target: none · Mechanism: none');
  });
});

// ---------------------------------------------------------------------------
// 4. Stage bookkeeping vs rung licensing
// ---------------------------------------------------------------------------

describe('rung governs depth, stage label stays bookkeeping', () => {
  it('says so explicitly, next to the rung', () => {
    const b = stateBlock(RUNG_2);
    expect(b).toContain('It governs **depth only**');
    expect(b).toContain("which stage's methodology you consult is entirely your call");
    expect(b).toContain('all 8 playbooks remain available');
    expect(b).toContain('the stage label below stays bookkeeping');
  });

  it('the existing stage-label line is unchanged and still says bookkeeping', () => {
    const b = stateBlock(RUNG_3);
    expect(b).toContain("Router's stage label: 1/8 (bookkeeping");
    expect(b).toContain("reach for whichever stage's methodology fits the actual work this turn");
  });

  it('the rung block sits before the stage label, not instead of it', () => {
    const b = stateBlock(RUNG_2);
    expect(b.indexOf('Licensed depth')).toBeLessThan(b.indexOf("Router's stage label"));
  });
});

// ---------------------------------------------------------------------------
// 5. Advisory only — no enforcement arrived with it
// ---------------------------------------------------------------------------

describe('PR 6 is advisory', () => {
  it('does not refuse, block, or forbid anything', () => {
    for (const ml of [MIDDLE_LAYER_STATE_NONE, RUNG_2, RUNG_3]) {
      const b = stateBlock(ml);
      expect(b).not.toMatch(/you may not|is refused|is blocked|forbidden|will be rejected/i);
    }
  });

  it('the canon block is untouched by PR 6', () => {
    // The Middle Layer manual stays exactly where PR 5 put it, once.
    const blocks = assembleSystemPromptBlocks(makeState({ middleLayer: RUNG_3 }));
    const marker = 'Everything you believe about the user sits at exactly one of four levels.';
    expect(blocks[0].text.split(marker)).toHaveLength(2);
    expect(blocks.map((x) => x.text).join('\n').split(marker)).toHaveLength(2);
  });

  it('block count and cache boundaries are unchanged', () => {
    const blocks = assembleSystemPromptBlocks(makeState({ middleLayer: RUNG_3 }));
    expect(blocks).toHaveLength(4);
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[2].cache_control).toBeUndefined();
    expect(blocks[3].cache_control).toBeUndefined();
  });

  it('the rung block is short — a fact block, not a second manual', () => {
    // Guards against the state block quietly growing into a duplicate canon.
    const b = stateBlock(RUNG_2);
    const start = b.indexOf('Licensed depth');
    const end = b.indexOf("Router's stage label");
    expect(end - start).toBeLessThan(2500);
  });

  it('every rung renders without throwing, for every status combination', () => {
    for (const t of ['none', 'proposed', 'established']) {
      for (const m of ['none', 'candidate', 'leading', 'established']) {
        const ml = normaliseMiddleLayerState({ targetStatus: t, mechanismStatus: m });
        expect(() => stateBlock(ml)).not.toThrow();
        expect(stateBlock(ml)).toContain(`Middle Layer rung ${ml.licensedRung}`);
      }
    }
  });
});
