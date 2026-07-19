// Journey remediation 2026-07-19 — behavioural fixtures A–I.
//
// Deterministic assertions over the mechanics the LLM operates within:
// prompt content (what the clinician is instructed to do), parser/merge
// behaviour (what survives a turn), gates and schema (what can progress).
// Companions:
//   - fixture A also in prompts/state-block.test.ts (cognitive channel render)
//   - fixture G also in router/stage1-gate.test.ts (no-anchor pass)
//   - fixture I also in router/open-cycle-guard.test.ts (router guard)

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt, sharedCore } from './prompts/load-spec';
import { parseTaskContract, parseWorkingPreferenceNoted, parseStateReport } from './stateReport/parse';
import { mergeTaskContract, mergeWorkingPreferences } from './state/save';
import { NEXT_BEST_MODES } from './stateReport/schema';
import { checkStage5Gate } from './router/stage-gates';
import { checkMoveBasedAdvance } from './router/move-based-advance';
import { assembleSystemPromptBlocks } from './prompts/assemble';
import type { JourneyState, JourneyForeignFile, StoredWorkingPreference } from './state/types';
import type { AuditTurn } from './router/history';
import type { StateReport } from './stateReport/schema';

const master = loadMasterJourneyPrompt() ?? '';
const core = sharedCore();

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_fixtures',
    currentStage: 1,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-20'),
    lastActivityAt: new Date('2026-06-26'),
    dischargedAt: null,
    anchorText: null,
    anchorSetAt: null,
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'cognitive',
    adultSelfQualities: null,
    lastIntensity: 4,
    lastIntensityAt: new Date('2026-06-26'),
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
    sessionCount: 2,
    daysEngaged: 3,
    thisSessionMessageCount: 4,
    stageJustAdvanced: false,
    hoursSinceLastTurn: 1,
    isSessionResume: false,
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
    taskContract: null,
    workingPreferences: [],
    practiceHistory: [],
    ...overrides,
  };
}

