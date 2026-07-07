// Tests for the move-based advancement lane — PR 4b (2026-07-07).
//
// Owner-approved rules under test:
//   1. Universal moves alone don't advance.
//   2. In a mixed turn, only stage-scoped IDs count.
//   3. +1 only — never multi-jump.
//   4. Regulation guards match classic gate rigor (intensity ≤ 5,
//      safety === 'none').
//   5. Adult self present in ≥ 50% of qualifying turns.
//   6. No recommendedAction === 'advance' requirement.
//   7. Stage 8 no-ops.
//
// Also includes a replay test against Julia's real Sunday-Monday session
// data (the whole reason PR 4b exists — verify the rule fires on it).

import { describe, expect, it } from 'vitest';
import {
  checkMoveBasedAdvance,
  getStageFromTurnMoves,
} from './move-based-advance';
import type { AuditTurn } from './history';
import type { StateReport, CanonicalMove } from '../stateReport/schema';

function makeTurn(
  overrides: Partial<StateReport> & {
    _daysAgo?: number;
    _adultSelfPresent?: boolean;
  } = {},
): AuditTurn {
  const daysAgo = overrides._daysAgo ?? 0;
  const d = new Date('2026-07-07T08:00:00Z');
  d.setDate(d.getDate() - daysAgo);
  const { _daysAgo, _adultSelfPresent, ...reportOverrides } = overrides;
  const report: StateReport = {
    intensity: 3,
    safetyFlag: 'none',
    recommendedAction: 'stay',
    adultSelfPresent: _adultSelfPresent ?? true,
    ...reportOverrides,
  };
  return {
    id: `turn_${daysAgo}_${Math.random().toString(36).slice(2)}`,
    createdAt: d,
    stageAtTurn: 1,
    depthAtTurn: 'surface',
    intensityReported: report.intensity,
    safetyFlag: report.safetyFlag,
    recommendedAction: report.recommendedAction,
    report,
  };
}

describe('getStageFromTurnMoves', () => {
  it('returns null when moveJustPerformed is missing', () => {
    expect(getStageFromTurnMoves(makeTurn())).toBeNull();
  });

  it('returns null when the array is empty', () => {
    expect(
      getStageFromTurnMoves(makeTurn({ moveJustPerformed: [] })),
    ).toBeNull();
  });

  it('returns null for a universal-only turn', () => {
    expect(
      getStageFromTurnMoves(
        makeTurn({
          moveJustPerformed: [
            'universal.practice_landscape',
            'universal.witness_and_reflect',
          ] as CanonicalMove[],
        }),
      ),
    ).toBeNull();
  });

  it('returns the stage number for a single stage-scoped move', () => {
    expect(
      getStageFromTurnMoves(
        makeTurn({
          moveJustPerformed: ['stage_3.adult_self_cocreation'] as CanonicalMove[],
        }),
      ),
    ).toBe(3);
  });

  it('returns the HIGHEST stage number when multiple stage-scoped moves are emitted', () => {
    expect(
      getStageFromTurnMoves(
        makeTurn({
          moveJustPerformed: [
            'stage_3.adult_self_cocreation',
            'stage_7.qualities_inventory',
          ] as CanonicalMove[],
        }),
      ),
    ).toBe(7);
  });

  it('ignores universal moves when picking the highest stage from mixed', () => {
    expect(
      getStageFromTurnMoves(
        makeTurn({
          moveJustPerformed: [
            'universal.practice_landscape',
            'stage_7.qualities_inventory',
            'universal.witness_and_reflect',
          ] as CanonicalMove[],
        }),
      ),
    ).toBe(7);
  });

  it('ignores obviously malformed IDs (defensive against schema drift)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const malformed: any = ['stage_.foo', 'stage_9.beyond', 'weird', 42, null];
    expect(
      getStageFromTurnMoves(
        makeTurn({ moveJustPerformed: malformed as CanonicalMove[] }),
      ),
    ).toBeNull();
  });
});

