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
    patterns: [],
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

describe('renderStateBlock — channel-family guidance (Journey polish PR 3)', () => {
  it('omits the guidance line when processingChannel is null', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ processingChannel: null }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).not.toContain('Processing channel detected');
    expect(stateText).not.toContain('Prefer landscape');
    expect(stateText).not.toContain('Prefer somatic');
    expect(stateText).not.toContain('Prefer compassion');
    expect(stateText).not.toContain('Prefer narrative');
  });

  it('renders landscape-family preference for a visual channel', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ processingChannel: 'visual' }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Processing channel detected: visual');
    expect(stateText).toContain('Prefer landscape-family practices');
    expect(stateText).toContain('inner room');
    expect(stateText).toContain('Reach for regulation only if safety needs grounding');
  });

  it('renders somatic-family preference for a kinesthetic channel', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ processingChannel: 'kinesthetic' }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Processing channel detected: kinesthetic');
    expect(stateText).toContain('Prefer somatic-family practices');
    expect(stateText).toContain('body scan');
  });

  it('renders compassion-family preference for an emotional channel', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ processingChannel: 'emotional' }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Processing channel detected: emotional');
    expect(stateText).toContain('Prefer compassion-family practices');
    expect(stateText).toContain('affect labelling');
  });

  it('renders narrative-family + body-location invitation for a cognitive channel', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ processingChannel: 'cognitive' }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Processing channel detected: cognitive');
    expect(stateText).toContain('Prefer narrative-family practices');
    expect(stateText).toContain('invite body location');
  });

  it('renders narrative-family preference for a verbal channel', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ processingChannel: 'verbal' }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Processing channel detected: verbal');
    expect(stateText).toContain('Prefer narrative-family practices');
    expect(stateText).toContain('user is working through words');
  });

  it('renders a two-family weave hint for a mixed channel', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ processingChannel: 'mixed' }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Processing channel detected: mixed');
    expect(stateText).toContain('Weave two families');
    expect(stateText).toContain('do not default to regulation');
  });
});

describe('renderStateBlock — unresolved patterns (Journey polish PR 5)', () => {
  it('omits the patterns section entirely when patterns is empty', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ patterns: [] }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).not.toContain('Unresolved patterns');
  });

  it('renders each pattern with category + user-words description', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        patterns: [
          {
            id: 'p1',
            category: 'fear_of_visibility',
            userDescription: 'I hide when people watch',
            firstObservedAt: new Date('2026-06-01'),
            lastConfirmedAt: new Date('2026-07-04'),
            active: true,
            context: null,
          },
          {
            id: 'p2',
            category: 'mother_voice',
            userDescription: 'you should have asked me first',
            firstObservedAt: new Date('2026-06-15'),
            lastConfirmedAt: new Date('2026-07-04'),
            active: true,
            context: null,
          },
        ],
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Unresolved patterns');
    expect(stateText).toContain('`fear_of_visibility`');
    expect(stateText).toContain('I hide when people watch');
    expect(stateText).toContain('`mother_voice`');
    expect(stateText).toContain('you should have asked me first');
    expect(stateText).toContain('working notes');
    expect(stateText).toContain('not diagnosis');
  });

  it('renders context inline when set', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        patterns: [
          {
            id: 'p1',
            category: 'inner_child_wound',
            userDescription: 'the nine year old with hands together',
            firstObservedAt: new Date('2026-06-01'),
            lastConfirmedAt: new Date('2026-07-04'),
            active: true,
            context: { ageTag: 9 },
          },
        ],
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('`inner_child_wound`');
    expect(stateText).toContain('context: ageTag: 9');
  });

  it('caps the render at 10 patterns even when more exist', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: `p${i}`,
      category: `pattern_${i}`,
      userDescription: `words ${i}`,
      firstObservedAt: new Date('2026-06-01'),
      lastConfirmedAt: new Date('2026-07-04'),
      active: true,
      context: null,
    }));
    const blocks = assembleSystemPromptBlocks(makeState({ patterns: many }));
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('`pattern_0`');
    expect(stateText).toContain('`pattern_9`');
    expect(stateText).not.toContain('`pattern_10`');
    expect(stateText).not.toContain('`pattern_14`');
  });
});
