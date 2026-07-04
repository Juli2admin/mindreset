// Tests for the continuity-signals rendering added in PR 5 (Bundle C).
// The state block now surfaces: session count, distinct days engaged,
// this-session message count, and a "stage just advanced" callout when
// the code-side advancement fires.

import { describe, expect, it } from 'vitest';
import { assembleSystemPromptBlocks } from './assemble';
import type { JourneyState } from '../state/types';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_state_block_test',
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
    sessionCount: 1,
    daysEngaged: 1,
    thisSessionMessageCount: 0,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    ...overrides,
  };
}

// The state block is the 4th block in the assembleSystemPromptBlocks array.
const STATE_BLOCK_INDEX = 3;

describe('renderStateBlock — continuity signals (PR 5, Bundle C)', () => {
  it('surfaces sessionCount, daysEngaged, and this-session message count', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ sessionCount: 5, daysEngaged: 3, thisSessionMessageCount: 7 }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Sessions so far: 5');
    expect(stateText).toContain('distinct days engaged: 3');
    expect(stateText).toContain('message 8');
  });

  it('omits the stage-advanced callout when stageJustAdvanced is false', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ stageJustAdvanced: false }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).not.toContain('Stage just advanced');
  });

  it('emits the stage-advanced callout when stageJustAdvanced is true', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ currentStage: 8, stageJustAdvanced: true }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Stage just advanced to 8');
    expect(stateText).toContain('FIRST turn at the new stage');
    expect(stateText).toContain('session-open ritual');
  });
});

describe('renderStateBlock — time awareness (Journey polish PR 1)', () => {
  it('renders no "last user turn" line when there is no prior turn (first-ever turn)', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: null, isSessionResume: false }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).not.toContain('Last user turn');
    expect(stateText).not.toContain('resumed session');
  });

  it('renders "just now" for a fresh turn within 30 minutes', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 0.1, isSessionResume: false }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Last user turn: just now.');
    expect(stateText).not.toContain('resumed session');
  });

  it('renders "today" and no session-resume for a 2-hour gap', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 2, isSessionResume: false }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Last user turn: today.');
    expect(stateText).not.toContain('resumed session');
  });

  it('renders "yesterday" and adds session-resume note for a >4h gap', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 20, isSessionResume: true }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Last user turn: yesterday.');
    expect(stateText).toContain('This is a resumed session');
    expect(stateText).toContain('Gently re-anchor');
  });

  it('renders "a couple weeks ago" and session-resume for a 15-day gap', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 24 * 15, isSessionResume: true }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Last user turn: a couple weeks ago.');
    expect(stateText).toContain('This is a resumed session');
  });

  it('renders "months ago" for a very long gap', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 24 * 120, isSessionResume: true }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Last user turn: months ago.');
    expect(stateText).toContain('This is a resumed session');
  });
});
