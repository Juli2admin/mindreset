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
    patterns: [],
    sessionCount: 0,
    daysEngaged: 0,
    thisSessionMessageCount: 0,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    hasOpenCycle: false,
    openCycleDescription: null,
    sessionRejectedModalities: [],
    recentChannelShift: false,
    taskContract: null,
    workingPreferences: [],
    practiceHistory: [],
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

  it('includes all 8 stage specs (PR λ) — Stage 1 spec content is present', () => {
    const prompt = assembleSystemPrompt(makeState(1));
    // The all-stages header replaces "ACTIVE STAGE SPEC" from the prior
    // single-stage architecture.
    expect(prompt).toContain('## ALL 8 STAGE SPECS');
    // Stage 1 spec has Personal Anchor practice
    expect(prompt).toContain('Personal Anchor Identification');
  });

  it('includes ALL 8 stage specs regardless of currentStage (PR λ)', () => {
    // Whichever router stage the state carries, the prompt must contain
    // every stage's playbook.
    const stage1 = assembleSystemPrompt(makeState(1));
    // Stage 4 spec content
    expect(stage1).toContain('Compassion Bridge');
    expect(stage1).toContain('Securing the Part');
    // Stage 5 spec content
    expect(stage1).toContain('Foreign Material');
    expect(stage1).toContain('Symbolic Return');
    // Same must hold at any other router-stage
    const stage5 = assembleSystemPrompt(makeState(5));
    expect(stage5).toContain('Personal Anchor Identification'); // Stage 1
    expect(stage5).toContain('Compassion Bridge'); // Stage 4
  });

  it('injects the state block into the master prompt slot', () => {
    const prompt = assembleSystemPrompt(makeState(3));
    // Render state block has these markers (PR λ label change).
    expect(prompt).toContain("Router's stage label: 3/8");
    expect(prompt).toContain('Current depth: surface');
    // The placeholder should be replaced (no leftover {{STATE_INJECTION}})
    expect(prompt).not.toContain('{{STATE_INJECTION}}');
  });

  it('orders the layers as Shared Core → all-stages → master', () => {
    const prompt = assembleSystemPrompt(makeState(2));
    const sharedCoreIdx = prompt.indexOf('## SHARED CORE');
    const allStagesIdx = prompt.indexOf('## ALL 8 STAGE SPECS');
    const masterIdx = prompt.indexOf('<method>');

    expect(sharedCoreIdx).toBeGreaterThanOrEqual(0);
    expect(allStagesIdx).toBeGreaterThan(sharedCoreIdx);
    expect(masterIdx).toBeGreaterThan(allStagesIdx);
  });
});

