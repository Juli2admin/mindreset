// Pilot analytics — read-side aggregations over TesterResponse rows.
//
// PR ω3c (2026-07-14). All computation is done in application code
// over a single Prisma query per surface so schemas / question shapes
// can evolve without also touching hand-rolled SQL.
//
// The six Likert scales are the pilot's measurement per Julia's method:
//   - Q9/Q4  understand   — should go UP over the arc
//   - Q10/Q5 notice       — should go UP
//   - Q11/Q6 choose       — should go UP
//   - Q12/Q7 hardOnSelf   — should go DOWN
//   - Q13/Q8 affectsLife  — should go DOWN (secondary)
//   - Q14/Q9 stuck        — should go DOWN

import prisma from '@/lib/prisma';

export type ScaleKey =
  | 'scaleUnderstand'
  | 'scaleNotice'
  | 'scaleChoose'
  | 'scaleHardOnSelf'
  | 'scaleAffectsLife'
  | 'scaleStuck';

export const SCALES: Array<{
  key: ScaleKey;
  label: string;
  expected: 'up' | 'down';
}> = [
  { key: 'scaleUnderstand', label: 'Understand why I react', expected: 'up' },
  { key: 'scaleNotice', label: 'Notice before it takes over', expected: 'up' },
  { key: 'scaleChoose', label: 'Able to choose a different response', expected: 'up' },
  { key: 'scaleHardOnSelf', label: 'Hard on myself', expected: 'down' },
  { key: 'scaleAffectsLife', label: 'Affects daily life', expected: 'down' },
  { key: 'scaleStuck', label: 'Stuck', expected: 'down' },
];

export type TesterPair = {
  invitationId: string;
  userId: string | null;
  code: string;
  email: string | null;
  beforeAt: Date | null;
  afterAt: Date | null;
  scales: Record<ScaleKey, { before: number | null; after: number | null }>;
  // Free-text — the two questions Julia weights most heavily in her md.
  beforePatternText: string | null;
  beforeHope: string | null;
  afterShifted: string | null;
  afterConfusingBoring: string | null;
  afterAnythingElse: string | null;
  // Journey engagement — populated by attachJourneyEngagement().
  // Absent (all zero / null) when the tester never opened the Journey.
  engagement: JourneyEngagement;
};

export type JourneyEngagement = {
  userTurnCount: number;
  daysActive: number;
  firstJourneyAt: Date | null;
  lastJourneyAt: Date | null;
  safetyEventCount: number;
};

const EMPTY_ENGAGEMENT: JourneyEngagement = {
  userTurnCount: 0,
  daysActive: 0,
  firstJourneyAt: null,
  lastJourneyAt: null,
  safetyEventCount: 0,
};

export type ScaleAggregate = {
  key: ScaleKey;
  label: string;
  expected: 'up' | 'down';
  nWithBoth: number;
  meanBefore: number | null;
  meanAfter: number | null;
  meanDelta: number | null;
};

export type Summary = {
  totalRedeemed: number;
  totalBefore: number;
  totalAfter: number;
  totalBoth: number;
};

/**
 * Load every pilot invitation that has at least one TesterResponse,
 * pivoted so before + after live on the same object. Journey
 * engagement metrics are attached in a second pass.
 */
export async function loadTesterPairs(): Promise<TesterPair[]> {
  const rows = await prisma.testerResponse.findMany({
    orderBy: [{ submittedAt: 'desc' }],
    include: {
      invitation: {
        select: {
          code: true,
          redeemedByUserId: true,
          redeemedByUser: { select: { email: true } },
        },
      },
    },
  });

  const byInvitation = new Map<string, TesterPair>();
  for (const r of rows) {
    let pair = byInvitation.get(r.invitationId);
    if (!pair) {
      pair = {
        invitationId: r.invitationId,
        userId: r.invitation.redeemedByUserId,
        code: r.invitation.code,
        email: r.invitation.redeemedByUser?.email ?? null,
        beforeAt: null,
        afterAt: null,
        scales: {
          scaleUnderstand: { before: null, after: null },
          scaleNotice: { before: null, after: null },
          scaleChoose: { before: null, after: null },
          scaleHardOnSelf: { before: null, after: null },
          scaleAffectsLife: { before: null, after: null },
          scaleStuck: { before: null, after: null },
        },
        beforePatternText: null,
        beforeHope: null,
        afterShifted: null,
        afterConfusingBoring: null,
        afterAnythingElse: null,
        engagement: { ...EMPTY_ENGAGEMENT },
      };
      byInvitation.set(r.invitationId, pair);
    }

    if (r.formType === 'before') pair.beforeAt = r.submittedAt;
    else if (r.formType === 'after') pair.afterAt = r.submittedAt;

    for (const s of SCALES) {
      const v = r[s.key];
      if (v === null || v === undefined) continue;
      if (r.formType === 'before') pair.scales[s.key].before = v;
      else if (r.formType === 'after') pair.scales[s.key].after = v;
    }

    // Pull the free-text fields Julia weights most. Guarded — `answers`
    // is `Json` in Prisma; older rows or a schema drift shouldn't crash
    // the whole aggregation.
    const a = r.answers as Record<string, unknown> | null;
    if (r.formType === 'before' && a && typeof a === 'object') {
      const yp = (a as { yourPattern?: { patternText?: unknown } }).yourPattern;
      if (yp && typeof yp.patternText === 'string') {
        pair.beforePatternText = yp.patternText;
      }
      const hope = (a as { hopeInAMonth?: unknown }).hopeInAMonth;
      if (typeof hope === 'string') pair.beforeHope = hope;
    } else if (r.formType === 'after' && a && typeof a === 'object') {
      const change = (a as {
        change?: { shiftedWithoutForcing?: unknown };
      }).change;
      if (change && typeof change.shiftedWithoutForcing === 'string') {
        pair.afterShifted = change.shiftedWithoutForcing;
      }
      const product = (a as {
        product?: { confusingBoringMissing?: unknown };
      }).product;
      if (product && typeof product.confusingBoringMissing === 'string') {
        pair.afterConfusingBoring = product.confusingBoringMissing;
      }
      const value = (a as { value?: { anythingElse?: unknown } }).value;
      if (value && typeof value.anythingElse === 'string') {
        pair.afterAnythingElse = value.anythingElse;
      }
    }
  }

  const pairs = Array.from(byInvitation.values());
  await attachJourneyEngagement(pairs);
  return pairs;
}