describe('checkMoveBasedAdvance — regulation guards match classic-gate rigor', () => {
  const stageOverTarget = ['stage_7.qualities_inventory'] as CanonicalMove[];

  it('does not advance when the window is empty', () => {
    // Post-review change: the empty-window case is now caught by the
    // current-turn regulation guard first (see move-based-advance.ts
    // "no turns in window" branch), before the qualifying-count check.
    const r = checkMoveBasedAdvance(1, []);
    expect(r.canAdvance).toBe(false);
    expect(r.qualifyingTurnCount).toBe(0);
    expect(r.reason).toMatch(/no turns in window/);
  });

  it('does not advance when only universal moves have been emitted', () => {
    const turns = [
      makeTurn({ moveJustPerformed: ['universal.practice_landscape'] as CanonicalMove[] }),
      makeTurn({ moveJustPerformed: ['universal.witness_and_reflect'] as CanonicalMove[] }),
      makeTurn({ moveJustPerformed: ['universal.session_close'] as CanonicalMove[] }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.qualifyingTurnCount).toBe(0);
  });

  it('does not advance when the highest move is at currentStage (not higher)', () => {
    // currentStage = 3 → target = 4. Turns emit stage_3 moves only.
    const turns = [
      makeTurn({ moveJustPerformed: ['stage_3.adult_self_cocreation'] as CanonicalMove[] }),
      makeTurn({ moveJustPerformed: ['stage_3.adult_self_cocreation'] as CanonicalMove[] }),
      makeTurn({ moveJustPerformed: ['stage_3.observer_seat'] as CanonicalMove[] }),
    ];
    const r = checkMoveBasedAdvance(3, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.qualifyingTurnCount).toBe(0);
  });

  it('advances when 3 turns emit moves at target stage or above under regulation guards', () => {
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget }),
      makeTurn({ moveJustPerformed: stageOverTarget }),
      makeTurn({ moveJustPerformed: stageOverTarget }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(true);
    expect(r.qualifyingTurnCount).toBe(3);
    expect(r.reason).toMatch(/advancing 1 → 2/);
  });

  it('fires the +1 advancement even when moves point at a stage far above current', () => {
    // Stage_7 moves while currentStage = 1 — advance only to 2. Rule #3.
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget }),
      makeTurn({ moveJustPerformed: stageOverTarget }),
      makeTurn({ moveJustPerformed: stageOverTarget }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(true);
    expect(r.reason).toContain('advancing 1 → 2');
    expect(r.reason).not.toContain('→ 7');
  });

  it('does not advance when qualifying turns have safety = watch', () => {
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget, safetyFlag: 'watch' }),
      makeTurn({ moveJustPerformed: stageOverTarget, safetyFlag: 'watch' }),
      makeTurn({ moveJustPerformed: stageOverTarget, safetyFlag: 'watch' }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.qualifyingTurnCount).toBe(0);
  });

  it('does not advance when qualifying turns have safety = red_flag', () => {
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget, safetyFlag: 'red_flag' }),
      makeTurn({ moveJustPerformed: stageOverTarget, safetyFlag: 'red_flag' }),
      makeTurn({ moveJustPerformed: stageOverTarget, safetyFlag: 'red_flag' }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
  });

  it('does not advance when intensity > 5 in qualifying turns', () => {
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget, intensity: 6 }),
      makeTurn({ moveJustPerformed: stageOverTarget, intensity: 7 }),
      makeTurn({ moveJustPerformed: stageOverTarget, intensity: 8 }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.qualifyingTurnCount).toBe(0);
  });

  it('accepts intensity = 5 exactly (boundary)', () => {
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget, intensity: 5 }),
      makeTurn({ moveJustPerformed: stageOverTarget, intensity: 5 }),
      makeTurn({ moveJustPerformed: stageOverTarget, intensity: 5 }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(true);
  });

  it('excludes individual turns that fail regulation but passes when 3 still qualify', () => {
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget }), // OK
      makeTurn({ moveJustPerformed: stageOverTarget, intensity: 8 }), // excluded
      makeTurn({ moveJustPerformed: stageOverTarget, safetyFlag: 'watch' }), // excluded
      makeTurn({ moveJustPerformed: stageOverTarget }), // OK
      makeTurn({ moveJustPerformed: stageOverTarget }), // OK
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(true);
    expect(r.qualifyingTurnCount).toBe(3);
  });

  it('does not advance if adult self present in fewer than 50% of qualifying turns', () => {
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget, _adultSelfPresent: false }),
      makeTurn({ moveJustPerformed: stageOverTarget, _adultSelfPresent: false }),
      makeTurn({ moveJustPerformed: stageOverTarget, _adultSelfPresent: true }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.reason).toMatch(/adult self present in only 1\/3/);
  });

  it('advances when adult self present in exactly 50% of qualifying turns (boundary)', () => {
    // 2 of 4 = exactly 50% ≥ 0.5.
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget, _adultSelfPresent: true }),
      makeTurn({ moveJustPerformed: stageOverTarget, _adultSelfPresent: true }),
      makeTurn({ moveJustPerformed: stageOverTarget, _adultSelfPresent: false }),
      makeTurn({ moveJustPerformed: stageOverTarget, _adultSelfPresent: false }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(true);
    expect(r.qualifyingTurnCount).toBe(4);
  });

  it('does not require recommendedAction === "advance" (deliberate divergence)', () => {
    // All three turns emit recommendedAction: 'stay' — classic gate
    // would refuse. Move lane fires anyway.
    const turns = [
      makeTurn({ moveJustPerformed: stageOverTarget, recommendedAction: 'stay' }),
      makeTurn({ moveJustPerformed: stageOverTarget, recommendedAction: 'stay' }),
      makeTurn({ moveJustPerformed: stageOverTarget, recommendedAction: 'stay' }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(true);
  });
});

