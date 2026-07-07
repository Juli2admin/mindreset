// Move-based advancement lane — PR 4b (2026-07-07).
//
// A parallel path to stage advancement. Sits alongside the existing per-
// stage gate functions in stage-gates.ts and never replaces them. Both
// lanes run on every router pass; if EITHER says advance, the router
// advances currentStage by +1.
//
// Purpose:
//   The classic gates require the LLM to emit `recommendedAction: 'advance'`
//   — but the master prompt tells the LLM to reserve that only for after
//   an explicit share-back milestone. Meanwhile the LLM freely does
//   Stage 3–7 clinical moves (as seen in real sessions). Result: the
//   router stayed at Stage 1 while the AI ran textbook Stage 6/7 work.
//
//   This lane observes the AI's `moveJustPerformed` histogram over the
//   recent turn window. If the AI has sustainedly been naming moves that
//   canonically belong to a higher stage AND the user is regulated
//   (matching classic-gate rigor), the code advances.
//
// Owner-locked rules (2026-07-07):
//   1. Universal moves (`universal.*`) do NOT count for advancement.
//      Only stage-scoped IDs (`stage_N.<move>`) contribute.
//   2. In a turn with mixed moves, we take the highest stage-scoped
//      stage number from that turn and compare to `currentStage + 1`.
//   3. +1 advancement only. Never multi-jump. If sustained work is
//      happening at Stage 7 while the router is at Stage 1, we advance
//      to Stage 2 this pass. Next session, if the pattern repeats, 2 → 3.
//   4. No retroactive marking of skipped stages as "clinically
//      completed". This lane just moves the pointer forward; the classic
//      gate's per-stage MII fields stay in whatever state they are.
//   5. Zero LLM `recommendedAction` requirement — the whole point of the
//      lane is to advance without it.
//   6. Classic-gate rigor is matched for regulation (intensity ≤ 5,
//      safetyFlag === 'none') — never softer. adultSelfPresent required
//      in ≥ 50% of counting turns.
//   7. Stage 8 uses the discharge lane in router.ts; this lane no-ops
//      when `currentStage >= 8`.
//
// This module has NO Prisma calls — pure predicate on data the router
// already loaded via loadRecentTurns.

import type { AuditTurn } from './history';
import type { SafetyFlag } from '../state/types';

// Sustained-work thresholds, tuned to prefer safety over speed (owner
// decision 2026-07-07: strict > responsive on the first cut).
const REQUIRED_QUALIFYING_TURNS = 3;
const MAX_INTENSITY = 5;
const REQUIRED_SAFETY: SafetyFlag = 'none';
const REQUIRED_ADULT_SELF_PRESENT_RATIO = 0.5;
const MOVE_ID_STAGE_RE = /^stage_(\d)\./;

export type MoveBasedAdvanceResult = {
  canAdvance: boolean;
  /** One-line reason string for logging + observability. */
  reason: string;
  /**
   * How many turns in the window qualified (had a stage-scoped move at
   * target stage or above AND passed the guards). Purely informational
   * — the boolean is authoritative.
   */
  qualifyingTurnCount: number;
};

/**
 * Extract the highest stage number from a turn's `moveJustPerformed` array,
 * or null if there is no stage-scoped move.
 *
 * Universal moves (`universal.*`) return null — they signal clinical
 * activity but never a stage. In a turn with mixed moves, the highest
 * stage-scoped ID's stage number wins. Owner rules #1 and #2.
 *
 * Exported for testing.
 */
export function getStageFromTurnMoves(turn: AuditTurn): number | null {
  const moves = turn.report.moveJustPerformed;
  if (!Array.isArray(moves) || moves.length === 0) return null;
  let maxStage: number | null = null;
  for (const id of moves) {
    if (typeof id !== 'string') continue;
    const m = MOVE_ID_STAGE_RE.exec(id);
    if (!m) continue; // universal or unrecognised prefix
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 1 || n > 8) continue;
    if (maxStage === null || n > maxStage) maxStage = n;
  }
  return maxStage;
}

