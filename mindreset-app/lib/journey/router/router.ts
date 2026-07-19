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
  type GateResult,
} from './stage-gates';
import { loadRecentTurns, type AuditTurn } from './history';
import { checkMoveBasedAdvance } from './move-based-advance';

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

// The 'advance' decision now carries a `lane` discriminator so
// applyRouteDecision can log which path fired (classic per-stage gate vs
// move-based lane added in PR 4b, 2026-07-07). Purely observational —
// downstream behaviour is identical for both.
export type AdvancementLane = 'classic_gate' | 'move_based';

export type RouteDecision =
  | { kind: 'stay'; reasons: string[] }
  | { kind: 'advance'; from: number; to: number; lane: AdvancementLane; gateReasons: string[] }
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

  // Journey P1 (2026-07-19, audit RC5) — open-cycle guard. A therapeutic
  // cycle the AI itself reports as open (parts contact, foreign-material
  // work, somatic activation mid-process) means unresolved activation: no
  // advancement or discharge may fire from this turn, on either lane.
  // Regression and stay are unaffected — stepping back with an open cycle
  // is legitimate clinical movement. Only the LAST turn is read, so a
  // stale 'open' from an earlier turn self-heals on the next report.
  const openCycleOnLastTurn = last.report.cycleStatus === 'open';

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
    if (openCycleOnLastTurn) {
      return { kind: 'stay', reasons: ['open_cycle_blocks_discharge'] };
    }
    const stage8StartedAt = await loadStage8StartedAt(state.userId);
    const gate = checkStage8Gate(state, turns, stage8StartedAt);
    if (gate.passed && action === 'discharge') {
      return { kind: 'discharge', from: 8, gateReasons: [] };
    }
    return { kind: 'stay', reasons: gate.reasons };
  }

  // Open cycle → no advancement this turn, either lane (see guard above).
  if (openCycleOnLastTurn) {
    return { kind: 'stay', reasons: ['open_cycle_blocks_advance'] };
  }

  // Advancement check — classic per-stage gate first.
  const gate = checkCurrentStageGate(state.currentStage, state, turns);
  if (gate.passed) {
    const to = state.currentStage + 1;
    return {
      kind: 'advance',
      from: state.currentStage,
      to,
      lane: 'classic_gate',
      gateReasons: [],
    };
  }

  // Move-based advancement lane — PR 4b (2026-07-07). Parallel path that
  // reads the moveJustPerformed histogram over the same recent-turn
  // window and advances when sustained higher-stage work is observed.
  // Regulation guards match the classic gate's rigor (intensity ≤ 5,
  // safety === 'none', adultSelfPresent ≥ 50% of qualifying turns).
  // Does not require the LLM's `recommendedAction === 'advance'` — that
  // is the deliberate divergence and the whole reason this lane exists.
  // See lib/journey/router/move-based-advance.ts for the rule.
  const moveResult = checkMoveBasedAdvance(state.currentStage, turns);
  if (moveResult.canAdvance) {
    const to = state.currentStage + 1;
    return {
      kind: 'advance',
      from: state.currentStage,
      to,
      lane: 'move_based',
      gateReasons: [moveResult.reason],
    };
  }

  return { kind: 'stay', reasons: [...gate.reasons, moveResult.reason] };
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
      // PR 4b observability — structured log matches the style used by
      // lib/journey/safety/freeze.ts. Shows which lane fired so we can
      // watch adoption of the move-based path over the first weeks
      // after ship.
      console.log('[journey/router] advance', {
        userId,
        from: decision.from,
        to: decision.to,
        lane: decision.lane,
        reasons: decision.gateReasons,
      });
      // Optimistic-concurrency guard on `currentStage: decision.from`
      // (PR 4b review nit, 2026-07-07). Cheap belt-and-braces: if two
      // router passes race and one has already advanced the user, the
      // second pass's updateMany matches zero rows — safer than the
      // no-op-because-same-result reliance we had before. Uses
      // updateMany so a zero-row match is a silent no-op rather than
      // an exception. Any surviving race is observable in the log
      // (two advance lines, one succeeded, one silent).
      await prisma.recodeProgress.updateMany({
        where: { userId, currentStage: decision.from },
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
