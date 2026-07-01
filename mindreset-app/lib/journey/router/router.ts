// The Journey router.
//
// Called from finaliseTurn after state report parsing and persistence.
// Decides whether the user stays in the current stage, advances to the next,
// or regresses to grounding / parts work.
//
// Code holds the gates. The AI's recommendedAction is advisory — the router
// only advances when the stage's completion criteria are met AND the AI
// agrees. Regression and frozen-for-review take precedence over advancement.

import prisma from '@/lib/prisma';
import type { JourneyState } from '../state/types';
import {
  checkStage1Gate,
  checkStage2Gate,
  checkStage3Gate,
  checkStage4Gate,
  checkStage5Gate,
  checkStage6Gate,
  checkStage7Gate,
  checkStage8Gate,
  outstandingStageCriteria,
  type GateResult,
} from './stage-gates';
import { loadRecentTurns, type AuditTurn } from './history';

// How many recent audit turns each gate inspects. Stage 4 looks at the most;
// Stage 8 looks back further still (for week-count windowing).
const TURN_WINDOWS: Record<number, number> = {
  1: 10,
  2: 10,
  3: 20,
  4: 60,
  5: 30,
  6: 30,
  7: 30,
  8: 120,
};

export type RouteDecision =
  | { kind: 'stay'; reasons: string[] }
  | { kind: 'advance'; from: number; to: number; gateReasons: string[] }
  | { kind: 'regress'; from: number; to: number; reason: string }
  | { kind: 'discharge'; from: 8; gateReasons: string[] }
  | { kind: 'frozen'; reason: string };

/**
 * Decide what should happen for this user after the most recent turn.
 * Apply the decision via applyRouteDecision().
 */
export async function decideRoute(state: JourneyState): Promise<RouteDecision> {
  if (state.frozenForReview) {
    return { kind: 'frozen', reason: state.frozenReason ?? 'frozen_for_review' };
  }

  const window = TURN_WINDOWS[state.currentStage] ?? 20;
  const turns = await loadRecentTurns(state.userId, window);
  if (turns.length === 0) return { kind: 'stay', reasons: ['no_turns_yet'] };

  const last = turns[turns.length - 1];
  const action = last.report.recommendedAction;

  // Handle regression first — code honours the AI's "step back" signal even
  // if the user is otherwise stable. The accumulated landscape is preserved.
  if (action === 'regress_to_grounding') {
    if (state.currentStage > 1) {
      return { kind: 'regress', from: state.currentStage, to: 1, reason: 'ai_regress_to_grounding' };
    }
    return { kind: 'stay', reasons: ['already_at_grounding'] };
  }
  if (action === 'regress_to_parts') {
    if (state.currentStage > 4) {
      return { kind: 'regress', from: state.currentStage, to: 4, reason: 'ai_regress_to_parts' };
    }
    return { kind: 'stay', reasons: ['already_at_or_before_parts'] };
  }

  // Discharge gate at Stage 8
  if (state.currentStage === 8) {
    const stage8StartedAt = await loadStage8StartedAt(state.userId);
    const gate = checkStage8Gate(state, turns, stage8StartedAt);
    if (gate.passed && action === 'discharge') {
      return { kind: 'discharge', from: 8, gateReasons: [] };
    }
    return { kind: 'stay', reasons: gate.reasons };
  }

  // Advancement check
  const gate = checkCurrentStageGate(state.currentStage, state, turns);
  if (gate.passed) {
    const to = state.currentStage + 1;
    return { kind: 'advance', from: state.currentStage, to, gateReasons: [] };
  }
  return { kind: 'stay', reasons: gate.reasons };
}

/**
 * Readiness loop (PR 3). Compute the CURRENT stage's outstanding completion
 * criteria for the prompt's state block, BEFORE the turn runs, so the AI can
 * see what it's still working toward and evaluate advancement each turn.
 *
 * Returns:
 *   - null  — not evaluable yet (no audit history) → the state block renders
 *             nothing, so a brand-new user isn't handed a checklist;
 *   - []    — every tracked content criterion is met → the state block renders
 *             the "you may recommend advancing if the user is steady" nudge;
 *   - lines — the outstanding milestones, in plain clinical language.
 *
 * Uses the same per-stage window the gate uses. Never throws to the caller's
 * hot path — the route wraps it, but we also fail soft here.
 */
export async function loadOutstandingCriteria(
  state: JourneyState,
): Promise<string[] | null> {
  if (state.frozenForReview) return null;
  const window = TURN_WINDOWS[state.currentStage] ?? 20;
  const turns = await loadRecentTurns(state.userId, window);
  if (turns.length === 0) return null;
  return outstandingStageCriteria(state.currentStage, state, turns);
}

function checkCurrentStageGate(
  stage: number,
  state: JourneyState,
  turns: AuditTurn[],
): GateResult {
  switch (stage) {
    case 1: return checkStage1Gate(state, turns);
    case 2: return checkStage2Gate(state, turns);
    case 3: return checkStage3Gate(state, turns);
    case 4: return checkStage4Gate(state, turns);
    case 5: return checkStage5Gate(state, turns);
    case 6: return checkStage6Gate(state, turns);
    case 7: return checkStage7Gate(state, turns);
    default: return { passed: false, reasons: ['unknown_stage'] };
  }
}

/**
 * The Stage 8 minimum-weeks check needs a Stage-8 start timestamp. We derive
 * it from the earliest JourneyTurn with stageAtTurn === 8 for this user.
 */
async function loadStage8StartedAt(userId: string): Promise<Date> {
  const row = await prisma.journeyTurn.findFirst({
    where: { userId, stageAtTurn: 8 },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return row?.createdAt ?? new Date();
}

/**
 * Apply the route decision to the database. Idempotent on stay/frozen.
 * Regression preserves the accumulated landscape (anchor, parts, foreign
 * files, signature images) — only the stage and depth are reset.
 */
export async function applyRouteDecision(
  userId: string,
  decision: RouteDecision,
): Promise<void> {
  switch (decision.kind) {
    case 'stay':
    case 'frozen':
      return;
    case 'advance':
      await prisma.recodeProgress.update({
        where: { userId },
        data: {
          currentStage: decision.to,
          currentDepth: 'surface', // every new stage starts at Surface
          lastActivityAt: new Date(),
        },
      });
      return;
    case 'regress':
      await prisma.recodeProgress.update({
        where: { userId },
        data: {
          currentStage: decision.to,
          currentDepth: 'surface',
          lastActivityAt: new Date(),
        },
      });
      return;
    case 'discharge':
      await prisma.recodeProgress.update({
        where: { userId },
        data: {
          dischargedAt: new Date(),
          lastActivityAt: new Date(),
        },
      });
      return;
  }
}
