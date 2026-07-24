// Tests for the Journey monthly-cap threshold logic.
// The pure verdict fn is a plain read + compare — this file locks in the
// threshold-crossing behaviour with an aggregate mock so a future env-var
// change or copy edit can't silently reintroduce a runaway-spend gap.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock the Prisma aggregate so we can test the check without a DB.
vi.mock('@/lib/prisma', () => ({
  default: {
    aiUsage: {
      aggregate: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import {
  checkJourneyMonthlyCap,
  journeyMonthlyHardCapUsd,
  journeyMonthlyWarnUsd,
  journeyCapOverrideUsdForUser,
  journeyMonthlyHardCapUsdForUser,
} from './monthly-cap';

// Julia's personal Journey testing account — the ONLY account this PR
// elevates. Immutable Clerk user ID (not email, not admin, not tester).
const JULIA_USER_ID = 'user_3EfVFP02L8njKj2T36EvDAB0Z07';

function withOverride(ids: string, usd: string) {
  process.env.JOURNEY_CAP_OVERRIDE_USER_IDS = ids;
  process.env.JOURNEY_CAP_OVERRIDE_USD = usd;
}

const aggregateMock = prisma.aiUsage.aggregate as unknown as ReturnType<
  typeof vi.fn
>;

function mockSpend(usd: number) {
  aggregateMock.mockResolvedValueOnce({ _sum: { costUsd: usd } } as any);
}

beforeEach(() => {
  aggregateMock.mockReset();
  delete process.env.JOURNEY_MONTHLY_SPEND_CAP_USD;
  delete process.env.JOURNEY_MONTHLY_SPEND_WARN_USD;
  delete process.env.JOURNEY_CAP_OVERRIDE_USER_IDS;
  delete process.env.JOURNEY_CAP_OVERRIDE_USD;
});

afterEach(() => {
  delete process.env.JOURNEY_MONTHLY_SPEND_CAP_USD;
  delete process.env.JOURNEY_MONTHLY_SPEND_WARN_USD;
  delete process.env.JOURNEY_CAP_OVERRIDE_USER_IDS;
  delete process.env.JOURNEY_CAP_OVERRIDE_USD;
});

describe('journeyMonthlyHardCapUsd / journeyMonthlyWarnUsd env overrides', () => {
  it('defaults hard cap to $50 and warn to $40', () => {
    expect(journeyMonthlyHardCapUsd()).toBe(50);
    expect(journeyMonthlyWarnUsd()).toBe(40);
  });

  it('respects env override for hard cap', () => {
    process.env.JOURNEY_MONTHLY_SPEND_CAP_USD = '75';
    expect(journeyMonthlyHardCapUsd()).toBe(75);
  });

  it('respects env override for warn threshold', () => {
    process.env.JOURNEY_MONTHLY_SPEND_WARN_USD = '60';
    expect(journeyMonthlyWarnUsd()).toBe(60);
  });

  it('rejects unparseable env values and falls back to defaults', () => {
    process.env.JOURNEY_MONTHLY_SPEND_CAP_USD = 'nonsense';
    expect(journeyMonthlyHardCapUsd()).toBe(50);
    process.env.JOURNEY_MONTHLY_SPEND_CAP_USD = '-5';
    expect(journeyMonthlyHardCapUsd()).toBe(50);
    process.env.JOURNEY_MONTHLY_SPEND_CAP_USD = '0';
    expect(journeyMonthlyHardCapUsd()).toBe(50);
  });
});

describe('checkJourneyMonthlyCap — verdict transitions', () => {
  it('returns ok when spent is below warn threshold', async () => {
    mockSpend(10);
    const r = await checkJourneyMonthlyCap('user_1');
    expect(r.verdict).toBe('ok');
    if (r.verdict === 'ok') {
      expect(r.spentUsd).toBe(10);
      expect(r.capUsd).toBe(50);
    }
  });

  it('returns ok exactly at $0 spend', async () => {
    mockSpend(0);
    const r = await checkJourneyMonthlyCap('user_2');
    expect(r.verdict).toBe('ok');
  });

  it('returns warn at the warn threshold (>= warn)', async () => {
    mockSpend(40);
    const r = await checkJourneyMonthlyCap('user_3');
    expect(r.verdict).toBe('warn');
    if (r.verdict === 'warn') {
      expect(r.warnUsd).toBe(40);
      expect(r.spentUsd).toBe(40);
    }
  });

  it('returns warn between warn and hard cap', async () => {
    mockSpend(45);
    const r = await checkJourneyMonthlyCap('user_4');
    expect(r.verdict).toBe('warn');
  });

  it('returns over_cap at exactly the hard cap', async () => {
    mockSpend(50);
    const r = await checkJourneyMonthlyCap('user_5');
    expect(r.verdict).toBe('over_cap');
    if (r.verdict === 'over_cap') {
      expect(r.spentUsd).toBe(50);
      expect(r.capUsd).toBe(50);
    }
  });

  it('returns over_cap when past the hard cap', async () => {
    mockSpend(75);
    const r = await checkJourneyMonthlyCap('user_6');
    expect(r.verdict).toBe('over_cap');
  });

  it("respects env overrides for both thresholds", async () => {
    process.env.JOURNEY_MONTHLY_SPEND_CAP_USD = '100';
    process.env.JOURNEY_MONTHLY_SPEND_WARN_USD = '80';
    mockSpend(85);
    const r = await checkJourneyMonthlyCap('user_7');
    expect(r.verdict).toBe('warn');
    if (r.verdict === 'warn') {
      expect(r.warnUsd).toBe(80);
      expect(r.capUsd).toBe(100);
    }
  });

  it('fails open (returns ok) when the aggregate query throws', async () => {
    aggregateMock.mockRejectedValueOnce(new Error('db offline'));
    const r = await checkJourneyMonthlyCap('user_8');
    expect(r.verdict).toBe('ok');
    if (r.verdict === 'ok') {
      expect(r.spentUsd).toBe(0);
    }
  });

  it('treats null _sum.costUsd as $0 spent (first-of-month case)', async () => {
    aggregateMock.mockResolvedValueOnce({ _sum: { costUsd: null } } as any);
    const r = await checkJourneyMonthlyCap('user_9');
    expect(r.verdict).toBe('ok');
    if (r.verdict === 'ok') expect(r.spentUsd).toBe(0);
  });
});

describe('per-user cap override — pure resolution (journeyMonthlyHardCapUsdForUser)', () => {
  it('no override configured → normal $50 for everyone, including Julia', () => {
    expect(journeyCapOverrideUsdForUser(JULIA_USER_ID)).toBeNull();
    expect(journeyMonthlyHardCapUsdForUser(JULIA_USER_ID)).toBe(50);
    expect(journeyMonthlyHardCapUsdForUser('user_ordinary')).toBe(50);
  });

  it("Julia's exact ID with a valid $150 override → $150; others unaffected", () => {
    withOverride(JULIA_USER_ID, '150');
    expect(journeyCapOverrideUsdForUser(JULIA_USER_ID)).toBe(150);
    expect(journeyMonthlyHardCapUsdForUser(JULIA_USER_ID)).toBe(150);
    // No other account inherits it.
    expect(journeyCapOverrideUsdForUser('user_someone_else')).toBeNull();
    expect(journeyMonthlyHardCapUsdForUser('user_someone_else')).toBe(50);
  });

  it('trims whitespace and matches within a multi-ID list', () => {
    withOverride(` user_other , ${JULIA_USER_ID} `, '150');
    expect(journeyMonthlyHardCapUsdForUser(JULIA_USER_ID)).toBe(150);
    expect(journeyMonthlyHardCapUsdForUser('user_other')).toBe(150);
    expect(journeyMonthlyHardCapUsdForUser('user_not_listed')).toBe(50);
  });

  it('FAIL-SAFE: listed user but invalid override amount → normal $50 (never removes cap)', () => {
    for (const bad of ['nonsense', '-5', '0', 'NaN', '', 'Infinity']) {
      withOverride(JULIA_USER_ID, bad);
      expect(journeyCapOverrideUsdForUser(JULIA_USER_ID)).toBeNull();
      expect(journeyMonthlyHardCapUsdForUser(JULIA_USER_ID)).toBe(50);
    }
  });

  it('FAIL-SAFE: listed user but override amount unset → normal $50', () => {
    process.env.JOURNEY_CAP_OVERRIDE_USER_IDS = JULIA_USER_ID;
    delete process.env.JOURNEY_CAP_OVERRIDE_USD;
    expect(journeyMonthlyHardCapUsdForUser(JULIA_USER_ID)).toBe(50);
  });

  it('FAIL-SAFE: empty / unset ID list → normal $50', () => {
    process.env.JOURNEY_CAP_OVERRIDE_USD = '150';
    process.env.JOURNEY_CAP_OVERRIDE_USER_IDS = '';
    expect(journeyMonthlyHardCapUsdForUser(JULIA_USER_ID)).toBe(50);
    process.env.JOURNEY_CAP_OVERRIDE_USER_IDS = '   ,  ';
    expect(journeyMonthlyHardCapUsdForUser(JULIA_USER_ID)).toBe(50);
  });
});

describe('per-user cap override — checkJourneyMonthlyCap verdicts (Julia @ $150)', () => {
  // Required-policy scenarios 1-9.

  it('(1) ordinary user below $50 → allowed (ok)', async () => {
    mockSpend(30);
    const r = await checkJourneyMonthlyCap('user_ordinary');
    expect(r.verdict).toBe('ok');
    expect(r.capUsd).toBe(50);
  });

  it('(2) ordinary user at/above $50 → blocked (over_cap)', async () => {
    mockSpend(50);
    const r = await checkJourneyMonthlyCap('user_ordinary');
    expect(r.verdict).toBe('over_cap');
    expect(r.capUsd).toBe(50);
  });

  it("(3) Julia's exact ID at $50.0583 → allowed (cap $150)", async () => {
    withOverride(JULIA_USER_ID, '150');
    mockSpend(50.0583);
    const r = await checkJourneyMonthlyCap(JULIA_USER_ID);
    expect(r.verdict).not.toBe('over_cap'); // allowed
    expect(r.capUsd).toBe(150);
    expect(r.spentUsd).toBe(50.0583);
  });

  it("(4) Julia's exact ID below $150 → allowed", async () => {
    withOverride(JULIA_USER_ID, '150');
    mockSpend(149.99);
    const r = await checkJourneyMonthlyCap(JULIA_USER_ID);
    expect(r.verdict).not.toBe('over_cap');
    expect(r.capUsd).toBe(150);
  });

  it("(5) Julia's exact ID at/above $150 → blocked (over_cap)", async () => {
    withOverride(JULIA_USER_ID, '150');
    mockSpend(150);
    const r = await checkJourneyMonthlyCap(JULIA_USER_ID);
    expect(r.verdict).toBe('over_cap');
    expect(r.capUsd).toBe(150);
  });

  it('(6) another user does NOT inherit Julia\'s override (blocked at $50)', async () => {
    withOverride(JULIA_USER_ID, '150');
    mockSpend(50.0583);
    const r = await checkJourneyMonthlyCap('user_someone_else');
    expect(r.verdict).toBe('over_cap');
    expect(r.capUsd).toBe(50);
  });

  it('(7) empty override configuration → default $50 (even Julia is blocked at $50)', async () => {
    // no override env set
    mockSpend(50.0583);
    const r = await checkJourneyMonthlyCap(JULIA_USER_ID);
    expect(r.verdict).toBe('over_cap');
    expect(r.capUsd).toBe(50);
  });

  it('(8) invalid override amount → default $50 (Julia blocked at $50, never uncapped)', async () => {
    withOverride(JULIA_USER_ID, 'nonsense');
    mockSpend(50.0583);
    const r = await checkJourneyMonthlyCap(JULIA_USER_ID);
    expect(r.verdict).toBe('over_cap');
    expect(r.capUsd).toBe(50);
  });

  it('(9) ordinary cap behaviour unchanged while an override is active for Julia', async () => {
    withOverride(JULIA_USER_ID, '150');
    // ordinary user still warns at $45 with a $50 cap...
    mockSpend(45);
    const warnR = await checkJourneyMonthlyCap('user_ordinary');
    expect(warnR.verdict).toBe('warn');
    expect(warnR.capUsd).toBe(50);
    // ...and is still blocked at $50.
    mockSpend(50);
    const blockR = await checkJourneyMonthlyCap('user_ordinary');
    expect(blockR.verdict).toBe('over_cap');
    expect(blockR.capUsd).toBe(50);
  });
});
