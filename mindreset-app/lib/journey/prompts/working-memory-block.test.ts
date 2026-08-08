// Rendering tests for the Clinician Working Memory section (2026-08-08).
//
// Two things are being protected here:
//   1. The section restates recorded facts and NOTHING ELSE. Code must never
//      write a clinical conclusion into the prompt.
//   2. Absent data produces no output at all — no empty scaffolding, no
//      defaults, no "unknown".

import { describe, expect, it } from 'vitest';
import { assembleSystemPromptBlocks } from './assemble';
import type { ClinicalWorkingMemory, JourneyState } from '../state/types';
import { CLOSURE_PROCESS_NONE } from '../closure/process';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_wm_block_test',
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

const EMPTY_WM: ClinicalWorkingMemory = {
  activation: null,
  safety: null,
  practices: [],
  formulationDeltas: [],
  requestStatus: null,
  cycleStatus: null,
  adultSelf: null,
  stability: null,
  distress: null,
};

/** The dynamic state block is the third system block. */
function stateBlock(state: JourneyState): string {
  return assembleSystemPromptBlocks(state)[2].text;
}

describe('working-memory section — absence', () => {
  it('renders nothing when workingMemory is null', () => {
    expect(stateBlock(makeState())).not.toContain('Clinical working memory from earlier in this session');
  });

  it('renders nothing when every member is empty', () => {
    expect(stateBlock(makeState({ workingMemory: EMPTY_WM }))).not.toContain(
      'Clinical working memory from earlier in this session',
    );
  });

  it('omits concepts that have no data instead of defaulting them', () => {
    const text = stateBlock(
      makeState({
        workingMemory: { ...EMPTY_WM, cycleStatus: 'open' },
      }),
    );
    expect(text).toContain('Clinical working memory from earlier in this session');
    expect(text).toContain('**open**');
    expect(text).not.toContain('Activation');
    expect(text).not.toContain('safety read');
    expect(text).not.toContain('stability reading');
    expect(text).not.toContain('presenting request');
  });
});

describe('working-memory section — restatement only', () => {
  it('states the trajectory arithmetically, without judging it', () => {
    const text = stateBlock(
      makeState({
        workingMemory: {
          ...EMPTY_WM,
          activation: { readings: [3, 5, 8], max: 8, direction: 'rising' },
        },
      }),
    );
    expect(text).toContain('3 → 5 → 8');
    expect(text).toContain('has risen');
    expect(text).toContain('highest 8');
    // Interpretation the data does not contain.
    expect(text).not.toContain('deteriorat');
    expect(text).not.toContain('destabilis');
  });

  it('states practice status without claiming an effect', () => {
    const text = stateBlock(
      makeState({
        workingMemory: {
          ...EMPTY_WM,
          practices: [
            {
              family: 'somatic',
              name: 'Micro-movement (shoulders)',
              status: 'aborted_overwhelm',
              modalitySwitched: null,
            },
          ],
        },
      }),
    );
    expect(text).toContain('Micro-movement (shoulders)');
    expect(text).toContain("stopped as the user's window of tolerance was being exceeded");
    expect(text).toContain('How each one landed is not recorded');
    expect(text).not.toContain('helped');
    expect(text).not.toContain('did not work');
  });

  it('attributes the request status rather than asserting it', () => {
    const text = stateBlock(
      makeState({ workingMemory: { ...EMPTY_WM, requestStatus: 'addressed' } }),
    );
    expect(text).toContain('You last recorded the presenting request as **addressed**');
  });

  it('keeps scale, source and age with a stability reading', () => {
    const text = stateBlock(
      makeState({
        workingMemory: {
          ...EMPTY_WM,
          stability: { score: 7, scale: 'stability', source: 'user_reported', ageMinutes: 3 },
        },
      }),
    );
    expect(text).toContain('7/10');
    expect(text).toContain('on the stability scale');
    expect(text).toContain('user_reported');
    expect(text).toContain('3 min ago');
  });

  it('reports an unestablished scale as state, without any closing verdict', () => {
    const text = stateBlock(
      makeState({
        workingMemory: {
          ...EMPTY_WM,
          stability: { score: 8, scale: 'ambiguous', source: 'user_reported', ageMinutes: 1 },
        },
      }),
    );
    expect(text).toContain('scale not established');
    // Closing is out of scope for working memory — it reports state only.
    expect(text).not.toContain('validate a close');
    expect(text).not.toContain('cannot close');
  });

  it('marks prior reasoning as provisional', () => {
    const text = stateBlock(
      makeState({
        workingMemory: {
          ...EMPTY_WM,
          formulationDeltas: [{ turnsAgo: 1, text: 'Holding a parts reading lightly.' }],
        },
      }),
    );
    expect(text).toContain('Holding a parts reading lightly.');
    expect(text).toContain('last turn');
    expect(text).toContain('Prior interpretations are provisional');
    expect(text).toContain("use the user's current message as the primary signal");
  });

  it("does not render a closed cycle as if material were still open", () => {
    const text = stateBlock(makeState({ workingMemory: { ...EMPTY_WM, cycleStatus: 'closed' } }));
    expect(text).not.toContain('Clinical working memory from earlier in this session');
  });
});

describe('working-memory section — placement', () => {
  it('sits above the historical-context divider, not below it', () => {
    const text = stateBlock(
      makeState({
        continuityNote: 'prior session notes here',
        workingMemory: { ...EMPTY_WM, cycleStatus: 'open' },
      }),
    );
    const wmIdx = text.indexOf('Clinical working memory from earlier in this session');
    const historicalIdx = text.indexOf('Historical context — not fact');
    expect(wmIdx).toBeGreaterThan(-1);
    expect(historicalIdx).toBeGreaterThan(-1);
    expect(wmIdx).toBeLessThan(historicalIdx);
  });

  it('leaves the existing open-cycle banner untouched', () => {
    const text = stateBlock(
      makeState({
        hasOpenCycle: true,
        openCycleDescription: 'cycle context here',
        workingMemory: { ...EMPTY_WM, cycleStatus: 'open' },
      }),
    );
    expect(text).toContain('A THERAPEUTIC CYCLE IS OPEN');
    expect(text).toContain('Context from the last open-cycle turn: "cycle context here"');
  });
});