function makeTurn(daysAgo: number, report: Partial<StateReport> = {}): AuditTurn {
  const d = new Date('2026-06-26');
  d.setDate(d.getDate() - daysAgo);
  const fullReport: StateReport = {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...report,
  };
  return {
    id: `turn_${daysAgo}_${Math.random().toString(36).slice(2)}`,
    createdAt: d,
    stageAtTurn: 1,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

function stateBlockText(state: JourneyState): string {
  const blocks = assembleSystemPromptBlocks(state);
  // Block 2 (index 2) is the dynamic state block — see assemble.ts.
  return blocks[2].text;
}

// ---------------------------------------------------------------------------
// Fixture A — cognitive pattern user
// ---------------------------------------------------------------------------
describe('fixture A — cognitive work is valid; no automatic body redirect', () => {
  it('master prompt no longer carries the standing cognitive→body redirect', () => {
    expect(master).not.toContain('does not stay in the head');
    expect(master).not.toContain("doesn't stay in the head");
  });

  it('master prompt authorises structured cognitive work as complete work', () => {
    expect(master).toContain('Staying cognitive is valid work');
    expect(master).toContain('belief examination');
    expect(master).toContain('sentence deconstruction');
  });

  it('the clinician can recommend staying cognitive (NEXT_BEST_MODES)', () => {
    expect(NEXT_BEST_MODES).toContain('stay_cognitive');
    expect(NEXT_BEST_MODES).toContain('stay_narrative');
    expect(NEXT_BEST_MODES).toContain('stay_current_mode');
    expect(NEXT_BEST_MODES).toContain('cognitive_belief_work');
    expect(NEXT_BEST_MODES).toContain('clarify_task');
    expect(NEXT_BEST_MODES).toContain('continue_assessment');
    expect(NEXT_BEST_MODES).toContain('contain');
    expect(NEXT_BEST_MODES).toContain('pause_step_back');
  });

  it('parts work is framed as available-if-justified, not the door for analysis', () => {
    // Example 3's old annotation taught converting analysis into parts work.
    expect(master).not.toContain('opens parts territory through their analytical door');
    expect(master).toContain('not the first move');
  });

  it('no evidence quota: the "nearly every turn" token expectation is gone', () => {
    expect(master).not.toContain('SHOULD be firing on nearly every turn');
    expect(master).toContain('never ask for a feeling in order to produce this token');
    expect(master).toContain('never fish for a body location');
  });
});

// ---------------------------------------------------------------------------
// Fixture B — non-visual user: preference preserved across sessions
// ---------------------------------------------------------------------------
describe('fixture B — non-visual user preference persists and renders', () => {
  const noted = parseWorkingPreferenceNoted([
    { text: 'imagery does not work for me', kind: 'refusal' },
  ])!;

  it('parses and merges the refusal into durable preferences', () => {
    const merged = mergeWorkingPreferences([], noted, [], new Date('2026-06-25'));
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe('refusal');
  });

  it('renders durable preferences with a do-not-re-offer instruction (survives session boundaries by construction — stored on RecodeProgress, not session-derived)', () => {
    const prefs: StoredWorkingPreference[] = [
      { text: 'imagery does not work for me', kind: 'refusal', notedAt: '2026-06-25T10:00:00Z' },
    ];
    const text = stateBlockText(makeState({ workingPreferences: prefs, isSessionResume: true }));
    expect(text).toContain('imagery does not work for me');
    expect(text).toContain('Do not re-offer refused modalities');
  });

  it('only an explicit user revision clears a preference', () => {
    const existing: StoredWorkingPreference[] = [
      { text: 'imagery does not work for me', kind: 'refusal', notedAt: '2026-06-25T10:00:00Z' },
    ];
    const untouched = mergeWorkingPreferences(existing, [], []);
    expect(untouched).toHaveLength(1);
    const cleared = mergeWorkingPreferences(existing, [], ['imagery does not work']);
    expect(cleared).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture C — emotionally numb user
// ---------------------------------------------------------------------------
describe('fixture C — numb user: no interrogation, and not trapped in Stage 1', () => {
  it('master prompt has a numb/low-access route that forbids sensation-interrogation', () => {
    expect(master).toContain('do NOT interrogate for missing sensations');
    expect(master).toContain('behavioural evidence');
    expect(master).toContain('Absence of emotion words is not absence of clinical work');
  });

  it('move-based lane advances sustained real work with ZERO emotion/body tokens', () => {
    // Regulated user doing sustained stage-2 work, never emitting
    // emotion_named / body_located readiness tokens.
    const turns = [
      makeTurn(3, { moveJustPerformed: ['stage_2.soft_why_inquiry'], adultSelfPresent: true }),
      makeTurn(2, { moveJustPerformed: ['stage_2.soft_why_inquiry'], adultSelfPresent: true }),
      makeTurn(1, { moveJustPerformed: ['stage_2.affect_labelling_and_somatic_mapping'], adultSelfPresent: true }),
    ];
    const result = checkMoveBasedAdvance(1, turns);
    expect(result.canAdvance).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture D — suitable parts-work user: authored method not weakened
// ---------------------------------------------------------------------------
describe('fixture D — parts methodology intact', () => {
  it('parts move retains safe distance, Adult Self presence, one-part discipline', () => {
    expect(master).toContain('Safe distance first');
    expect(master).toContain('The Adult Self should be present');
    expect(master).toContain('One part at a time');
  });

  it('open activation still blocks closing (cycle rules intact)', () => {
    expect(master).toContain('DO NOT end the session while any of these hold');
    expect(master).toContain('guide safe completion');
  });
});

// ---------------------------------------------------------------------------
// Fixture E — original request preservation
// ---------------------------------------------------------------------------
describe('fixture E — the presenting request survives emerging material', () => {
  const original = {
    presentingRequest: 'understand why I repeat the same relationship pattern',
    currentFocus: 'mapping the pattern across relationships',
  };

  it('an emerging-material turn updates focus without erasing the request', () => {
    const merged = mergeTaskContract(original, {
      currentFocus: 'the childhood memory that surfaced with mother',
    });
    expect(merged?.presentingRequest).toBe(original.presentingRequest);
    expect(merged?.currentFocus).toBe('the childhood memory that surfaced with mother');
  });

  it('empty/generic model output cannot erase a valid contract (parser drops it)', () => {
    expect(parseTaskContract({ presentingRequest: '', currentFocus: 'n/a' })).toBeUndefined();
    expect(parseTaskContract({ presentingRequest: 'unknown' })).toBeUndefined();
    // And merge ignores sub-minimum values even if handed directly:
    const merged = mergeTaskContract(original, { presentingRequest: '' });
    expect(merged?.presentingRequest).toBe(original.presentingRequest);
  });

  it('the contract renders into the clinician context with the reconnect instruction', () => {
    const text = stateBlockText(makeState({ taskContract: original }));
    expect(text).toContain(original.presentingRequest);
    expect(text).toContain('does not replace the presenting request');
  });

  it('closure instructions require addressing or explicitly parking the request', () => {
    expect(master).toContain('Has the presenting request been addressed?');
    expect(master).toContain('neither addressed nor explicitly parked');
  });
});

// ---------------------------------------------------------------------------
// Fixture F — false release
// ---------------------------------------------------------------------------
describe('fixture F — a claimed release is provisional and invalidatable', () => {
  function makeFile(overrides: Partial<JourneyForeignFile> = {}): JourneyForeignFile {
    return {
      id: 'ff_1',
      userDescription: 'I must always be useful',
      originDescription: 'my mother',
      returnedTo: null,
      honouringPhrase: null,
      whatStaysAsMine: null,
      identifiedAt: new Date('2026-06-20'),
      releaseClaimedAt: null,
      releasedAt: null,
      ...overrides,
    };
  }

  const stage5PassingTurns = [
    makeTurn(5, { adultSelfPresent: true }),
    makeTurn(4, { adultSelfPresent: true }),
    makeTurn(3, { somaticRelease: true, adultSelfPresent: true }),
    makeTurn(2, {
      cleanIdentityStatement: 'this is mine; that is not mine',
      bodyConfirmation: 'chest open, breathing free',
      adultSelfPresent: true,
    }),
    makeTurn(1, { recommendedAction: 'advance', adultSelfPresent: true }),
  ];

  it('a claimed-but-unconfirmed release does NOT pass the Stage 5 gate', () => {
    const state = makeState({
      currentStage: 5,
      anchorText: 'the bench under the apple tree',
      foreignFiles: [makeFile({ releaseClaimedAt: new Date('2026-06-24') })],
    });
    const result = checkStage5Gate(state, stage5PassingTurns);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('no_symbolic_return_completed');
  });

  it('a confirmed release (releasedAt set) passes the same gate', () => {
    const state = makeState({
      currentStage: 5,
      anchorText: 'the bench under the apple tree',
      foreignFiles: [
        makeFile({
          releaseClaimedAt: new Date('2026-06-24'),
          releasedAt: new Date('2026-06-25'),
        }),
      ],
    });
    const result = checkStage5Gate(state, stage5PassingTurns);
    expect(result.passed).toBe(true);
  });

  it('parser accepts releaseInvalidated so the next user response can reopen the work', () => {
    const report = parseStateReport(
      JSON.stringify({
        intensity: 6,
        safetyFlag: 'none',
        recommendedAction: 'stay',
        releaseInvalidated: { description: 'I must always be useful', reason: 'user feels worse today' },
      }),
    );
    expect(report.releaseInvalidated?.description).toBe('I must always be useful');
  });

  it('render labels a claimed release as PROVISIONAL in the clinician context', () => {
    const text = stateBlockText(
      makeState({ foreignFiles: [makeFile({ releaseClaimedAt: new Date('2026-06-24') })] }),
    );
    expect(text).toContain('PROVISIONAL');
    expect(text).toContain('can invalidate it');
  });

  it('master prompt instructs: worse-after-release means the process is open', () => {
    expect(master).toContain('A release is a hypothesis until the user confirms it');
    expect(master).toContain('OPEN, not finished');
  });
});

// ---------------------------------------------------------------------------
// Fixture G/H — anchor: not indicated vs indicated
// ---------------------------------------------------------------------------
describe('fixtures G/H — anchor is clinically indicated, not universal', () => {
  it('G: master prompt states absence of an anchor never blocks a stable user', () => {
    expect(master).toContain('NOT a universal requirement');
    expect(master).toContain('never blocks their progress');
  });

  it('H: master prompt keeps anchor work indicated for freeze / numbness / disconnection', () => {
    expect(master).toContain('When anchor work is clinically indicated');
    expect(master).toContain('freeze states');
    expect(master).toContain('severe disconnection');
  });

  it('H: anchor is not a repetitive generic grounding lever (existing discipline retained)', () => {
    expect(master).toContain('It is not a lever to pull when they wobble');
  });
});

// ---------------------------------------------------------------------------
// Fixture I — closure safety (prompt layer; router layer in open-cycle-guard.test.ts)
// ---------------------------------------------------------------------------
describe('fixture I — active process cannot close as completed', () => {
  it('closure check exists and forbids closing on surface markers', () => {
    expect(master).toContain('The closure check');
    expect(master).toContain('Do NOT close merely because');
    expect(master).toContain("the user's tone became calmer");
  });

  it('containment or an explicit safe stopping point is required when completion is unreachable', () => {
    expect(master).toContain('CONTAIN the material or establish an explicit safe stopping point');
  });

  it('no forced positive endings', () => {
    expect(master).toContain('do not force a positive ending');
  });
});

// ---------------------------------------------------------------------------
// Shared Core — decision boundaries (Phase 9)
// ---------------------------------------------------------------------------
describe('decision boundaries (Phase 9)', () => {
  it('Shared Core permits working around a decision without advising', () => {
    expect(core).toContain('never tells the user what to choose');
    expect(core).toContain('The choice always remains the user');
  });

  it('master prompt Trap 2 keeps the no-push rule and adds the boundary list', () => {
    expect(master).toContain('Do NOT push toward');
    expect(master).toContain('never decide for the user');
  });
});
