// Tests for the Stage 8 advancement gate (the Discharge gate).
// Canon-aligned 2026-06-27.
//
// Canon §10 (docs/journey/08-stage-embodiment.md) requires:
//   - 6 weeks minimum in Stage 8
//   - ≥ 6 CAL sessions on different real moments
//   - ≥ 3 CAL sessions at Layer 2 or 3
//   - Identity Reinforcement Check-In in each of the last 4 sessions,
//     with "close" or "steady" reported in ≥ 3 of them  ← THIS PR
//   - dischargeReadiness signalled ≥ 2 times
//   - No urgency in recent 14 days (approx last 20 turns)
//   - Standard guards (intensities ≤ 5, safety none for 10 turns,
//     not frozen, identityAnchor set, AI agrees)
//
// Items still NOT gated (listed in the gate's docstring):
//   - Identity Anchor used ≥ 1×/week between sessions
//   - "I feel like myself" on ≥ 2 different days
//   - No foreign material reactivation
//   - No part flagged as separate in last 4 sessions

import { describe, expect, it } from 'vitest';
import { checkStage8Gate } from './stage-gates';
import type { JourneyState } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport } from '../stateReport/schema';

// 7 weeks before "now" so the 6-week minimum is comfortably elapsed in
// the fixed-clock world we test under.
const STAGE_8_STARTED = new Date(Date.now() - 7 * 7 * 24 * 60 * 60 * 1000);

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_test_stage8',
    currentStage: 8,
    currentDepth: 'surface',
    startedAt: new Date('2026-01-01'),
    lastActivityAt: new Date(),
    dischargedAt: null,
    anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-01-02'),
    identityAnchor: 'hand on the centre of my chest',
    identityAnchorSetAt: new Date('2026-03-15'),
    processingChannel: 'visual',
    adultSelfQualities: 'the calm older me',
    lastIntensity: 4,
    lastIntensityAt: new Date(),
    lastDeepLayerContactAt: null,
    mii: {},
    stage8WeeksElapsed: 7,
    frozenForReview: false,
    frozenAt: null,
    frozenReason: null,
    continuityNote: null,
    parts: [],
    foreignFiles: [],
    signatureImages: [],
    sessionCount: 20,
    daysEngaged: 45,
    thisSessionMessageCount: 5,
    stageJustAdvanced: false,
    hoursSinceLastTurn: null,
    isSessionResume: false,
    ...overrides,
  };
}

function makeTurnAt(
  at: Date,
  report: Partial<StateReport> = {},
): AuditTurn {
  const fullReport: StateReport = {
    intensity: 4,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    ...report,
  };
  return {
    id: `turn_${at.getTime()}_${Math.random().toString(36).slice(2)}`,
    createdAt: at,
    stageAtTurn: 8,
    depthAtTurn: 'surface',
    intensityReported: fullReport.intensity,
    safetyFlag: fullReport.safetyFlag,
    recommendedAction: fullReport.recommendedAction,
    report: fullReport,
  };
}

function makeSession(
  startDay: Date,
  perTurn: Partial<StateReport>[],
): AuditTurn[] {
  return perTurn.map((r, i) => {
    const t = new Date(startDay);
    t.setMinutes(t.getMinutes() + i * 10);
    return makeTurnAt(t, r);
  });
}

// Six sessions stretching over ~5 weeks. Sessions 3-6 each contain an
// Identity Reinforcement Check-In with adultSelfThisWeek set to a string
// containing "close" or "steady" (3 of 4 — the canon ratio). Six CAL
// runs spread across distinct days, three of them at Layer 2 or 3.
// dischargeReadiness: 'ready' is signalled twice in the last two sessions.
function passingTurns(): AuditTurn[] {
  const baseTs = Date.now() - 35 * 24 * 60 * 60 * 1000;
  const day = (n: number): Date => new Date(baseTs + n * 24 * 60 * 60 * 1000);
  return [
    ...makeSession(day(0), [
      { calRunOn: 'tense meeting on Tuesday', calLayer: 1 },
      {},
    ]),
    ...makeSession(day(5), [
      { calRunOn: 'morning rush with kids', calLayer: 2 },
      {},
    ]),
    // Last 4 sessions: Identity Reinforcement Check-In each, 3/4 "close
    // or steady". Each session multi-turn so the 10-turn safety window
    // is populated.
    ...makeSession(day(10), [
      {
        adultSelfThisWeek: 'steady, closer than last week',
        calRunOn: 'phone call with my mother',
        calLayer: 1,
      },
      {},
    ]),
    ...makeSession(day(20), [
      {
        adultSelfThisWeek: 'close and quiet most days',
        calRunOn: 'argument with my partner',
        calLayer: 2,
      },
      {},
    ]),
    ...makeSession(day(28), [
      {
        adultSelfThisWeek: 'far on Wednesday, came back by Friday',
        calRunOn: 'overwork pattern returning',
        calLayer: 2,
      },
      { dischargeReadiness: 'ready' },
      {},
    ]),
    ...makeSession(day(34), [
      {
        adultSelfThisWeek: 'steady. I notice her, she notices me.',
        calRunOn: 'old pull to apologise',
        calLayer: 3,
      },
      { dischargeReadiness: 'ready' },
      { recommendedAction: 'discharge' },
    ]),
  ];
}