describe('checkMoveBasedAdvance — stage boundary guards', () => {
  it('no-ops at Stage 8 (discharge lane owns Stage 8)', () => {
    const turns = [
      makeTurn({
        moveJustPerformed: ['stage_8.discharge_protocol'] as CanonicalMove[],
      }),
      makeTurn({
        moveJustPerformed: ['stage_8.discharge_protocol'] as CanonicalMove[],
      }),
      makeTurn({
        moveJustPerformed: ['stage_8.discharge_protocol'] as CanonicalMove[],
      }),
    ];
    const r = checkMoveBasedAdvance(8, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.reason).toMatch(/stage_out_of_range/);
  });

  it('no-ops at Stage 9+ defensively (should never happen but is protected)', () => {
    const r = checkMoveBasedAdvance(9, []);
    expect(r.canAdvance).toBe(false);
  });

  it('no-ops at Stage 0 defensively', () => {
    const r = checkMoveBasedAdvance(0, []);
    expect(r.canAdvance).toBe(false);
  });

  it('fires at Stage 7 → Stage 8 when moves are at Stage 8', () => {
    // Stage 7 users doing sustained Stage 8 CAL work should advance
    // into Stage 8 — the router will then check the discharge gate on
    // the next turn.
    const turns = [
      makeTurn({
        moveJustPerformed: ['stage_8.cal_run'] as CanonicalMove[],
      }),
      makeTurn({
        moveJustPerformed: ['stage_8.identity_reinforcement_check_in'] as CanonicalMove[],
      }),
      makeTurn({
        moveJustPerformed: ['stage_8.cal_run'] as CanonicalMove[],
      }),
    ];
    const r = checkMoveBasedAdvance(7, turns);
    expect(r.canAdvance).toBe(true);
    expect(r.reason).toContain('advancing 7 → 8');
  });
});

// Regression tests for the current-turn regulation guard added on the
// code-review pass. Without this guard, historical qualifying evidence
// could survive a later dysregulated turn and advance the user at the
// exact moment they are least regulated — the reviewer's blocking
// finding.
describe('checkMoveBasedAdvance — current-turn regulation guard', () => {
  const stageOverTarget = ['stage_7.qualities_inventory'] as CanonicalMove[];

  it('refuses to advance when the current turn has safety=watch, even with 3 clean qualifying turns earlier', () => {
    // Reviewer's exact failure scenario. Sunday has 3 clean stage_7
    // turns; Monday morning presents a watch-flagged, dysregulated
    // current turn. Historical evidence must not override current
    // regulation.
    const turns = [
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 0, safetyFlag: 'watch', intensity: 5 }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.reason).toMatch(/current turn safety=watch/);
  });

  it('refuses to advance when the current turn has intensity=9, even with 3 clean qualifying turns earlier', () => {
    const turns = [
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 0, intensity: 9, safetyFlag: 'none' }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.reason).toMatch(/current turn intensity=9/);
  });

  it('refuses to advance when the current turn has safety=red_flag', () => {
    const turns = [
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 0, safetyFlag: 'red_flag', intensity: 5 }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.reason).toMatch(/current turn safety=red_flag/);
  });

  it('refuses to advance when the current turn has null intensity (uncertainty → refuse)', () => {
    const turns = [
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      // Build a turn with null intensity manually (the parser can
      // produce this when the LLM omits the field entirely and the
      // audit row's intensityReported column ends up null).
      {
        id: 'turn_current_null_int',
        createdAt: new Date('2026-07-07T08:00:00Z'),
        stageAtTurn: 1,
        depthAtTurn: 'surface',
        intensityReported: null,
        safetyFlag: 'none',
        recommendedAction: 'stay',
        report: {
          intensity: 5,
          safetyFlag: 'none' as const,
          recommendedAction: 'stay' as const,
        },
      },
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(false);
    expect(r.reason).toMatch(/current turn intensity null/);
  });

  it('advances when the current turn IS a qualifying turn (single-file suffix case)', () => {
    const turns = [
      makeTurn({ _daysAgo: 2, moveJustPerformed: stageOverTarget }),
      makeTurn({ _daysAgo: 1, moveJustPerformed: stageOverTarget }),
      // Current turn also qualifies — regulated + higher-stage move.
      makeTurn({ _daysAgo: 0, moveJustPerformed: stageOverTarget }),
    ];
    const r = checkMoveBasedAdvance(1, turns);
    expect(r.canAdvance).toBe(true);
    expect(r.qualifyingTurnCount).toBe(3);
  });

  it('refuses on empty turns array (defensive)', () => {
    const r = checkMoveBasedAdvance(1, []);
    expect(r.canAdvance).toBe(false);
    expect(r.reason).toMatch(/no turns in window|only 0\/3/);
  });
});

