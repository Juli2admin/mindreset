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
  const capUsd = journeyMonthlyHardCapUsd();
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