describe('checkStage8Gate — canon-aligned discharge gate', () => {
  it('passes when all canon conditions met', () => {
    const result = checkStage8Gate(makeState(), passingTurns(), STAGE_8_STARTED);
    expect(result.passed).toBe(true);
  });

  it('REGRESSION GUARD: identity reinforcement check-in missing in one recent session blocks', () => {
    const baseTs = Date.now() - 35 * 24 * 60 * 60 * 1000;
    const day = (n: number): Date => new Date(baseTs + n * 24 * 60 * 60 * 1000);
    const turns: AuditTurn[] = [
      ...makeSession(day(0), [{ calRunOn: 'tense meeting', calLayer: 1 }]),
      ...makeSession(day(5), [{ calRunOn: 'morning rush', calLayer: 2 }]),
      // Last 4 sessions — one (the third) has NO adultSelfThisWeek
      ...makeSession(day(10), [
        {
          adultSelfThisWeek: 'steady',
          calRunOn: 'phone call',
          calLayer: 1,
        },
      ]),
      ...makeSession(day(20), [
        {
          adultSelfThisWeek: 'close',
          calRunOn: 'argument',
          calLayer: 2,
        },
      ]),
      ...makeSession(day(28), [
        {
          calRunOn: 'overwork pattern',
          calLayer: 2,
        }, // ← no check-in this session
        { dischargeReadiness: 'ready' },
      ]),
      ...makeSession(day(34), [
        {
          adultSelfThisWeek: 'steady',
          calRunOn: 'old pull',
          calLayer: 3,
        },
        { dischargeReadiness: 'ready', recommendedAction: 'discharge' },
      ]),
    ];
    const result = checkStage8Gate(makeState(), turns, STAGE_8_STARTED);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      'identity_reinforcement_check_in_missing_in_recent_session',
    );
  });

  it('REGRESSION GUARD: adult self not close-or-steady in ≥ 3 of last 4 sessions blocks', () => {
    const baseTs = Date.now() - 35 * 24 * 60 * 60 * 1000;
    const day = (n: number): Date => new Date(baseTs + n * 24 * 60 * 60 * 1000);
    const turns: AuditTurn[] = [
      ...makeSession(day(0), [{ calRunOn: 'tense meeting', calLayer: 1 }]),
      ...makeSession(day(5), [{ calRunOn: 'morning rush', calLayer: 2 }]),
      // Last 4 sessions: 2/4 have close/steady; canon needs ≥ 3
      ...makeSession(day(10), [
        {
          adultSelfThisWeek: 'far and quiet',
          calRunOn: 'phone call',
          calLayer: 1,
        },
      ]),
      ...makeSession(day(20), [
        {
          adultSelfThisWeek: 'distant most days',
          calRunOn: 'argument',
          calLayer: 2,
        },
      ]),
      ...makeSession(day(28), [
        {
          adultSelfThisWeek: 'steady',
          calRunOn: 'overwork',
          calLayer: 2,
        },
        { dischargeReadiness: 'ready' },
      ]),
      ...makeSession(day(34), [
        {
          adultSelfThisWeek: 'close',
          calRunOn: 'old pull',
          calLayer: 3,
        },
        { dischargeReadiness: 'ready', recommendedAction: 'discharge' },
      ]),
    ];
    const result = checkStage8Gate(makeState(), turns, STAGE_8_STARTED);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      'adult_self_not_close_or_steady_in_three_of_last_four_sessions',
    );
  });

  it('fails when 6-week minimum not elapsed', () => {
    const tooEarly = new Date(Date.now() - 3 * 7 * 24 * 60 * 60 * 1000);
    const result = checkStage8Gate(makeState(), passingTurns(), tooEarly);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('stage_8_min_6_weeks_not_elapsed');
  });

  it('fails when fewer than 6 CAL sessions', () => {
    const baseTs = Date.now() - 35 * 24 * 60 * 60 * 1000;
    const day = (n: number): Date => new Date(baseTs + n * 24 * 60 * 60 * 1000);
    // Same as passingTurns but only 3 CAL runs
    const turns: AuditTurn[] = [
      ...makeSession(day(0), [{}]),
      ...makeSession(day(5), [{}]),
      ...makeSession(day(10), [
        { adultSelfThisWeek: 'steady', calRunOn: 'phone call', calLayer: 1 },
      ]),
      ...makeSession(day(20), [
        { adultSelfThisWeek: 'close', calRunOn: 'argument', calLayer: 2 },
      ]),
      ...makeSession(day(28), [
        { adultSelfThisWeek: 'far Wednesday', calRunOn: 'overwork', calLayer: 2 },
        { dischargeReadiness: 'ready' },
      ]),
      ...makeSession(day(34), [
        { adultSelfThisWeek: 'steady' },
        { dischargeReadiness: 'ready', recommendedAction: 'discharge' },
      ]),
    ];
    const result = checkStage8Gate(makeState(), turns, STAGE_8_STARTED);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('cal_sessions_under_six');
  });

  it('fails when fewer than 3 CAL at Layer 2/3', () => {
    const baseTs = Date.now() - 35 * 24 * 60 * 60 * 1000;
    const day = (n: number): Date => new Date(baseTs + n * 24 * 60 * 60 * 1000);
    const turns: AuditTurn[] = [
      ...makeSession(day(0), [{ calRunOn: 'a', calLayer: 1 }]),
      ...makeSession(day(5), [{ calRunOn: 'b', calLayer: 1 }]),
      ...makeSession(day(10), [
        { adultSelfThisWeek: 'steady', calRunOn: 'c', calLayer: 1 },
      ]),
      ...makeSession(day(20), [
        { adultSelfThisWeek: 'close', calRunOn: 'd', calLayer: 1 },
      ]),
      ...makeSession(day(28), [
        { adultSelfThisWeek: 'steady', calRunOn: 'e', calLayer: 1 },
        { dischargeReadiness: 'ready' },
      ]),
      ...makeSession(day(34), [
        { adultSelfThisWeek: 'close', calRunOn: 'f', calLayer: 2 },
        { dischargeReadiness: 'ready', recommendedAction: 'discharge' },
      ]),
    ];
    const result = checkStage8Gate(makeState(), turns, STAGE_8_STARTED);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('cal_layer_2_or_3_under_three');
  });

  it('fails when urgency present in recent window', () => {
    const turns = passingTurns();
    // splice an urgency marker into one of the last 20 turns
    turns[turns.length - 2] = {
      ...turns[turns.length - 2],
      report: { ...turns[turns.length - 2].report, urgencyMarkers: 'present' },
    };
    const result = checkStage8Gate(makeState(), turns, STAGE_8_STARTED);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('urgency_in_recent_two_weeks');
  });

  it('fails when dischargeReadiness signalled fewer than 2 times', () => {
    const baseTs = Date.now() - 35 * 24 * 60 * 60 * 1000;
    const day = (n: number): Date => new Date(baseTs + n * 24 * 60 * 60 * 1000);
    const turns: AuditTurn[] = [
      ...makeSession(day(0), [{ calRunOn: 'a', calLayer: 1 }]),
      ...makeSession(day(5), [{ calRunOn: 'b', calLayer: 2 }]),
      ...makeSession(day(10), [
        { adultSelfThisWeek: 'steady', calRunOn: 'c', calLayer: 1 },
      ]),
      ...makeSession(day(20), [
        { adultSelfThisWeek: 'close', calRunOn: 'd', calLayer: 2 },
      ]),
      ...makeSession(day(28), [
        { adultSelfThisWeek: 'far Wednesday', calRunOn: 'e', calLayer: 2 },
      ]),
      ...makeSession(day(34), [
        { adultSelfThisWeek: 'steady', calRunOn: 'f', calLayer: 3 },
        // only one dischargeReadiness ready
        { dischargeReadiness: 'ready', recommendedAction: 'discharge' },
      ]),
    ];
    const result = checkStage8Gate(makeState(), turns, STAGE_8_STARTED);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('discharge_readiness_not_signalled_twice');
  });

  it('fails without identity anchor', () => {
    const result = checkStage8Gate(
      makeState({ identityAnchor: null }),
      passingTurns(),
      STAGE_8_STARTED,
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('identity_anchor_missing');
  });
});
