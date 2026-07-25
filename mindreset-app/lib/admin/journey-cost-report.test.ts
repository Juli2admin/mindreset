import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  JOURNEY_CALL_SITES,
  isJourneyCallSite,
  filterJourneyRows,
  journeyReportWindows,
  avgCostPerCall,
  toCostRows,
  toUserCostRows,
  bucketDailyCost,
  buildCapTable,
} from './journey-cost-report';

const JULIA_USER_ID = 'user_3EfVFP02L8njKj2T36EvDAB0Z07';

function clearCapEnv() {
  delete process.env.JOURNEY_MONTHLY_SPEND_CAP_USD;
  delete process.env.JOURNEY_MONTHLY_SPEND_WARN_USD;
  delete process.env.JOURNEY_CAP_OVERRIDE_USER_IDS;
  delete process.env.JOURNEY_CAP_OVERRIDE_USD;
}
beforeEach(clearCapEnv);
afterEach(clearCapEnv);

const NOW = new Date('2026-07-15T12:00:00.000Z');

describe('Journey call-site filtering', () => {
  it('recognises only the two Journey call sites', () => {
    expect(JOURNEY_CALL_SITES).toEqual(['journey_turn', 'verifier_journey']);
    expect(isJourneyCallSite('journey_turn')).toBe(true);
    expect(isJourneyCallSite('verifier_journey')).toBe(true);
    expect(isJourneyCallSite('minimind_chat')).toBe(false);
    expect(isJourneyCallSite('states_turn')).toBe(false);
  });

  it('filters mixed rows down to Journey only', () => {
    const rows = [
      { callSite: 'journey_turn', costUsd: 1 },
      { callSite: 'minimind_chat', costUsd: 9 },
      { callSite: 'verifier_journey', costUsd: 0.1 },
      { callSite: 'themes_turn', costUsd: 5 },
    ];
    expect(filterJourneyRows(rows).map((r) => r.callSite)).toEqual([
      'journey_turn',
      'verifier_journey',
    ]);
  });
});

