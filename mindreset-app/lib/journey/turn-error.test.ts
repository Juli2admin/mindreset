import { describe, expect, it } from 'vitest';
import {
  classifyTurnError,
  formatResetAt,
  monthlyCapView,
  canSendTurn,
  resolveAssistantBubbleOnError,
} from './turn-error';

// The exact PR #349 monthly-cap 429 body.
const CAP_BODY = {
  error: 'monthly_spend_cap_reached',
  reason: 'journey_monthly_spend_cap',
  spentUsd: 50.0583,
  capUsd: 50,
  remainingUsd: 0,
  usagePercent: 100.12,
  warnUsd: 40,
  windowStartUtc: '2026-07-01T00:00:00.000Z',
  resetAtUtc: '2026-08-01T00:00:00.000Z',
};

describe('classifyTurnError', () => {
  it('(1) recognises the monthly cap by its machine-readable error code', () => {
    const e = classifyTurnError({
      transport: 'http',
      status: 429,
      body: CAP_BODY,
    });
    expect(e.kind).toBe('monthly_cap');
    if (e.kind === 'monthly_cap') {
      expect(e.info.reason).toBe('journey_monthly_spend_cap');
      expect(e.info.resetAtUtc).toBe('2026-08-01T00:00:00.000Z');
      expect(e.info.usagePercent).toBe(100.12);
    }
  });

  it('(3) the monthly cap is NOT classified as a technical failure', () => {
    // The client maps 'technical' to the "response could not be completed"
    // copy and 'monthly_cap' to the dedicated allowance panel — so this
    // guarantees the cap never renders the lost-thread / technical message.
    const e = classifyTurnError({
      transport: 'http',
      status: 429,
      body: CAP_BODY,
    });
    expect(e.kind).not.toBe('technical');
  });

  it('(4) monthly-cap info carries NO internal USD cost (no spentUsd/capUsd)', () => {
    const e = classifyTurnError({
      transport: 'http',
      status: 429,
      body: CAP_BODY,
    });
    if (e.kind !== 'monthly_cap') throw new Error('expected monthly_cap');
    expect('spentUsd' in e.info).toBe(false);
    expect('capUsd' in e.info).toBe(false);
    // Only these non-cost keys are present.
    expect(Object.keys(e.info).sort()).toEqual(
      ['reason', 'resetAtUtc', 'usagePercent'].sort(),
    );
  });

  it('(6) the OTHER 429 is a rate limit, distinct from the monthly cap', () => {
    const e = classifyTurnError({
      transport: 'http',
      status: 429,
      body: { error: 'Rate limited', retryAfter: 42 },
    });
    expect(e.kind).toBe('rate_limit');
    if (e.kind === 'rate_limit') expect(e.retryAfterSec).toBe(42);
  });

  it('(6b) rate limit falls back to the Retry-After header when body has no retryAfter', () => {
    const e = classifyTurnError({
      transport: 'http',
      status: 429,
      body: { error: 'Rate limited' },
      retryAfterHeader: '30',
    });
    expect(e.kind).toBe('rate_limit');
    if (e.kind === 'rate_limit') expect(e.retryAfterSec).toBe(30);
  });

  it('(7) a 403 access failure is distinct from the monthly cap', () => {
    const e = classifyTurnError({
      transport: 'http',
      status: 403,
      body: { error: 'No Journey access', reason: 'expired' },
    });
    expect(e.kind).toBe('access');
    if (e.kind === 'access') expect(e.reason).toBe('expired');
    expect(e.kind).not.toBe('monthly_cap');
  });

  it('(8) a 412 screening/frozen response is classified as screening', () => {
    const e = classifyTurnError({
      transport: 'http',
      status: 412,
      body: { error: 'screening-red' },
    });
    expect(e.kind).toBe('screening');
  });

  it('(9) a backend 5xx is a technical failure', () => {
    const e = classifyTurnError({ transport: 'http', status: 500, body: null });
    expect(e.kind).toBe('technical');
  });

  it('(10) a network failure is a technical failure', () => {
    const e = classifyTurnError({ transport: 'network' });
    expect(e.kind).toBe('technical');
  });

  it('a malformed / unreadable body does not throw and is technical', () => {
    const e = classifyTurnError({
      transport: 'http',
      status: 502,
      body: 'not json',
    });
    expect(e.kind).toBe('technical');
  });
});

