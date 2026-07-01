// PR 3 — the readiness loop's rendering. The state block surfaces the current
// stage's outstanding completion criteria (computed read-only from the code
// gate) so the AI can steer toward them and evaluate advancement each turn.
// `outstanding`: null → render nothing; [] → "all met" advance nudge; a list →
// the outstanding milestones plus the per-turn evaluation instruction.

import { describe, expect, it } from 'vitest';
import { assembleSystemPromptBlocks } from './assemble';
import type { JourneyState } from '../state/types';

const STATE_BLOCK_INDEX = 3;

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_readiness_test',
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
    ...overrides,
  };
}

function stateText(outstanding: string[] | null): string {
  return assembleSystemPromptBlocks(makeState(), outstanding)[STATE_BLOCK_INDEX].text;
}

describe('renderReadinessSection', () => {
  it('renders nothing when outstanding is null (fresh / not evaluable)', () => {
    const text = stateText(null);
    expect(text).not.toContain('completing Stage');
    expect(text).not.toContain('completion criteria');
  });

  it('renders the advance nudge when all criteria are met ([])', () => {
    const text = stateText([]);
    expect(text).toContain('all tracked criteria are met');
    expect(text).toContain('recommendedAction');
    expect(text).toContain('advance');
  });

  it('lists outstanding milestones and the per-turn evaluation instruction', () => {
    const text = stateText([
      'A Personal Anchor is captured — a real, specific safe place or image in the user’s own words.',
      'The user is oriented to what this space is and how it works.',
    ]);
    expect(text).toContain('Toward completing Stage 1');
    expect(text).toContain('- A Personal Anchor is captured');
    expect(text).toContain('- The user is oriented');
    expect(text).toContain('Evaluate these every turn');
    // The "floor, not a script" guard against gaming the tokens.
    expect(text).toContain('floor');
  });

  it('does not disturb the 5-block structure or the state block index', () => {
    const blocks = assembleSystemPromptBlocks(makeState(), ['x']);
    expect(blocks).toHaveLength(5);
    expect(blocks[STATE_BLOCK_INDEX].text).toContain('Active internal stage: 1/8');
    // State block still uncached (dynamic).
    expect(blocks[STATE_BLOCK_INDEX].cache_control).toBeUndefined();
  });

  it('uses the current stage number in the heading', () => {
    const blocks = assembleSystemPromptBlocks(makeState({ currentStage: 5 }), ['some criterion']);
    expect(blocks[STATE_BLOCK_INDEX].text).toContain('Toward completing Stage 5');
  });
});
