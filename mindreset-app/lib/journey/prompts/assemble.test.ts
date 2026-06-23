// Test for the new 3-layer system-prompt assembly (architecture refactor
// 2026-06-23).
//
// Confirms that assembleSystemPrompt produces a system prompt containing:
//   1. The master prompt body (general AI behavior)
//   2. The Shared Core canon doc (clinical constitution)
//   3. The active stage spec doc (current stage's full method content)
//
// Before the refactor, only the master prompt was loaded; canon docs were
// reviewable reference material for humans only. The audit on 2026-06-19
// showed this produced a ~70:1 conversation-to-practice ratio because the
// master's "moves" section is a compressed summary of canon. The refactor
// loads canon as the source of method.

import { describe, expect, it } from 'vitest';
import {
  assembleSystemPrompt,
  assembleSystemPromptBlocks,
} from './assemble';
import type { JourneyState } from '../state/types';

function makeState(stage: number): JourneyState {
  return {
    userId: 'user_assembly_test',
    currentStage: stage,
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
    sessionCount: 0,
    daysEngaged: 0,
    thisSessionMessageCount: 0,
    stageJustAdvanced: false,
  };
}

describe('assembleSystemPrompt — 3-layer architecture', () => {
  it('includes the master prompt body', () => {
    const prompt = assembleSystemPrompt(makeState(1));
    // Master has the <method> tag (8-moves toolkit)
    expect(prompt).toContain('<method>');
    // Master has the trap list intro
    expect(prompt).toContain('Clinical pitfalls that can undo good work');
  });

  it('includes the Shared Core canon doc', () => {
    const prompt = assembleSystemPrompt(makeState(1));
    expect(prompt).toContain('# CLINICAL METHOD SOURCE');
    expect(prompt).toContain('## SHARED CORE');
    // Shared Core has these section headers
    expect(prompt).toContain('## 5. Practice Generation Algorithm');
    expect(prompt).toContain('## 7. The Red Flag Protocol');
    expect(prompt).toContain('## 8. The Persistent Inner Landscape');
  });

  it('includes the active stage spec for Stage 1', () => {
    const prompt = assembleSystemPrompt(makeState(1));
    expect(prompt).toContain('## ACTIVE STAGE SPEC');
    // Stage 1 spec has Personal Anchor practice
    expect(prompt).toContain('Personal Anchor Identification');
  });

  it('switches the active stage spec when currentStage changes', () => {
    const stage4 = assembleSystemPrompt(makeState(4));
    // Stage 4 spec talks about parts work and MII
    expect(stage4).toContain('Compassion Bridge');
    expect(stage4).toContain('Securing the Part');

    const stage5 = assembleSystemPrompt(makeState(5));
    // Stage 5 spec talks about foreign material
    expect(stage5).toContain('Foreign Material');
    expect(stage5).toContain('Symbolic Return');
    // Stage 5 should not load Stage 4's MII content as the active stage
    // (it loads its own spec — Stage 4 content only present via master's
    // 8-moves summary, not via the stage spec load).
  });

  it('injects the state block into the master prompt slot', () => {
    const prompt = assembleSystemPrompt(makeState(3));
    // Render state block has these markers
    expect(prompt).toContain('Active internal stage: 3/8');
    expect(prompt).toContain('Current depth: surface');
    // The placeholder should be replaced (no leftover {{STATE_INJECTION}})
    expect(prompt).not.toContain('{{STATE_INJECTION}}');
  });

  it('orders the layers as Shared Core → active stage spec → master', () => {
    // Layer ordering changed in PR 3 (prompt caching): canon docs come
    // first because Anthropic prompt cache requires the cacheable prefix
    // to start from the beginning of the system message. Master with
    // its dynamic state block comes after canon.
    const prompt = assembleSystemPrompt(makeState(2));
    const sharedCoreIdx = prompt.indexOf('## SHARED CORE');
    const stageSpecIdx = prompt.indexOf('## ACTIVE STAGE SPEC');
    const masterIdx = prompt.indexOf('<method>');

    expect(sharedCoreIdx).toBeGreaterThanOrEqual(0);
    expect(stageSpecIdx).toBeGreaterThan(sharedCoreIdx);
    expect(masterIdx).toBeGreaterThan(stageSpecIdx);
  });
});

describe('assembleSystemPromptBlocks — Anthropic prompt caching', () => {
  it('returns 5 blocks: shared core / stage spec / master-before-state / state / master-after-state', () => {
    const blocks = assembleSystemPromptBlocks(makeState(2));
    expect(blocks).toHaveLength(5);
  });

  it('marks the stage spec and master-before-state blocks with cache_control', () => {
    const blocks = assembleSystemPromptBlocks(makeState(2));
    // Block 0 (Shared Core): no cache_control on its own (gets cached
    // by virtue of cache_control on block 1).
    expect(blocks[0].cache_control).toBeUndefined();
    // Block 1 (active stage spec): cache breakpoint.
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
    // Block 2 (master-before-state): cache breakpoint.
    expect(blocks[2].cache_control).toEqual({ type: 'ephemeral' });
    // Block 3 (state block): NOT cached — dynamic per turn.
    expect(blocks[3].cache_control).toBeUndefined();
    // Block 4 (master-after-state): NOT cached — sits after dynamic
    // content so caching it would never hit.
    expect(blocks[4].cache_control).toBeUndefined();
  });

  it('every block declares type "text"', () => {
    const blocks = assembleSystemPromptBlocks(makeState(3));
    for (const b of blocks) {
      expect(b.type).toBe('text');
    }
  });

  it('shared core block contains Shared Core canon', () => {
    const blocks = assembleSystemPromptBlocks(makeState(1));
    expect(blocks[0].text).toContain('## SHARED CORE');
    expect(blocks[0].text).toContain('Practice Generation Algorithm');
  });

  it('stage spec block contains the active stage', () => {
    const blocks4 = assembleSystemPromptBlocks(makeState(4));
    expect(blocks4[1].text).toContain('Compassion Bridge');
    const blocks5 = assembleSystemPromptBlocks(makeState(5));
    expect(blocks5[1].text).toContain('Foreign Material');
  });

  it('state block sits at index 3 and contains the rendered state', () => {
    const blocks = assembleSystemPromptBlocks(makeState(3));
    expect(blocks[3].text).toContain('Active internal stage: 3/8');
  });
});