describe('formatResetAt (14) — locale + timezone', () => {
  const RESET = '2026-08-01T00:00:00.000Z';

  it('en-GB in UTC renders the date and 00:00', () => {
    const s = formatResetAt(RESET, 'en-GB', 'UTC');
    expect(s).toContain('2026');
    expect(s).toContain('August');
    expect(s).toContain('00:00');
  });

  it('UTC → Europe/London (BST, +1) shows 01:00 on 1 August', () => {
    const s = formatResetAt(RESET, 'en-GB', 'Europe/London');
    expect(s).toContain('1 August 2026');
    expect(s).toContain('01:00');
  });

  it('another existing locale (ru) differs from en-GB', () => {
    const en = formatResetAt(RESET, 'en-GB', 'UTC');
    const ru = formatResetAt(RESET, 'ru', 'UTC');
    expect(ru).toContain('2026');
    expect(ru).not.toBe(en);
  });

  it('returns "" for an unparseable instant (caller falls back to no-date copy)', () => {
    expect(formatResetAt('not-a-date', 'en-GB', 'UTC')).toBe('');
  });
});

describe('monthlyCapView (2, 4)', () => {
  it('(2) formats the reset date in the given locale/timezone', () => {
    const v = monthlyCapView(
      { reason: 'x', usagePercent: 100.12, resetAtUtc: '2026-08-01T00:00:00.000Z' },
      'en-GB',
      'Europe/London',
    );
    expect(v.resetAtLocal).toContain('1 August 2026');
    expect(v.resetAtLocal).toContain('01:00');
  });

  it('(4) exposes only presentation-safe fields (no USD) and clamps percent to 100', () => {
    const v = monthlyCapView(
      { reason: 'x', usagePercent: 100.12, resetAtUtc: '2026-08-01T00:00:00.000Z' },
      'en-GB',
    );
    expect(Object.keys(v).sort()).toEqual(
      ['resetAtLocal', 'usagePercentClamped'].sort(),
    );
    expect(v.usagePercentClamped).toBe(100);
  });

  it('missing reset instant yields an empty local string (no-date fallback)', () => {
    const v = monthlyCapView(
      { reason: 'x', usagePercent: null, resetAtUtc: null },
      'en-GB',
    );
    expect(v.resetAtLocal).toBe('');
    expect(v.usagePercentClamped).toBeNull();
  });
});

describe('canSendTurn (5, 13)', () => {
  it('(5) a hard monthly cap prevents sending even with text present', () => {
    expect(
      canSendTurn({ frozen: false, sending: false, hardCapActive: true, value: 'hi' }),
    ).toBe(false);
  });

  it('(13) a normal turn (no error, not sending, not frozen, has text) can send', () => {
    expect(
      canSendTurn({ frozen: false, sending: false, hardCapActive: false, value: 'hi' }),
    ).toBe(true);
  });

  it('frozen or in-flight or empty all block sending', () => {
    expect(canSendTurn({ frozen: true, sending: false, hardCapActive: false, value: 'hi' })).toBe(false);
    expect(canSendTurn({ frozen: false, sending: true, hardCapActive: false, value: 'hi' })).toBe(false);
    expect(canSendTurn({ frozen: false, sending: false, hardCapActive: false, value: '   ' })).toBe(false);
  });
});

describe('resolveAssistantBubbleOnError (11, 12)', () => {
  it('(12) preserves partial streamed text (kept once, not overwritten)', () => {
    expect(resolveAssistantBubbleOnError('a partial reply…')).toEqual({ keep: true });
  });

  it('(11) drops an empty placeholder so the error renders as ONE panel only', () => {
    expect(resolveAssistantBubbleOnError('')).toEqual({ keep: false });
    expect(resolveAssistantBubbleOnError('   ')).toEqual({ keep: false });
  });
});
