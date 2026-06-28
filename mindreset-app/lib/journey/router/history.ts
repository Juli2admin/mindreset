// Audit-log helpers used by the stage-gate functions.
//
// The state reports are stored encrypted on JourneyTurn rows. Gate logic
// needs to look at fields like adultSelfPresent and compassionBridgeQuality
// across the most recent N turns to decide whether a stage's criteria are
// met. We decrypt on read; the audit table itself stays encrypted at rest.

import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';
import { parseStateReport } from '../stateReport/parse';
import type { StateReport } from '../stateReport/schema';

export type AuditTurn = {
  id: string;
  createdAt: Date;
  stageAtTurn: number;
  depthAtTurn: string;
  intensityReported: number | null;
  safetyFlag: string;
  recommendedAction: string | null;
  report: StateReport;
};

/**
 * Load the most recent N audit turns for a user and decrypt their state
 * reports. Returns turns oldest-first so gate functions can do forward
 * checks (e.g. "in any of the last 5 turns the user was overwhelmed").
 */
export async function loadRecentTurns(
  userId: string,
  limit: number,
): Promise<AuditTurn[]> {
  const rows = await prisma.journeyTurn.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      stageAtTurn: true,
      depthAtTurn: true,
      intensityReported: true,
      safetyFlag: true,
      recommendedAction: true,
      stateReportEncrypted: true,
    },
  });
  const reversed = rows.slice().reverse();
  return reversed.map((r) => {
    let report: StateReport = { intensity: 5, safetyFlag: 'watch', recommendedAction: 'stay' };
    if (r.stateReportEncrypted) {
      try {
        const json = decrypt(r.stateReportEncrypted);
        report = parseStateReport(json);
      } catch {
        // fall through with defensive default
      }
    }
    return {
      id: r.id,
      createdAt: r.createdAt,
      stageAtTurn: r.stageAtTurn,
      depthAtTurn: r.depthAtTurn,
      intensityReported: r.intensityReported,
      safetyFlag: r.safetyFlag,
      recommendedAction: r.recommendedAction,
      report,
    };
  });
}

/** Count distinct calendar days (UTC) across an array of turns. */
export function distinctDays(turns: AuditTurn[]): number {
  const days = new Set<string>();
  for (const t of turns) {
    days.add(t.createdAt.toISOString().slice(0, 10));
  }
  return days.size;
}

/**
 * Whether a given predicate held at least once on each of at least N distinct
 * calendar days across the supplied turns.
 */
export function heldOnDistinctDays(
  turns: AuditTurn[],
  predicate: (t: AuditTurn) => boolean,
  n: number,
): boolean {
  return distinctDays(turns.filter(predicate)) >= n;
}

/** The most recent two intensity readings, ignoring nulls. */
export function lastTwoIntensities(turns: AuditTurn[]): number[] {
  const out: number[] = [];
  for (let i = turns.length - 1; i >= 0 && out.length < 2; i--) {
    if (typeof turns[i].intensityReported === 'number') {
      out.push(turns[i].intensityReported!);
    }
  }
  return out;
}

/** Whether the safety flag has been 'none' for at least the last N turns. */
export function safetyNoneForLast(turns: AuditTurn[], n: number): boolean {
  const tail = turns.slice(-n);
  if (tail.length < n) return false;
  return tail.every((t) => t.safetyFlag === 'none');
}

/**
 * Looser safety guard: returns true if NO turn in the last N has a 'red_flag'
 * safetyFlag. 'watch' does not block. Used by Stage 1 (assessment phase),
 * where exploring difficult material appropriately carries 'watch' flags —
 * if 'watch' blocked advancement, the gate would never close for any real
 * user. Red flag still blocks (also triggers freeze separately).
 *
 * Unlike safetyNoneForLast, this does NOT require N turns to exist —
 * shorter histories pass as long as nothing in them is red_flag.
 */
export function noRedFlagInLast(turns: AuditTurn[], n: number): boolean {
  const tail = turns.slice(-n);
  return tail.every((t) => t.safetyFlag !== 'red_flag');
}

// Mirrors the session boundary used by state/load.ts. A gap ≥ 4 hours
// between two consecutive turns marks the start of a new session.
const SESSION_BOUNDARY_MS = 4 * 60 * 60 * 1000;

/**
 * Return the subset of `turns` that belong to the most recent `n` sessions.
 * Sessions are detected by gaps ≥ 4 hours between consecutive turns —
 * the same rule state/load.ts uses for sessionCount. Used by stage gates
 * whose canon §10 thresholds are session-scoped (e.g. Stage 6 / Stage 7
 * "across last 3 sessions"). If the audit window contains fewer than `n`
 * sessions, returns every turn it has.
 */
export function lastNSessionsTurns(turns: AuditTurn[], n: number): AuditTurn[] {
  if (turns.length === 0 || n <= 0) return [];
  // Walk backwards counting boundaries until we have n sessions.
  let sessionsSeen = 1;
  let startIdx = 0;
  for (let i = turns.length - 1; i > 0; i--) {
    const gap = turns[i].createdAt.getTime() - turns[i - 1].createdAt.getTime();
    if (gap >= SESSION_BOUNDARY_MS) {
      sessionsSeen++;
      if (sessionsSeen > n) {
        startIdx = i;
        break;
      }
    }
  }
  return turns.slice(startIdx);
}

/**
 * Count how many distinct sessions exist across the supplied turns,
 * using the same 4-hour boundary as lastNSessionsTurns / state/load.ts.
 * Returns 0 if there are no turns.
 */
export function countSessions(turns: AuditTurn[]): number {
  if (turns.length === 0) return 0;
  let sessions = 1;
  for (let i = 1; i < turns.length; i++) {
    const gap = turns[i].createdAt.getTime() - turns[i - 1].createdAt.getTime();
    if (gap >= SESSION_BOUNDARY_MS) sessions++;
  }
  return sessions;
}
