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

// ---------------------------------------------------------------------------
// Monthly window + structured metadata (PR — 2026-07-24)
// ---------------------------------------------------------------------------
//
// The billing window is an explicit UTC calendar month. We deliberately do
// NOT use `new Date(y, m, 1)` (which constructs a LOCAL-time boundary — on a
// non-UTC server that shifts the window by the offset and can put a turn in
// the wrong month near a boundary). Every boundary is built with `Date.UTC`
// and read with `getUTC*`, so the result is identical regardless of the
// server's timezone.
//
//   window start = first instant of the CURRENT month in UTC
//   reset        = first instant of the NEXT month in UTC
//
// `Date.UTC` normalises a month index of 12 to January of the following year,
// so the December→January rollover needs no special-casing.

export interface MonthWindowUtc {
  windowStartUtc: Date;
  resetAtUtc: Date;
}

export function monthWindowUtc(now: Date): MonthWindowUtc {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    windowStartUtc: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    resetAtUtc: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
  };
}

// Round to 2 decimals (cents / hundredths of a percent) to keep the DERIVED
// fields free of IEEE-754 noise. `spentUsd` and `capUsd` are passed through
// unrounded: spend is reported at full precision (matching the pre-existing
// 429 payload) and the cap is a configured whole number.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sum the current calendar month's Journey-attributed AI spend for a
 * user. Only counts callSite='journey_turn' + 'verifier_journey' rows —
 * MiniMind chat is billed against the user's tier separately and shouldn't
 * count against the Journey cap.
 */
export async function journeyMonthlySpendUsd(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  // Explicit UTC month start — same boundary reported in the metadata, so the
  // query window and the reported window can never disagree.
  const { windowStartUtc } = monthWindowUtc(now);
  const result = await prisma.aiUsage.aggregate({
    where: {
      userId,
      createdAt: { gte: windowStartUtc },
      callSite: { in: ['journey_turn', 'verifier_journey'] },
    },
    _sum: { costUsd: true },
  });
  return result._sum.costUsd ?? 0;
}

/**
 * Structured monthly-cap metadata. Every field is present on EVERY verdict, so
 * callers (the turn route now; the frontend in a later PR) get a complete,
 * unambiguous picture without re-deriving anything.
 *
 *   spentUsd       — current-month Journey spend (raw, full precision)
 *   capUsd         — the user's EFFECTIVE hard cap ($50 default, or a valid
 *                    per-user override, e.g. $150)
 *   remainingUsd   — max(0, cap - spent), rounded to cents. Never negative: at
 *                    or over the cap it is 0, so it can never present a
 *                    misleading "allowance left".
 *   usagePercent   — spent / cap * 100, rounded to 2 dp. MAY EXCEED 100 when
 *                    actual spend is over the cap (e.g. 100.12). This is
 *                    intentional — it lets a caller distinguish "just over"
 *                    from "far over". Clamp for display downstream if desired.
 *   warnUsd        — the warn threshold ($40 default), always included.
 *   windowStartUtc — ISO-8601, first instant of the CURRENT month (UTC).
 *   resetAtUtc     — ISO-8601, first instant of the NEXT month (UTC).
 */
export interface MonthlyCapMetadata {
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  usagePercent: number;
  warnUsd: number;
  windowStartUtc: string;
  resetAtUtc: string;
}

export type MonthlyCapVerdict = 'ok' | 'warn' | 'over_cap';

export interface MonthlyCapCheck extends MonthlyCapMetadata {
  verdict: MonthlyCapVerdict;
}

/**
 * Build the structured metadata for a spend/cap pair at a given instant.
 * Pure — no I/O. `now` fixes the UTC window so the query bound and the
 * reported window are guaranteed to agree.
 */
export function buildMonthlyCapMetadata(
  spentUsd: number,
  capUsd: number,
  warnUsd: number,
  now: Date,
): MonthlyCapMetadata {
  const { windowStartUtc, resetAtUtc } = monthWindowUtc(now);
  const remainingUsd = capUsd > 0 ? round2(Math.max(0, capUsd - spentUsd)) : 0;
  const usagePercent = capUsd > 0 ? round2((spentUsd / capUsd) * 100) : 0;
  return {
    spentUsd,
    capUsd,
    remainingUsd,
    usagePercent,
    warnUsd,
    windowStartUtc: windowStartUtc.toISOString(),
    resetAtUtc: resetAtUtc.toISOString(),
  };
}

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
  const now = new Date();
  // Per-user effective cap: the account's validly-configured override, else
  // the normal cap. Warn threshold is unchanged.
  const capUsd = journeyMonthlyHardCapUsdForUser(userId);
  const warnUsd = journeyMonthlyWarnUsd();

  let spentUsd: number;
  try {
    spentUsd = await journeyMonthlySpendUsd(userId, now);
  } catch (err) {
    console.error('[monthly-cap] aggregate failed, failing open:', err);
    // Fail-open: report zero spend so the turn proceeds. Metadata is still
    // complete (full allowance remaining) so callers never see a
    // half-populated result.
    return { verdict: 'ok', ...buildMonthlyCapMetadata(0, capUsd, warnUsd, now) };
  }

  const meta = buildMonthlyCapMetadata(spentUsd, capUsd, warnUsd, now);
  if (spentUsd >= capUsd) return { verdict: 'over_cap', ...meta };
  if (spentUsd >= warnUsd) return { verdict: 'warn', ...meta };
  return { verdict: 'ok', ...meta };
}

/**
 * The structured HTTP 429 body for a HARD monthly-cap rejection. Kept beside
 * the cap logic (not inlined in the route) so the wire contract is
 * unit-testable without booting the route.
 *
 * `reason: 'journey_monthly_spend_cap'` makes it unambiguously distinguishable
 * from the rate-limit 429 (which uses `error: 'Rate limited'` and carries no
 * `reason`). The `error` code is preserved from the pre-existing contract for
 * backward compatibility; the metadata fields are additive.
 */
export function journeyMonthlyCapRejectionPayload(check: MonthlyCapCheck) {
  return {
    error: 'monthly_spend_cap_reached',
    reason: 'journey_monthly_spend_cap',
    spentUsd: check.spentUsd,
    capUsd: check.capUsd,
    remainingUsd: check.remainingUsd,
    usagePercent: check.usagePercent,
    warnUsd: check.warnUsd,
    windowStartUtc: check.windowStartUtc,
    resetAtUtc: check.resetAtUtc,
  };
}
