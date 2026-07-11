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
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
    ...overrides,
  };
}

// The state block is the 4th block in the assembleSystemPromptBlocks array.
// PR λ (2026-07-11) — the assembled system prompt has 4 blocks now
// (was 5). The canon and per-stage spec were merged into one cached
// block so the AI has ALL 8 stage playbooks available. State block moved
// from index 3 → 2.
const STATE_BLOCK_INDEX = 2;

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
    // First-ever turn is NOT a continuation either — nothing to continue from.
    expect(stateText).not.toContain('CONTINUATION');
  });

  it('renders "just now" for a fresh turn within 30 minutes AND the same-session continuation directive (PR β)', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 0.1, isSessionResume: false }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Last user turn: just now.');
    expect(stateText).not.toContain('resumed session');
    // PR β continuation directive fires for <1h gap.
    expect(stateText).toContain('CONTINUATION of the current session');
    expect(stateText).toContain('Do NOT run a session-open ritual');
  });

  it('renders "today" and no session-resume for a 2-hour gap; also no continuation directive (>= 1h)', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 2, isSessionResume: false }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Last user turn: today.');
    expect(stateText).not.toContain('resumed session');
    // Over 1h — beyond the "user might still be right there" window; no
    // continuation directive. Neither a hard resume nor a hard continuation.
    expect(stateText).not.toContain('CONTINUATION');
  });

  it('renders the continuation directive at exactly 0.99h and drops it at 1.0h', () => {
    const under = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 0.99, isSessionResume: false }),
    );
    expect(under[STATE_BLOCK_INDEX].text).toContain('CONTINUATION');
    const at = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 1.0, isSessionResume: false }),
    );
    expect(at[STATE_BLOCK_INDEX].text).not.toContain('CONTINUATION');
  });

  it('does NOT render the continuation directive when isSessionResume is true (resume directive wins)', () => {
    // Belt-and-braces: even if hoursSinceLastTurn were somehow low but
    // isSessionResume is true (shouldn't happen, but tests defend the
    // branch), the resume directive should be the one that fires.
    const blocks = assembleSystemPromptBlocks(
      makeState({ hoursSinceLastTurn: 0.1, isSessionResume: true }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('This is a resumed session');
    expect(stateText).not.toContain('CONTINUATION');
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
            daysSinceLastConfirmed: 0,
          },
          {
            id: 'p2',
            category: 'mother_voice',
            userDescription: 'you should have asked me first',
            firstObservedAt: new Date('2026-06-15'),
            lastConfirmedAt: new Date('2026-07-04'),
            active: true,
            context: null,
            daysSinceLastConfirmed: 0,
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
            daysSinceLastConfirmed: 0,
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
      daysSinceLastConfirmed: 0,
    }));
    const blocks = assembleSystemPromptBlocks(makeState({ patterns: many }));
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('`pattern_0`');
    expect(stateText).toContain('`pattern_9`');
    expect(stateText).not.toContain('`pattern_10`');
    expect(stateText).not.toContain('`pattern_14`');
  });
});

