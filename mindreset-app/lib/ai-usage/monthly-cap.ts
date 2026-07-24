// Per-user monthly AI spend cap for Journey.
//
// PR ε (2026-07-11) — pre-launch audit HIGH finding. Julia's principle:
// "protect app from abusive bots, or overspending users outside of paid
// plan/subscriptions." The 5,000-message Journey abuse cap is a hard
// ceiling for bot-scale abuse; this softer per-user monthly $ cap
// catches the middle ground of one abusive account spending sustained
// hours on Sonnet-tier calls before anyone notices.
//
// Threshold defaults:
//   - Hard cap: $50 / user / calendar month. Refuse further Journey
//     turns for the rest of the month.
//   - Warn threshold: $40 (80% of hard). Log to Vercel + Sentry so
//     Julia can reach out before the user is blocked.
//
// A £599/1-year Journey user typically runs $75–$180/year in AI cost
// (~$6–15/month average). $50/month is ~3× a heavy legitimate month —
// comfortable headroom for real users, but stops runaway abuse.
//
// Configurable via env vars so Julia can tune without a deploy:
//   JOURNEY_MONTHLY_SPEND_CAP_USD (default: 50)
//   JOURNEY_MONTHLY_SPEND_WARN_USD (default: 40)

import prisma from '@/lib/prisma';

const DEFAULT_HARD_CAP_USD = 50;
const DEFAULT_WARN_USD = 40;

function readCap(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function journeyMonthlyHardCapUsd(): number {
  return readCap('JOURNEY_MONTHLY_SPEND_CAP_USD', DEFAULT_HARD_CAP_USD);
}

export function journeyMonthlyWarnUsd(): number {
  return readCap('JOURNEY_MONTHLY_SPEND_WARN_USD', DEFAULT_WARN_USD);
}

// Per-user monthly cap override (2026-07-24). A specific, itemised financial
// override keyed by IMMUTABLE Clerk user ID — deliberately NOT admin, owner,
// tester, pilot, or email-based identity. It lets a named account (e.g. a
// product owner's personal testing account) run a HIGHER FINITE monthly cap
// without lifting the cap for anyone else and without an unlimited exemption.
//
// Two env vars:
//   JOURNEY_CAP_OVERRIDE_USER_IDS — comma-separated Clerk user IDs
//   JOURNEY_CAP_OVERRIDE_USD      — the override monthly cap, in USD
//
// Fail-safe by construction: the override applies ONLY when the caller's
// userId is on the list AND the amount parses to a finite number > 0. If the
// user isn't listed, the list is empty/unset, or the amount is missing or
// invalid, the account keeps the normal cap. A misconfiguration can only fall
// back to the normal cap — it can never remove or disable the cap.

/**
 * Resolve a per-user cap override in USD, or null if none applies. Returns a
 * positive finite number only when the userId is in JOURNEY_CAP_OVERRIDE_USER_IDS
 * and JOURNEY_CAP_OVERRIDE_USD is a finite value > 0. Never throws; never
 * returns 0 or a non-positive value.
 */
export function journeyCapOverrideUsdForUser(userId: string): number | null {
  const rawIds = process.env.JOURNEY_CAP_OVERRIDE_USER_IDS;
  if (!rawIds) return null;
  const ids = rawIds
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!ids.includes(userId)) return null;

  const rawAmount = process.env.JOURNEY_CAP_OVERRIDE_USD;
  if (!rawAmount) return null;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

/**
 * The effective monthly hard cap for a specific user: their validly-configured
 * per-user override if one applies, otherwise the normal cap. Fail-safe — any
 * missing/invalid override configuration resolves to the normal cap.
 */
export function journeyMonthlyHardCapUsdForUser(userId: string): number {
  return journeyCapOverrideUsdForUser(userId) ?? journeyMonthlyHardCapUsd();
}

/**
 * Sum the current calendar month's Journey-attributed AI spend for a
 * user. Only counts callSite='journey_turn' + 'verifier_journey' rows —
 * MiniMind chat is billed against the user's tier separately and shouldn't
 * count against the Journey cap.
 */
export async function journeyMonthlySpendUsd(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await prisma.aiUsage.aggregate({
    where: {
      userId,
      createdAt: { gte: monthStart },
      callSite: { in: ['journey_turn', 'verifier_journey'] },
    },
    _sum: { costUsd: true },
  });
  return result._sum.costUsd ?? 0;
}

export type MonthlyCapCheck =
  | { verdict: 'ok'; spentUsd: number; capUsd: number }
  | {
      verdict: 'warn';
      spentUsd: number;
      capUsd: number;
      warnUsd: number;
    }
  | {
      verdict: 'over_cap';
      spentUsd: number;
      capUsd: number;
    };

/**
 * Check a user's current-month Journey spend against the caps. Returns:
 *   - 'over_cap' → caller must refuse the turn.
 *   - 'warn'     → caller allows the turn but logs.
 *   - 'ok'       → normal.
 *
 * Best-effort: if the AiUsage table read fails, returns 'ok' (fail-open).
 * The rate limit + 5,000-message hard cap are the real abuse guards; this
 * is a warm-fuzzies mid-range check.
 */
export async function checkJourneyMonthlyCap(
  userId: string,
): Promise<MonthlyCapCheck> {
  // Per-user effective cap: the account's validly-configured override, else
  // the normal cap. Warn threshold is unchanged (out of scope for this PR).
  const capUsd = journeyMonthlyHardCapUsdForUser(userId);
  const warnUsd = journeyMonthlyWarnUsd();

  let spentUsd: number;
  try {
    spentUsd = await journeyMonthlySpendUsd(userId);
  } catch (err) {
    console.error(
      '[monthly-cap] aggregate failed, failing open:',
      err,
    );
    return { verdict: 'ok', spentUsd: 0, capUsd };
  }

  if (spentUsd >= capUsd) {
    return { verdict: 'over_cap', spentUsd, capUsd };
  }
  if (spentUsd >= warnUsd) {
    return { verdict: 'warn', spentUsd, capUsd, warnUsd };
  }
  return { verdict: 'ok', spentUsd, capUsd };
}
