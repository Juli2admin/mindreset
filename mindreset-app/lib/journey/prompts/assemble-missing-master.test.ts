// Regression pin for the clean-runtime PR A0 change: when the master runtime
// prompt is absent, assembleSystemPromptBlocks must FAIL LOUD, not fall back
// (the old fallback mutually recursed into a stack overflow). In production the
// master is always bundled (next.config.mjs outputFileTracingIncludes), so this
// path is unreachable — but it must fail cleanly if it is ever hit.

import { describe, it, expect, vi } from 'vitest';
import type { JourneyState } from '../state/types';

// Force the master loader to report the prompt as missing.
vi.mock('./load-spec', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./load-spec')>();
  return { ...actual, loadMasterJourneyPrompt: () => null };
});

function minimalState(): JourneyState {
  return {
    userId: 'user_missing_master_test',
    currentStage: 1,
    currentDepth: 'surface',
    startedAt: new Date('2026-07-21'),
    lastActivityAt: new Date('2026-07-21'),
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
    onboardingAnswers: null,
  };
}

describe('assembleSystemPromptBlocks — missing master prompt', () => {
  it('throws loudly instead of recursing when the master prompt is absent', async () => {
    const { assembleSystemPromptBlocks } = await import('./assemble');
    expect(() => assembleSystemPromptBlocks(minimalState())).toThrow(/master prompt/i);
  });
});