describe('renderStateBlock — pattern staleness (Journey polish PR 6)', () => {
  function pattern(overrides: {
    category: string;
    daysSinceLastConfirmed: number;
  }) {
    return {
      id: `p_${overrides.category}`,
      category: overrides.category,
      userDescription: `words for ${overrides.category}`,
      firstObservedAt: new Date('2026-06-01'),
      lastConfirmedAt: new Date('2026-07-04'),
      active: true,
      context: null,
      daysSinceLastConfirmed: overrides.daysSinceLastConfirmed,
    };
  }

  it('omits the "last seen N days ago" tail when a pattern is under 7 days old', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        patterns: [pattern({ category: 'fresh_pattern', daysSinceLastConfirmed: 3 })],
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('`fresh_pattern`');
    expect(stateText).not.toContain('last seen');
    expect(stateText).not.toContain('haven\'t shown up recently');
  });

  it('adds the "last seen N days ago" tail from 7 days onward', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        patterns: [
          pattern({ category: 'week_old', daysSinceLastConfirmed: 7 }),
          pattern({ category: 'ten_days', daysSinceLastConfirmed: 10 }),
        ],
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('`week_old` — "words for week_old" — last seen 7 days ago');
    expect(stateText).toContain('`ten_days` — "words for ten_days" — last seen 10 days ago');
  });

  it('does NOT add the reconfirmation directive when it is not a resumed session, even with stale patterns', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        isSessionResume: false,
        patterns: [
          pattern({ category: 'old_pattern', daysSinceLastConfirmed: 30 }),
        ],
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('`old_pattern`');
    expect(stateText).toContain('last seen 30 days ago');
    expect(stateText).not.toContain("haven't shown up recently");
    expect(stateText).not.toContain('gently check with the user');
  });

  it('does NOT add the reconfirmation directive on a resumed session when all patterns are under 14 days', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        isSessionResume: true,
        hoursSinceLastTurn: 24 * 3,
        patterns: [
          pattern({ category: 'fresh', daysSinceLastConfirmed: 2 }),
          pattern({ category: 'still_active', daysSinceLastConfirmed: 13 }),
        ],
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).not.toContain("haven't shown up recently");
  });

  it('adds the reconfirmation directive on a resumed session when any pattern is >= 14 days stale', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        isSessionResume: true,
        hoursSinceLastTurn: 24 * 15,
        patterns: [
          pattern({ category: 'still_alive', daysSinceLastConfirmed: 2 }),
          pattern({ category: 'gone_quiet', daysSinceLastConfirmed: 18 }),
        ],
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain("Some patterns below haven't shown up recently");
    expect(stateText).toContain('gently check with the user in their own words');
    expect(stateText).toContain('never name the category label');
    expect(stateText).toContain('never lead');
    expect(stateText).toContain('`gone_quiet` — "words for gone_quiet" — last seen 18 days ago');
    // Fresh pattern still rendered but without the days-ago tail
    expect(stateText).toContain('`still_alive` — "words for still_alive"');
    expect(stateText).not.toContain('still_alive` — "words for still_alive" — last seen');
  });

  it('renders context, days-ago, and reconfirmation together correctly (existing test)', () => {
    // placeholder for correct chaining; the actual body is below (kept)
    expect(true).toBe(true);
  });
});

describe('renderStateBlock — Therapeutic Sensitivity Layer signals (PR α)', () => {
  it('omits all sensitivity lines when no signals are present', () => {
    const blocks = assembleSystemPromptBlocks(makeState({}));
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).not.toContain('A THERAPEUTIC CYCLE IS OPEN');
    expect(stateText).not.toContain('explicitly refused this session');
    expect(stateText).not.toContain('Recent channel shift detected');
  });

  it('renders the open-cycle warning when hasOpenCycle is true', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        hasOpenCycle: true,
        openCycleDescription: 'User in mid-somatic release, image not re-checked',
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('A THERAPEUTIC CYCLE IS OPEN');
    expect(stateText).toContain('Do NOT close this session');
    expect(stateText).toContain('cycleCanClose: true');
    expect(stateText).toContain('User in mid-somatic release');
  });

  it('renders the rejected-modality list when set', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ sessionRejectedModalities: ['body', 'breathing'] }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Modalities the user has explicitly refused this session');
    expect(stateText).toContain('body, breathing');
    expect(stateText).toContain('Do NOT re-offer these');
  });

  it('renders the channel-shift signal when true', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({ recentChannelShift: true }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('Recent channel shift detected');
    expect(stateText).toContain('in your <assessment> block');
  });

  it('renders all three signals together when the session has cycled hard', () => {
    const blocks = assembleSystemPromptBlocks(
      makeState({
        hasOpenCycle: true,
        openCycleDescription: 'mother_hysterical_attack fear discharge in progress',
        sessionRejectedModalities: ['grounding', 'breathing'],
        recentChannelShift: true,
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain('A THERAPEUTIC CYCLE IS OPEN');
    expect(stateText).toContain('mother_hysterical_attack');
    expect(stateText).toContain('grounding, breathing');
    expect(stateText).toContain('Recent channel shift detected');
  });
});

describe('renderStateBlock — pattern rendering with all context set', () => {
  it('renders context, days-ago, and reconfirmation together correctly', () => {
    const p = {
      id: 'p1',
      category: 'inner_child_wound',
      userDescription: 'the nine year old',
      firstObservedAt: new Date('2026-06-01'),
      lastConfirmedAt: new Date('2026-06-10'),
      active: true,
      context: { ageTag: 9 },
      daysSinceLastConfirmed: 24,
    };
    const blocks = assembleSystemPromptBlocks(
      makeState({
        isSessionResume: true,
        hoursSinceLastTurn: 24 * 24,
        patterns: [p],
      }),
    );
    const stateText = blocks[STATE_BLOCK_INDEX].text;
    expect(stateText).toContain("haven't shown up recently");
    expect(stateText).toContain(
      '`inner_child_wound` — "the nine year old" — context: ageTag: 9 — last seen 24 days ago',
    );
  });
});
