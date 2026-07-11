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
} from './monthly-cap';

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
});

afterEach(() => {
  delete process.env.JOURNEY_MONTHLY_SPEND_CAP_USD;
  delete process.env.JOURNEY_MONTHLY_SPEND_WARN_USD;
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