describe('journeyReportWindows — UTC boundaries', () => {
  it('computes explicit UTC today/month + rolling 7-day', () => {
    const w = journeyReportWindows(new Date('2026-07-15T09:30:00.000Z'));
    expect(w.todayStartUtc.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(w.monthStartUtc.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(w.sevenDayStart.toISOString()).toBe('2026-07-08T09:30:00.000Z');
  });

  it('is UTC even late in the UTC day (would differ under local time)', () => {
    const w = journeyReportWindows(new Date('2026-07-31T23:30:00.000Z'));
    expect(w.todayStartUtc.toISOString()).toBe('2026-07-31T00:00:00.000Z');
    expect(w.monthStartUtc.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('December → the month start stays in December (UTC)', () => {
    const w = journeyReportWindows(new Date('2026-12-20T00:00:00.000Z'));
    expect(w.monthStartUtc.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('avgCostPerCall', () => {
  it('divides cost by call count, 0 when no calls', () => {
    expect(avgCostPerCall(0.3, 3)).toBe(0.1);
    expect(avgCostPerCall(5, 0)).toBe(0);
    expect(avgCostPerCall(0, 4)).toBe(0);
  });
});

describe('toCostRows — model / call-site aggregation', () => {
  it('sorts by cost desc, computes avg per call, maps null key to unknown', () => {
    const rows = toCostRows([
      { key: 'claude-sonnet-4-6', costUsd: 10, calls: 5 },
      { key: 'claude-haiku-4-5-20251001', costUsd: 2, calls: 8 },
      { key: null, costUsd: 1, calls: 1 },
    ]);
    expect(rows.map((r) => r.key)).toEqual([
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'unknown',
    ]);
    expect(rows[0].avgCostPerCall).toBe(2); // 10 / 5
    expect(rows[1].avgCostPerCall).toBe(0.25); // 2 / 8
    expect(rows[2].costUsd).toBe(1);
  });

  it('treats null _sum.costUsd as 0', () => {
    const rows = toCostRows([{ key: 'x', costUsd: null, calls: 0 }]);
    expect(rows[0].costUsd).toBe(0);
    expect(rows[0].avgCostPerCall).toBe(0);
  });
});

describe('toUserCostRows — highest-cost user ordering', () => {
  it('sorts by cost desc and resolves emails', () => {
    const emails = new Map<string, string | null>([
      ['a', 'a@x.com'],
      ['b', null],
    ]);
    const rows = toUserCostRows(
      [
        { userId: 'a', costUsd: 3, calls: 2 },
        { userId: 'b', costUsd: 9, calls: 1 },
      ],
      emails,
    );
    expect(rows.map((r) => r.userId)).toEqual(['b', 'a']);
    expect(rows[0].email).toBeNull();
    expect(rows[1].email).toBe('a@x.com');
  });
});

describe('bucketDailyCost — 30 UTC-day buckets, zero-filled', () => {
  it('buckets by UTC day, ignores out-of-window rows, keeps order', () => {
    const points = bucketDailyCost(
      [
        { createdAt: new Date('2026-07-15T08:00:00.000Z'), costUsd: 1.5 },
        { createdAt: new Date('2026-07-14T23:59:00.000Z'), costUsd: 2 },
        { createdAt: new Date('2026-07-14T00:00:00.000Z'), costUsd: 0.5 },
        { createdAt: new Date('2026-05-01T00:00:00.000Z'), costUsd: 99 }, // outside 30d
      ],
      NOW,
      30,
    );
    expect(points).toHaveLength(30);
    expect(points[0].dayUtc).toBe('2026-06-16'); // 15 − 29 days
    expect(points[29].dayUtc).toBe('2026-07-15');
    const byDay = new Map(points.map((p) => [p.dayUtc, p]));
    expect(byDay.get('2026-07-15')).toEqual({ dayUtc: '2026-07-15', costUsd: 1.5, calls: 1 });
    expect(byDay.get('2026-07-14')).toEqual({ dayUtc: '2026-07-14', costUsd: 2.5, calls: 2 });
    // the 99.0 row is excluded from the window entirely
    const total = points.reduce((s, p) => s + p.costUsd, 0);
    expect(total).toBeCloseTo(4, 5);
  });
});

describe('buildCapTable — per-user cap via the public cap API', () => {
  const emails = new Map<string, string | null>();

  it('resolves effective cap, remaining, percent for the default $50 cap', () => {
    const rows = buildCapTable([{ userId: 'u', spentUsd: 30 }], emails, NOW);
    expect(rows[0].capUsd).toBe(50);
    expect(rows[0].remainingUsd).toBe(20);
    expect(rows[0].usagePercent).toBe(60);
    expect(rows[0].status).toBe('normal');
  });

  it('status boundaries mirror enforcement (normal / warning / over_cap)', () => {
    const mk = (spent: number) =>
      buildCapTable([{ userId: 'u', spentUsd: spent }], emails, NOW)[0].status;
    expect(mk(39.99)).toBe('normal'); // below warn
    expect(mk(40)).toBe('warning'); // == warn
    expect(mk(49.99)).toBe('warning'); // below cap
    expect(mk(50)).toBe('over_cap'); // == cap
    expect(mk(60)).toBe('over_cap'); // above cap
  });

  it('over cap → remainingUsd 0 (never negative), percent > 100', () => {
    const r = buildCapTable([{ userId: 'u', spentUsd: 60 }], emails, NOW)[0];
    expect(r.remainingUsd).toBe(0);
    expect(r.usagePercent).toBe(120);
  });

  it('sorts by usage percent descending', () => {
    const rows = buildCapTable(
      [
        { userId: 'low', spentUsd: 10 },
        { userId: 'high', spentUsd: 60 },
        { userId: 'mid', spentUsd: 45 },
      ],
      emails,
      NOW,
    );
    expect(rows.map((r) => r.userId)).toEqual(['high', 'mid', 'low']);
  });

  it("resolves Julia's $150 override through the public cap API; others stay $50", () => {
    process.env.JOURNEY_CAP_OVERRIDE_USER_IDS = JULIA_USER_ID;
    process.env.JOURNEY_CAP_OVERRIDE_USD = '150';
    const rows = buildCapTable(
      [
        { userId: JULIA_USER_ID, spentUsd: 100 },
        { userId: 'ordinary', spentUsd: 100 },
      ],
      emails,
      NOW,
    );
    const julia = rows.find((r) => r.userId === JULIA_USER_ID)!;
    const ordinary = rows.find((r) => r.userId === 'ordinary')!;
    expect(julia.capUsd).toBe(150);
    expect(julia.status).toBe('warning'); // 40 <= 100 < 150
    expect(julia.remainingUsd).toBe(50);
    expect(julia.usagePercent).toBe(66.67);
    expect(ordinary.capUsd).toBe(50);
    expect(ordinary.status).toBe('over_cap'); // 100 >= 50
    expect(ordinary.remainingUsd).toBe(0);
  });
});
