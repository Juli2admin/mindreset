// Journey operational-cost reporting — pure view-model layer (PR 4B, 2026-07-25).
//
// Level A ONLY (cost operations). No turn attribution, no revenue, no
// profitability. The admin page runs the Prisma queries; everything here is
// pure (no I/O) so it is unit-tested under vitest's node env. Cap logic is
// NOT reimplemented — we reuse the public pure functions from
// lib/ai-usage/monthly-cap.ts so the dashboard and enforcement agree exactly.
//
// Data-quality limits inherited from the recording layer (documented, not
// corrected here): failed/interrupted turns record no usage (undercount);
// numbers are per AI CALL / per successful generation, never per user turn
// (AiUsage.journeyTurnId is unpopulated).

import {
  journeyMonthlyHardCapUsdForUser,
  journeyMonthlyWarnUsd,
  buildMonthlyCapMetadata,
  monthWindowUtc,
} from '@/lib/ai-usage/monthly-cap';

// The two call sites that make up Journey AI spend (mirrors the monthly-cap
// filter in lib/ai-usage/monthly-cap.ts). MiniMind / States / Themes are
// separate products and are excluded.
export const JOURNEY_CALL_SITES = ['journey_turn', 'verifier_journey'] as const;
export type JourneyCallSite = (typeof JOURNEY_CALL_SITES)[number];

export function isJourneyCallSite(callSite: string): boolean {
  return (JOURNEY_CALL_SITES as readonly string[]).includes(callSite);
}

export function filterJourneyRows<T extends { callSite: string }>(
  rows: T[],
): T[] {
  return rows.filter((r) => isJourneyCallSite(r.callSite));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Time windows — all UTC-explicit so the dashboard matches cap enforcement
// (which uses monthWindowUtc). Do NOT use local-time Date constructors.
// ---------------------------------------------------------------------------

export interface ReportWindows {
  /** First instant of the current UTC day. */
  todayStartUtc: Date;
  /** now − 7 days (rolling instant). */
  sevenDayStart: Date;
  /** First instant of the current UTC month (matches the cap). */
  monthStartUtc: Date;
}

export function journeyReportWindows(now: Date): ReportWindows {
  const todayStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const sevenDayStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStartUtc = monthWindowUtc(now).windowStartUtc;
  return { todayStartUtc, sevenDayStart, monthStartUtc };
}

// ---------------------------------------------------------------------------
// Simple derived numbers
// ---------------------------------------------------------------------------

/** Average USD cost per AI CALL (one AiUsage row = one call). 0 when no calls. */
export function avgCostPerCall(totalCostUsd: number, callCount: number): number {
  if (callCount <= 0) return 0;
  return round4(totalCostUsd / callCount);
}

// ---------------------------------------------------------------------------
// Cost breakdown by key (model or call site)
// ---------------------------------------------------------------------------

export interface CostRow {
  key: string;
  costUsd: number;
  calls: number;
  avgCostPerCall: number;
}

/**
 * Shape grouped rows into sorted CostRows (highest cost first). Input is the
 * page's trivial mapping of a Prisma groupBy result — decoupled from Prisma
 * types so it is unit-testable. Null/blank keys become 'unknown'.
 */
export function toCostRows(
  groups: Array<{ key: string | null; costUsd: number | null; calls: number }>,
): CostRow[] {
  return groups
    .map((g) => {
      const costUsd = round4(g.costUsd ?? 0);
      return {
        key: g.key && g.key.length > 0 ? g.key : 'unknown',
        costUsd,
        calls: g.calls,
        avgCostPerCall: avgCostPerCall(costUsd, g.calls),
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);
}

// ---------------------------------------------------------------------------
// Highest-cost users
// ---------------------------------------------------------------------------

export interface UserCostRow {
  userId: string;
  email: string | null;
  costUsd: number;
  calls: number;
}

export function toUserCostRows(
  groups: Array<{ userId: string; costUsd: number | null; calls: number }>,
  emailByUserId: Map<string, string | null>,
): UserCostRow[] {
  return groups
    .map((g) => ({
      userId: g.userId,
      email: emailByUserId.get(g.userId) ?? null,
      costUsd: round4(g.costUsd ?? 0),
      calls: g.calls,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

// ---------------------------------------------------------------------------
// Daily cost trend (UTC day buckets, zero-filled)
// ---------------------------------------------------------------------------

export interface DailyPoint {
  /** UTC calendar day, YYYY-MM-DD. */
  dayUtc: string;
  costUsd: number;
  calls: number;
}

/**
 * Bucket raw Journey rows into the last `days` UTC calendar days, oldest
 * first, zero-filling empty days. Rows outside the window are ignored.
 */
export function bucketDailyCost(
  rows: Array<{ createdAt: Date; costUsd: number }>,
  now: Date,
  days = 30,
): DailyPoint[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStartUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const buckets = new Map<string, { costUsd: number; calls: number }>();
  const order: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(todayStartUtc - i * dayMs).toISOString().slice(0, 10);
    buckets.set(key, { costUsd: 0, calls: 0 });
    order.push(key);
  }
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      b.costUsd += r.costUsd;
      b.calls += 1;
    }
  }
  return order.map((key) => {
    const b = buckets.get(key)!;
    return { dayUtc: key, costUsd: round4(b.costUsd), calls: b.calls };
  });
}

// ---------------------------------------------------------------------------
// Per-user monthly cap utilisation — reuses the public cap API (no re-derived
// thresholds; resolves Julia's $150 override without exposing any config).
// ---------------------------------------------------------------------------

export type CapStatus = 'normal' | 'warning' | 'over_cap';

export interface UserCapRow {
  userId: string;
  email: string | null;
  capUsd: number;
  spentUsd: number;
  remainingUsd: number;
  usagePercent: number;
  status: CapStatus;
}

/**
 * Build the cap-utilisation table from ONE grouped per-user spend query.
 * For each row the effective cap comes from journeyMonthlyHardCapUsdForUser
 * (which resolves any configured override server-side and returns only a
 * number — never env names/values), and remaining/percent come from the same
 * buildMonthlyCapMetadata used in enforcement. Status boundaries mirror
 * checkJourneyMonthlyCap exactly. Sorted by usage percent, descending.
 */
export function buildCapTable(
  rows: Array<{ userId: string; spentUsd: number }>,
  emailByUserId: Map<string, string | null>,
  now: Date,
): UserCapRow[] {
  const warnUsd = journeyMonthlyWarnUsd();
  return rows
    .map(({ userId, spentUsd }) => {
      const capUsd = journeyMonthlyHardCapUsdForUser(userId);
      const meta = buildMonthlyCapMetadata(spentUsd, capUsd, warnUsd, now);
      const status: CapStatus =
        spentUsd >= capUsd
          ? 'over_cap'
          : spentUsd >= warnUsd
            ? 'warning'
            : 'normal';
      return {
        userId,
        email: emailByUserId.get(userId) ?? null,
        capUsd,
        spentUsd: meta.spentUsd,
        remainingUsd: meta.remainingUsd,
        usagePercent: meta.usagePercent,
        status,
      };
    })
    .sort((a, b) => b.usagePercent - a.usagePercent);
}