describe('checkMoveBasedAdvance — Julia real-data replay', () => {
  // Reconstructed from the 2026-07-06 Sunday sitting + 2026-07-07 Monday
  // sitting inspector output. Approximates the last-10-turn window the
  // router would see on the next router pass. Purpose: verify the rule
  // fires cleanly on the exact data that motivated PR 4b's existence.

  const juliaWindow = [
    // Sunday, mid-session — Adult Self Meeting emerging (stage_3 work)
    makeTurn({
      _daysAgo: 1,
      moveJustPerformed: [
        'stage_3.adult_self_cocreation',
        'universal.stability_check',
      ] as CanonicalMove[],
      intensity: 5,
      safetyFlag: 'none',
      _adultSelfPresent: true,
    }),
    // Sunday transition turn — no captures (universal-only)
    makeTurn({
      _daysAgo: 1,
      moveJustPerformed: [
        'universal.witness_and_reflect',
      ] as CanonicalMove[],
      intensity: 5,
      safetyFlag: 'watch',
    }),
    // Sunday close — stage_3 + landscape + session_close
    makeTurn({
      _daysAgo: 1,
      moveJustPerformed: [
        'stage_3.adult_self_cocreation',
        'universal.practice_landscape',
        'universal.session_close',
      ] as CanonicalMove[],
      intensity: 2,
      safetyFlag: 'none',
      _adultSelfPresent: true,
    }),
    // Monday morning — three watch-flagged reflective turns
    makeTurn({
      _daysAgo: 0,
      moveJustPerformed: [] as CanonicalMove[],
      intensity: 5,
      safetyFlag: 'watch',
    }),
    makeTurn({
      _daysAgo: 0,
      moveJustPerformed: [] as CanonicalMove[],
      intensity: 5,
      safetyFlag: 'watch',
    }),
    makeTurn({
      _daysAgo: 0,
      moveJustPerformed: [] as CanonicalMove[],
      intensity: 5,
      safetyFlag: 'watch',
    }),
    // Monday — Two-Versions Image Return with stage_7 qualities inventory
    makeTurn({
      _daysAgo: 0,
      moveJustPerformed: [
        'universal.practice_landscape',
        'stage_7.qualities_inventory',
        'universal.witness_and_reflect',
      ] as CanonicalMove[],
      intensity: 3,
      safetyFlag: 'none',
      _adultSelfPresent: true,
    }),
    // Monday — close, more stage_7
    makeTurn({
      _daysAgo: 0,
      moveJustPerformed: [
        'universal.session_close',
        'stage_7.qualities_inventory',
      ] as CanonicalMove[],
      intensity: 3,
      safetyFlag: 'none',
      _adultSelfPresent: true,
    }),
  ];

  it('advances from Stage 1 → Stage 2 on the Sunday-Monday window', () => {
    const r = checkMoveBasedAdvance(1, juliaWindow);
    expect(r.canAdvance).toBe(true);
    expect(r.reason).toContain('advancing 1 → 2');
    // At least 3 of the qualifying turns — sanity check the counter.
    expect(r.qualifyingTurnCount).toBeGreaterThanOrEqual(3);
  });

  it('would also advance the next turn from Stage 2 → Stage 3 (stage_3 moves in window)', () => {
    const r = checkMoveBasedAdvance(2, juliaWindow);
    expect(r.canAdvance).toBe(true);
    expect(r.reason).toContain('advancing 2 → 3');
  });

  it('would still advance from Stage 6 → 7 on stage_7 evidence (staircase, not jump)', () => {
    // Only the two stage_7 turns count now — needs 3, so this should NOT
    // fire on this same window. Verifies the "+1 only, sustained" rule.
    const r = checkMoveBasedAdvance(6, juliaWindow);
    expect(r.canAdvance).toBe(false);
    expect(r.qualifyingTurnCount).toBe(2);
  });
});
