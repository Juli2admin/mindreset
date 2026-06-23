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
import { assembleSystemPrompt } from './assemble';
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

  it('orders the layers as master → Shared Core → active stage spec', () => {
    const prompt = assembleSystemPrompt(makeState(2));
    const masterIdx = prompt.indexOf('<method>');
    const sharedCoreIdx = prompt.indexOf('## SHARED CORE');
    const stageSpecIdx = prompt.indexOf('## ACTIVE STAGE SPEC');

    expect(masterIdx).toBeGreaterThanOrEqual(0);
    expect(sharedCoreIdx).toBeGreaterThan(masterIdx);
    expect(stageSpecIdx).toBeGreaterThan(sharedCoreIdx);
  });
});
