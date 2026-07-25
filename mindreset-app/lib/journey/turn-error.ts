// Status-aware classification of a Journey turn failure + pure view helpers.
//
// PR 3 (2026-07-24). The turn route returns distinct, machine-readable
// failures (app/api/journey/turn/route.ts + lib/ai-usage/monthly-cap.ts). This
// module turns a raw fetch outcome into exactly ONE typed TurnError so the
// client can render exactly one correct panel instead of collapsing every
// failure into the old "I lost my thread" fallback. Framework-free and pure so
// it is unit-tested under vitest's node env (this repo has no DOM harness).

export type TurnErrorKind =
  | 'monthly_cap'
  | 'rate_limit'
  | 'access'
  | 'screening'
  | 'technical';

export interface MonthlyCapInfo {
  reason: string;
  // Deliberately NO spentUsd / capUsd: internal Anthropic cost must never reach
  // the client view. Only these non-cost fields are carried forward.
  usagePercent: number | null;
  resetAtUtc: string | null;
}

export type TurnError =
  | { kind: 'monthly_cap'; info: MonthlyCapInfo }
  | { kind: 'rate_limit'; retryAfterSec: number | null }
  | { kind: 'access'; reason: string | null }
  | { kind: 'screening' }
  | { kind: 'technical' };

export type TurnOutcome =
  | { transport: 'network' }
  | {
      transport: 'http';
      status: number;
      body: unknown;
      retryAfterHeader?: string | null;
    };

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object'
    ? (v as Record<string, unknown>)
    : {};
}

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function parseRetryAfter(header: string | null | undefined): number | null {
  if (header == null || header === '') return null;
  const n = Number(header);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Classify a turn outcome into exactly one TurnError. Never throws.
 *   - 429 + error 'monthly_spend_cap_reached'  -> monthly_cap
 *   - any other 429                            -> rate_limit
 *   - 412 (screening-red / user-not-found)     -> screening
 *   - 403 (no access / account deletion)       -> access
 *   - network / 5xx / other 4xx / unreadable   -> technical
 */
export function classifyTurnError(outcome: TurnOutcome): TurnError {
  if (outcome.transport === 'network') return { kind: 'technical' };

  const { status } = outcome;
  const body = asRecord(outcome.body);
  const error = typeof body.error === 'string' ? body.error : null;
  const reason = typeof body.reason === 'string' ? body.reason : null;

  // Monthly spend cap — the distinct machine-readable contract from PR #349.
  if (status === 429 && error === 'monthly_spend_cap_reached') {
    return {
      kind: 'monthly_cap',
      info: {
        reason: reason ?? 'journey_monthly_spend_cap',
        usagePercent: numberOrNull(body.usagePercent),
        resetAtUtc:
          typeof body.resetAtUtc === 'string' ? body.resetAtUtc : null,
      },
    };
  }

  // The OTHER 429 — rate limit. Kept distinct from the monthly cap.
  if (status === 429) {
    const retryAfterSec =
      numberOrNull(body.retryAfter) ?? parseRetryAfter(outcome.retryAfterHeader);
    return { kind: 'rate_limit', retryAfterSec };
  }

  if (status === 412) return { kind: 'screening' };
  if (status === 403) return { kind: 'access', reason };

  // 5xx, 400/409/413, and anything unexpected: a genuine technical failure.
  return { kind: 'technical' };
}

/**
 * Format a UTC ISO instant for display in the user's locale + timezone. The
 * raw UTC string stays the source of truth; this is presentation only. Returns
 * '' for an unparseable input so callers can fall back to no-date copy.
 */
export function formatResetAt(
  isoUtc: string,
  locale: string,
  timeZone?: string,
): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeStyle: 'short',
      ...(timeZone ? { timeZone } : {}),
    }).format(d);
  } catch {
    // Invalid locale/timeZone — fall back to a safe UTC render rather than throw.
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(d);
  }
}

/**
 * The monthly-cap panel view-model. Contains ONLY presentation-safe fields — a
 * locale-formatted reset string and an optional clamped percent. Never any USD
 * cost. `resetAtLocal` is '' when no valid reset instant is present.
 */
export interface MonthlyCapView {
  resetAtLocal: string;
  usagePercentClamped: number | null;
}

export function monthlyCapView(
  info: MonthlyCapInfo,
  locale: string,
  timeZone?: string,
): MonthlyCapView {
  return {
    resetAtLocal: info.resetAtUtc
      ? formatResetAt(info.resetAtUtc, locale, timeZone)
      : '',
    usagePercentClamped:
      info.usagePercent == null
        ? null
        : Math.max(0, Math.min(100, Math.round(info.usagePercent))),
  };
}

/**
 * The send-guard. A hard monthly cap (and a frozen session, and an in-flight
 * send) block sending; a rate-limit / technical / access / screening error does
 * NOT permanently disable the composer (the user may edit and retry).
 */
export function canSendTurn(args: {
  frozen: boolean;
  sending: boolean;
  hardCapActive: boolean;
  value: string;
}): boolean {
  return (
    !args.frozen &&
    !args.sending &&
    !args.hardCapActive &&
    args.value.trim().length > 0
  );
}

/**
 * Decide what happens to the streaming assistant bubble when a turn fails:
 *   - partial text already streamed -> keep it once (streaming stops);
 *   - empty placeholder             -> drop it (the error panel is the only UI).
 * Guarantees a failure never writes the error INTO a bubble AND a panel.
 */
export function resolveAssistantBubbleOnError(content: string): {
  keep: boolean;
} {
  return { keep: content.trim().length > 0 };
}
