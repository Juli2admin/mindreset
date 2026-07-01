// PR 3 — outstandingStageCriteria(): the read-only mirror of the code gate that
// surfaces the current stage's remaining completion criteria to the AI. It maps
// failing gate reason codes to plain clinical milestones, and filters out
// advisory/settledness reasons (this turn's own recommendedAction, needing more
// history, intensity/safety windows) that the AI can't steer toward.

import { describe, expect, it } from 'vitest';
import { outstandingStageCriteria } from './stage-gates';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_readiness',
    currentStage: 1,
    currentDepth: 'surface',
    startedAt: new Date('2026-06-20'),
    lastActivityAt: new Date('2026-06-26'),
    dischargedAt: null,
    anchorText: null,
    anchorSetAt: null,
    identityAnchor: null,
    identityAnchorSetAt: null,
    processingChannel: 'visual',
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
    sessionCount: 1,
    daysEngaged: 2,
    thisSessionMessageCount: 5,
    stageJustAdvanced: false,
    ...overrides,
  };
}

function makeTurn(daysAgo: number, report: Partial<StateReport> = {}): AuditTurn {
  const d = new Date('2026-06-26');
  d.setDate(d.getDate() - daysAgo);
  const full: StateReport = {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...report,
  };
  return {
    id: `turn_${daysAgo}`,
    createdAt: d,
    stageAtTurn: 1,
    depthAtTurn: 'surface',
    intensityReported: full.intensity,
    safetyFlag: full.safetyFlag,
    recommendedAction: full.recommendedAction,
    report: full,
  };
}

describe('outstandingStageCriteria — Stage 1', () => {
  it('surfaces the content criteria a bare user is missing', () => {
    const turns = [makeTurn(1)]; // no anchor, no tokens
    const out = outstandingStageCriteria(1, makeState(), turns);
    // Content milestones present, in plain language.
    expect(out.some((c) => /Personal Anchor is captured/i.test(c))).toBe(true);
    expect(out.some((c) => /named one emotion, or located one body-state/i.test(c))).toBe(true);
    expect(out.some((c) => /oriented to what this space is/i.test(c))).toBe(true);
  });

  it('drops advisory reasons — no "advance" recommendation, no history-count noise', () => {
    const turns = [makeTurn(1)];
    const out = outstandingStageCriteria(1, makeState(), turns);
    const joined = out.join(' | ');
    expect(joined).not.toMatch(/recommend/i);
    expect(joined).not.toMatch(/intensity history/i);
    expect(joined).not.toMatch(/frozen/i);
  });

  it('drops the settledness (intensity/safety) window reasons', () => {
    // Recent intensity above 5 would add recent_intensity_above_5 to the gate,
    // but that is settledness the AI reads directly — not a surfaced milestone.
    const turns = [
      makeTurn(2, { intensity: 8 }),
      makeTurn(1, { intensity: 8 }),
    ];
    const out = outstandingStageCriteria(1, makeState(), turns);
    const joined = out.join(' | ');
    expect(joined).not.toMatch(/intensity/i);
    expect(joined).not.toMatch(/safety/i);
  });

  it('returns [] when every tracked content criterion is met', () => {
    const turns = [
      makeTurn(3, { readinessTouched: ['anchor_identified'] }),
      makeTurn(2, { readinessTouched: ['emotion_named'] }),
      makeTurn(1, {
        readinessTouched: ['orientation_present'],
        recommendedAction: 'advance',
      }),
    ];
    const state = makeState({ anchorText: 'the bench under the apple tree' });
    const out = outstandingStageCriteria(1, state, turns);
    expect(out).toEqual([]);
  });
});

describe('outstandingStageCriteria — Stage 2', () => {
  it('surfaces the three distinct Stage 2 conditions when unmet', () => {
    const turns = [makeTurn(1)];
    const state = makeState({ currentStage: 2, anchorText: 'the bench' });
    const out = outstandingStageCriteria(2, state, turns);
    expect(out.some((c) => /emotion named/i.test(c))).toBe(true);
    expect(out.some((c) => /located as a felt sense in the body/i.test(c))).toBe(true);
    expect(out.some((c) => /Soft Why/i.test(c))).toBe(true);
  });
});

describe('outstandingStageCriteria — de-duplication + fallback', () => {
  it('does not repeat a criterion even if the gate emits it once', () => {
    const turns = [makeTurn(1)];
    const out = outstandingStageCriteria(1, makeState(), turns);
    expect(new Set(out).size).toBe(out.length);
  });
});