/**
 * Decide whether the move-based lane authorises `currentStage + 1`.
 *
 * Returns `canAdvance: true` only when ALL of these hold across `turns`
 * (which the router passes as the same recent-N window used by the
 * classic gate — see router.ts TURN_WINDOWS):
 *
 *   1. ≥ REQUIRED_QUALIFYING_TURNS turns each emitted at least one
 *      stage-scoped move at stage ≥ currentStage + 1.
 *   2. Those qualifying turns each had:
 *        - safetyFlag === 'none'
 *        - intensity ≤ MAX_INTENSITY
 *   3. Adult self was present (`adultSelfPresent === true`) in at least
 *      REQUIRED_ADULT_SELF_PRESENT_RATIO of the qualifying turns.
 *   4. currentStage < 8 (Stage 8 handled by the discharge lane).
 *
 * The `frozenForReview` check lives in decideRoute (frozen short-circuits
 * before the lane is called), so this function does not re-check it.
 *
 * The `reason` string is intended for the advancement log line the router
 * writes in applyRouteDecision — it's grep-friendly and includes counters.
 */
export function checkMoveBasedAdvance(
  currentStage: number,
  turns: AuditTurn[],
): MoveBasedAdvanceResult {
  if (currentStage < 1 || currentStage >= 8) {
    return {
      canAdvance: false,
      reason: 'move_lane: stage_out_of_range',
      qualifyingTurnCount: 0,
    };
  }

  // Current-turn regulation gate (PR 4b review fix, 2026-07-07). The
  // classic gate's rigor is recency-anchored — `lastTwoIntensities`
  // reads the SUFFIX (most recent) not the WHOLE window. Without this
  // check, a user could have 3 clean stage_7 turns Sunday, then present
  // a dysregulated turn Monday (intensity=9, safety=watch) and the
  // lane would still advance them at the exact moment they are least
  // regulated. This closes that gap: refuse advancement whenever the
  // most recent turn itself would fail the regulation guards. A null
  // intensity on the current turn is treated as uncertainty → refuse.
  if (turns.length === 0) {
    return {
      canAdvance: false,
      reason: 'move_lane: no turns in window',
      qualifyingTurnCount: 0,
    };
  }
  const currentTurn = turns[turns.length - 1];
  if (currentTurn.safetyFlag !== REQUIRED_SAFETY) {
    return {
      canAdvance: false,
      reason: `move_lane: current turn safety=${currentTurn.safetyFlag} (require ${REQUIRED_SAFETY})`,
      qualifyingTurnCount: 0,
    };
  }
  if (currentTurn.intensityReported === null) {
    return {
      canAdvance: false,
      reason: 'move_lane: current turn intensity null',
      qualifyingTurnCount: 0,
    };
  }
  if (currentTurn.intensityReported > MAX_INTENSITY) {
    return {
      canAdvance: false,
      reason: `move_lane: current turn intensity=${currentTurn.intensityReported} (require ≤ ${MAX_INTENSITY})`,
      qualifyingTurnCount: 0,
    };
  }

  const targetStage = currentStage + 1;

  // Collect only the turns that emitted a qualifying stage-scoped move
  // AND passed the regulation guards. Adult-self ratio checked over
  // this same subset (see below).
  const qualifying: AuditTurn[] = [];
  for (const t of turns) {
    const stageFromMove = getStageFromTurnMoves(t);
    if (stageFromMove === null || stageFromMove < targetStage) continue;
    if (t.safetyFlag !== REQUIRED_SAFETY) continue;
    if (t.intensityReported === null) continue;
    if (t.intensityReported > MAX_INTENSITY) continue;
    qualifying.push(t);
  }

  if (qualifying.length < REQUIRED_QUALIFYING_TURNS) {
    return {
      canAdvance: false,
      reason: `move_lane: only ${qualifying.length}/${REQUIRED_QUALIFYING_TURNS} qualifying turns at stage ≥ ${targetStage}`,
      qualifyingTurnCount: qualifying.length,
    };
  }

  const withAdultSelf = qualifying.filter(
    (t) => t.report.adultSelfPresent === true,
  ).length;
  const adultSelfRatio = withAdultSelf / qualifying.length;
  if (adultSelfRatio < REQUIRED_ADULT_SELF_PRESENT_RATIO) {
    return {
      canAdvance: false,
      reason: `move_lane: adult self present in only ${withAdultSelf}/${qualifying.length} qualifying turns (need ≥ ${Math.ceil(REQUIRED_ADULT_SELF_PRESENT_RATIO * qualifying.length)})`,
      qualifyingTurnCount: qualifying.length,
    };
  }

  return {
    canAdvance: true,
    reason: `move_lane: ${qualifying.length} qualifying turns at stage ≥ ${targetStage}, adult self present in ${withAdultSelf}/${qualifying.length}, advancing ${currentStage} → ${targetStage}`,
    qualifyingTurnCount: qualifying.length,
  };
}