/**
 * Populate the `engagement` block on each pair with Journey usage
 * metrics — user turn count, distinct days active, first / last
 * message timestamps, and safety event count. Runs two aggregate
 * queries scoped by userId, so O(2) queries regardless of pilot
 * cohort size.
 */
async function attachJourneyEngagement(pairs: TesterPair[]): Promise<void> {
  const userIds = Array.from(
    new Set(pairs.map((p) => p.userId).filter((id): id is string => !!id)),
  );
  if (userIds.length === 0) return;

  // Journey turn + timestamp aggregate. We count USER messages
  // specifically — the assistant's replies are automatic given a
  // user turn, so counting them double-counts engagement.
  const journeyGrouped = await prisma.journeyMessage.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, role: 'user' },
    _count: { _all: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
  });
  const journeyByUser = new Map<
    string,
    { count: number; first: Date | null; last: Date | null }
  >();
  for (const g of journeyGrouped) {
    journeyByUser.set(g.userId, {
      count: g._count._all,
      first: g._min.createdAt ?? null,
      last: g._max.createdAt ?? null,
    });
  }

  // Distinct days active per user. Postgres DATE_TRUNC on the tz-
  // aware timestamp; grouped by user + day, then counted. Kept as
  // raw SQL because Prisma's groupBy can't project a computed date.
  type DayRow = { userId: string; days_active: bigint };
  const dayRows = await prisma.$queryRaw<DayRow[]>`
    SELECT "userId", COUNT(DISTINCT DATE("createdAt"))::bigint AS days_active
    FROM "JourneyMessage"
    WHERE "userId" = ANY (${userIds}::text[]) AND "role" = 'user'
    GROUP BY "userId"
  `;
  const daysByUser = new Map<string, number>();
  for (const r of dayRows) daysByUser.set(r.userId, Number(r.days_active));

  // Safety events per user.
  const safetyGrouped = await prisma.safetyEvent.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds } },
    _count: { _all: true },
  });
  const safetyByUser = new Map<string, number>();
  for (const g of safetyGrouped) safetyByUser.set(g.userId, g._count._all);

  for (const p of pairs) {
    if (!p.userId) continue;
    const j = journeyByUser.get(p.userId);
    p.engagement = {
      userTurnCount: j?.count ?? 0,
      daysActive: daysByUser.get(p.userId) ?? 0,
      firstJourneyAt: j?.first ?? null,
      lastJourneyAt: j?.last ?? null,
      safetyEventCount: safetyByUser.get(p.userId) ?? 0,
    };
  }
}

/**
 * Per-scale aggregate across every tester who filled BOTH forms.
 * Non-paired responses are excluded — we only average deltas for
 * testers where we have a before AND after value on that specific
 * scale (a partial submission with 5 of 6 scales would still be
 * counted for the 5 they answered).
 */
export function aggregateScales(pairs: TesterPair[]): ScaleAggregate[] {
  return SCALES.map((s) => {
    const withBoth = pairs.filter(
      (p) =>
        p.scales[s.key].before !== null && p.scales[s.key].after !== null,
    );
    if (withBoth.length === 0) {
      return {
        ...s,
        nWithBoth: 0,
        meanBefore: null,
        meanAfter: null,
        meanDelta: null,
      };
    }
    const sumBefore = withBoth.reduce(
      (a, p) => a + (p.scales[s.key].before ?? 0),
      0,
    );
    const sumAfter = withBoth.reduce(
      (a, p) => a + (p.scales[s.key].after ?? 0),
      0,
    );
    return {
      ...s,
      nWithBoth: withBoth.length,
      meanBefore: sumBefore / withBoth.length,
      meanAfter: sumAfter / withBoth.length,
      meanDelta: (sumAfter - sumBefore) / withBoth.length,
    };
  });
}

/**
 * Top-line counts for the summary card.
 */
export async function loadSummary(): Promise<Summary> {
  const [totalRedeemed, totalBefore, totalAfter] = await Promise.all([
    prisma.pilotInvitation.count({
      where: { redeemedAt: { not: null }, revokedAt: null },
    }),
    prisma.pilotInvitation.count({ where: { beforeFormFilled: true } }),
    prisma.pilotInvitation.count({ where: { afterFormFilled: true } }),
  ]);
  const totalBoth = await prisma.pilotInvitation.count({
    where: { beforeFormFilled: true, afterFormFilled: true },
  });
  return { totalRedeemed, totalBefore, totalAfter, totalBoth };
}

/**
 * Render whether a change "went the right way" per Julia's method.
 * Understand ↑ / Stuck ↓ etc. Returns null when we can't tell
 * (missing before/after, or no meaningful movement).
 */
export function scaleVerdict(agg: ScaleAggregate): 'good' | 'bad' | 'flat' | null {
  if (agg.meanDelta === null) return null;
  const magnitude = Math.abs(agg.meanDelta);
  if (magnitude < 0.5) return 'flat';
  if (agg.expected === 'up') return agg.meanDelta > 0 ? 'good' : 'bad';
  return agg.meanDelta < 0 ? 'good' : 'bad';
}