describe('assembleSystemPromptBlocks — Anthropic prompt caching (PR λ)', () => {
  // PR λ (2026-07-11) — the 5-block architecture became 4 blocks. Canon
  // (Shared Core + Practice Gen Algorithm) merged with ALL 8 stage specs
  // into one cached prefix block. Under Julia's clinical philosophy the
  // AI is the clinician and reaches for whichever stage's methodology
  // fits the turn — so it needs every stage's playbook available in
  // context, not only the router's current-stage bookkeeping label.

  it('returns 4 blocks: canon+all-stages / master-before-state / state / master-after-state', () => {
    const blocks = assembleSystemPromptBlocks(makeState(2));
    expect(blocks).toHaveLength(4);
  });

  it('marks the canon and master-before-state blocks with cache_control', () => {
    const blocks = assembleSystemPromptBlocks(makeState(2));
    // Block 0 (canon + all 8 stage specs): cache breakpoint.
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    // Block 1 (master-before-state): cache breakpoint.
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
    // Block 2 (state block): NOT cached — dynamic per turn.
    expect(blocks[2].cache_control).toBeUndefined();
    // Block 3 (master-after-state): NOT cached — sits after dynamic
    // content so caching it would never hit.
    expect(blocks[3].cache_control).toBeUndefined();
  });

  it('every block declares type "text"', () => {
    const blocks = assembleSystemPromptBlocks(makeState(3));
    for (const b of blocks) {
      expect(b.type).toBe('text');
    }
  });

  it('canon block contains Shared Core + Practice Algorithm + all-stages header', () => {
    const blocks = assembleSystemPromptBlocks(makeState(1));
    expect(blocks[0].text).toContain('## SHARED CORE');
    expect(blocks[0].text).toContain('## PRACTICE GENERATION ALGORITHM');
    expect(blocks[0].text).toContain('## ALL 8 STAGE SPECS');
  });

  it('canon block includes the full Practice Generation Algorithm doc', () => {
    const blocks = assembleSystemPromptBlocks(makeState(1));
    expect(blocks[0].text).toContain('# MindReset Practice Generation Algorithm');
    expect(blocks[0].text).toContain('Regulation Practices');
    expect(blocks[0].text).toContain('Somatic Awareness');
    expect(blocks[0].text).toContain('Guided Inner Landscape');
    expect(blocks[0].text).toContain('Narrative Rewriting');
    expect(blocks[0].text).toContain('Self-Compassion');
    // Canon header now says "Three sources of clinical method follow".
    expect(blocks[0].text).toContain('Three sources of clinical method');
  });

  it('canon block includes ALL 8 stage specs (not just the current one)', () => {
    // This is the load-bearing test for PR λ. The AI must see EVERY
    // stage's playbook — the router's stage label doesn't gate what
    // playbook is loaded. State-passed makeState(1) but Stage 5's spec
    // must still be in the block.
    const blocks = assembleSystemPromptBlocks(makeState(1));
    const canon = blocks[0].text;
    // Section separators for each stage (from STAGE_SEPARATORS in the
    // assembler).
    expect(canon).toContain('STAGE 1 SPEC — STABILISATION');
    expect(canon).toContain('STAGE 2 SPEC — PAIN');
    expect(canon).toContain('STAGE 3 SPEC — ADULT SELF');
    expect(canon).toContain('STAGE 4 SPEC — PARTS');
    expect(canon).toContain('STAGE 5 SPEC — FOREIGN MATERIAL');
    expect(canon).toContain('STAGE 6 SPEC — INTEGRATION');
    expect(canon).toContain('STAGE 7 SPEC — NEW IDENTITY');
    expect(canon).toContain('STAGE 8 SPEC — EMBODIMENT');
    // Content spot-checks — a phrase unique to each stage spec.
    expect(canon).toContain('Compassion Bridge'); // Stage 4
    expect(canon).toContain('Foreign Material'); // Stage 5
  });

  it('canon block is identical regardless of the router stage label (proves stage number does not gate playbook loading)', () => {
    // The whole point of PR λ. Advancing to stage 5 must not change
    // which playbooks are loaded — they were all there at stage 1.
    const stage1Canon = assembleSystemPromptBlocks(makeState(1))[0].text;
    const stage5Canon = assembleSystemPromptBlocks(makeState(5))[0].text;
    expect(stage1Canon).toBe(stage5Canon);
  });

  it('canon block orders sections: canon header → shared core → algorithm → all-stages header → stage specs', () => {
    const blocks = assembleSystemPromptBlocks(makeState(2));
    const text = blocks[0].text;
    const canonHeaderIdx = text.indexOf('# CLINICAL METHOD SOURCE');
    const sharedCoreIdx = text.indexOf('## SHARED CORE');
    const practiceAlgoIdx = text.indexOf('## PRACTICE GENERATION ALGORITHM');
    const allStagesHeaderIdx = text.indexOf('## ALL 8 STAGE SPECS');
    const stage1SectionIdx = text.indexOf('STAGE 1 SPEC — STABILISATION');
    expect(canonHeaderIdx).toBeGreaterThanOrEqual(0);
    expect(sharedCoreIdx).toBeGreaterThan(canonHeaderIdx);
    expect(practiceAlgoIdx).toBeGreaterThan(sharedCoreIdx);
    expect(allStagesHeaderIdx).toBeGreaterThan(practiceAlgoIdx);
    expect(stage1SectionIdx).toBeGreaterThan(allStagesHeaderIdx);
  });

  it("state block sits at index 2 and contains the router's stage label", () => {
    const blocks = assembleSystemPromptBlocks(makeState(3));
    expect(blocks[2].text).toContain("Router's stage label: 3/8");
    // Explicit permission for the AI to reach for any stage.
    expect(blocks[2].text).toContain('bookkeeping');
  });
});
