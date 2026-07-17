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

// ===========================================================================
// METHOD EFFICACY — aggregate cohort view from Journey data (unencrypted
// fields only). Six metrics, each a plain table on the analytics page.
// Certification-grade evidence built from what the AI already emits every
// turn.
//
// Cohort scope: pilot invitees only. `PilotInvitation.redeemedByUserId`
// where the invitation is not revoked. This mirrors the existing
// Journey-engagement scope; the Method Efficacy section does not include
// non-pilot Journey users.
//
// Session definition (shared across metrics): a session is a run of
// consecutive JourneyTurn rows for one user with no more than 30 min
// gap between adjacent turns. First turn of every session is marked; the
// last is the closing turn. Same definition Julia used in her diagnostic
// SQL — keeps the numbers consistent between Method Efficacy and the
// per-user Inspector view.
// ===========================================================================

export type WeeklySessionRow = {
  weekStart: Date; // Monday of the ISO week
  sessions: number;
  activeTesters: number;
};

export type IntensityByOrdinalRow = {
  sessionNo: number;
  nSessions: number;
  medianClosingIntensity: number | null;
};

export type ClosingIntensityBucketRow = {
  month: string; // 'YYYY-MM'
  nSessions: number;
  calmPct: number; // closing intensity ≤ 3
  neutralPct: number; // 4-5
  activatedPct: number; // 6-7
  overwhelmedPct: number; // 8-10
};

export type StageDistributionRow = {
  stage: number;
  testers: number;
};

export type PracticeOutcomeRow = {
  status: string; // completed | mid | started | aborted_*
  count: number;
};

export type SafetyRateRow = {
  month: string; // 'YYYY-MM'
  sessions: number;
  safetyEvents: number;
  ratePer100Sessions: number | null;
};

export type MethodEfficacy = {
  cohortSize: number;
  weekly: WeeklySessionRow[];
  intensityByOrdinal: IntensityByOrdinalRow[];
  closingIntensityByMonth: ClosingIntensityBucketRow[];
  stageDistribution: StageDistributionRow[];
  practiceOutcomes: PracticeOutcomeRow[];
  safetyByMonth: SafetyRateRow[];
};

/**
 * Compute the six Method Efficacy metrics in one pass. Six raw SQL
 * queries (one per metric) all scoped by a CTE naming the cohort. This
 * runs read-only against the operational fields on JourneyTurn /
 * JourneyPracticeRun / RecodeProgress / SafetyEvent — no encrypted data
 * touched.
 */
export async function loadMethodEfficacy(): Promise<MethodEfficacy> {
  const cohortRows = await prisma.pilotInvitation.findMany({
    where: { redeemedByUserId: { not: null }, revokedAt: null },
    select: { redeemedByUserId: true },
  });
  const cohortUserIds = cohortRows
    .map((r) => r.redeemedByUserId)
    .filter((id): id is string => !!id);
  const cohortSize = cohortUserIds.length;

  if (cohortSize === 0) {
    return {
      cohortSize: 0,
      weekly: [],
      intensityByOrdinal: [],
      closingIntensityByMonth: [],
      stageDistribution: [],
      practiceOutcomes: [],
      safetyByMonth: [],
    };
  }

  const [
    weekly,
    intensityByOrdinal,
    closingIntensityByMonth,
    stageDistribution,
    practiceOutcomes,
    safetyByMonth,
  ] = await Promise.all([
    queryWeekly(cohortUserIds),
    queryIntensityByOrdinal(cohortUserIds),
    queryClosingIntensityByMonth(cohortUserIds),
    queryStageDistribution(cohortUserIds),
    queryPracticeOutcomes(cohortUserIds),
    querySafetyByMonth(cohortUserIds),
  ]);

  return {
    cohortSize,
    weekly,
    intensityByOrdinal,
    closingIntensityByMonth,
    stageDistribution,
    practiceOutcomes,
    safetyByMonth,
  };
}

// ---------------------------------------------------------------------------
// Individual metric queries. Each takes a userId list and returns typed
// rows. Kept small and separately-testable — the composite loader above
// just Promise.all's them.
// ---------------------------------------------------------------------------

async function queryWeekly(userIds: string[]): Promise<WeeklySessionRow[]> {
  type Row = {
    week_start: Date;
    sessions: bigint;
    active_testers: bigint;
  };
  const rows = await prisma.$queryRaw<Row[]>`
    WITH turns AS (
      SELECT
        "userId",
        "createdAt",
        LAG("createdAt") OVER (
          PARTITION BY "userId" ORDER BY "createdAt"
        ) AS prev_at
      FROM "JourneyTurn"
      WHERE "userId" = ANY (${userIds}::text[])
    ),
    starts AS (
      SELECT
        "userId",
        DATE_TRUNC('week', "createdAt") AS week_start
      FROM turns
      WHERE prev_at IS NULL
         OR EXTRACT(EPOCH FROM ("createdAt" - prev_at)) > 1800
    )
    SELECT
      week_start,
      COUNT(*)::bigint AS sessions,
      COUNT(DISTINCT "userId")::bigint AS active_testers
    FROM starts
    GROUP BY week_start
    ORDER BY week_start DESC
    LIMIT 20
  `;
  return rows.map((r) => ({
    weekStart: r.week_start,
    sessions: Number(r.sessions),
    activeTesters: Number(r.active_testers),
  }));
}

async function queryIntensityByOrdinal(
  userIds: string[],
): Promise<IntensityByOrdinalRow[]> {
  type Row = {
    session_no: number;
    n_sessions: bigint;
    median_intensity: number | null;
  };
  // For every (user, session_no), pick the CLOSING turn's intensity.
  // Then per session_no across cohort, compute the median. Bounded to
  // the first 20 sessions per user so the arc curve stays readable.
  const rows = await prisma.$queryRaw<Row[]>`
    WITH turns AS (
      SELECT
        "userId",
        "createdAt",
        "intensityReported",
        LAG("createdAt") OVER (
          PARTITION BY "userId" ORDER BY "createdAt"
        ) AS prev_at
      FROM "JourneyTurn"
      WHERE "userId" = ANY (${userIds}::text[])
    ),
    tagged AS (
      SELECT
        "userId",
        "createdAt",
        "intensityReported",
        SUM(
          CASE
            WHEN prev_at IS NULL
              OR EXTRACT(EPOCH FROM ("createdAt" - prev_at)) > 1800
            THEN 1 ELSE 0
          END
        ) OVER (PARTITION BY "userId" ORDER BY "createdAt") AS session_no
      FROM turns
    ),
    closes AS (
      SELECT DISTINCT ON ("userId", session_no)
        "userId", session_no, "intensityReported"
      FROM tagged
      ORDER BY "userId", session_no, "createdAt" DESC
    )
    SELECT
      session_no::int,
      COUNT(*)::bigint AS n_sessions,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "intensityReported")::float AS median_intensity
    FROM closes
    WHERE "intensityReported" IS NOT NULL AND session_no <= 20
    GROUP BY session_no
    ORDER BY session_no
  `;
  return rows.map((r) => ({
    sessionNo: r.session_no,
    nSessions: Number(r.n_sessions),
    medianClosingIntensity: r.median_intensity,
  }));
}

async function queryClosingIntensityByMonth(
  userIds: string[],
): Promise<ClosingIntensityBucketRow[]> {
  type Row = {
    month: string;
    n_sessions: bigint;
    calm: bigint;
    neutral: bigint;
    activated: bigint;
    overwhelmed: bigint;
  };
  const rows = await prisma.$queryRaw<Row[]>`
    WITH turns AS (
      SELECT
        "userId",
        "createdAt",
        "intensityReported",
        LAG("createdAt") OVER (
          PARTITION BY "userId" ORDER BY "createdAt"
        ) AS prev_at
      FROM "JourneyTurn"
      WHERE "userId" = ANY (${userIds}::text[])
    ),
    tagged AS (
      SELECT
        "userId",
        "createdAt",
        "intensityReported",
        SUM(
          CASE
            WHEN prev_at IS NULL
              OR EXTRACT(EPOCH FROM ("createdAt" - prev_at)) > 1800
            THEN 1 ELSE 0
          END
        ) OVER (PARTITION BY "userId" ORDER BY "createdAt") AS session_no
      FROM turns
    ),
    closes AS (
      SELECT DISTINCT ON ("userId", session_no)
        "userId", session_no, "intensityReported", "createdAt"
      FROM tagged
      ORDER BY "userId", session_no, "createdAt" DESC
    )
    SELECT
      TO_CHAR("createdAt", 'YYYY-MM') AS month,
      COUNT(*)::bigint AS n_sessions,
      SUM(CASE WHEN "intensityReported" <= 3 THEN 1 ELSE 0 END)::bigint AS calm,
      SUM(CASE WHEN "intensityReported" BETWEEN 4 AND 5 THEN 1 ELSE 0 END)::bigint AS neutral,
      SUM(CASE WHEN "intensityReported" BETWEEN 6 AND 7 THEN 1 ELSE 0 END)::bigint AS activated,
      SUM(CASE WHEN "intensityReported" >= 8 THEN 1 ELSE 0 END)::bigint AS overwhelmed
    FROM closes
    WHERE "intensityReported" IS NOT NULL
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12
  `;
  return rows.map((r) => {
    const n = Number(r.n_sessions);
    return {
      month: r.month,
      nSessions: n,
      calmPct: n > 0 ? (Number(r.calm) / n) * 100 : 0,
      neutralPct: n > 0 ? (Number(r.neutral) / n) * 100 : 0,
      activatedPct: n > 0 ? (Number(r.activated) / n) * 100 : 0,
      overwhelmedPct: n > 0 ? (Number(r.overwhelmed) / n) * 100 : 0,
    };
  });
}

async function queryStageDistribution(
  userIds: string[],
): Promise<StageDistributionRow[]> {
  const rows = await prisma.recodeProgress.groupBy({
    by: ['currentStage'],
    where: { userId: { in: userIds } },
    _count: { _all: true },
    orderBy: { currentStage: 'asc' },
  });
  return rows.map((r) => ({
    stage: r.currentStage,
    testers: r._count._all,
  }));
}

async function queryPracticeOutcomes(
  userIds: string[],
): Promise<PracticeOutcomeRow[]> {
  const rows = await prisma.journeyPracticeRun.groupBy({
    by: ['status'],
    where: { userId: { in: userIds } },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ status: r.status, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

async function querySafetyByMonth(
  userIds: string[],
): Promise<SafetyRateRow[]> {
  // Session count per month.
  type SessRow = { month: string; sessions: bigint };
  const sessRows = await prisma.$queryRaw<SessRow[]>`
    WITH turns AS (
      SELECT
        "userId",
        "createdAt",
        LAG("createdAt") OVER (
          PARTITION BY "userId" ORDER BY "createdAt"
        ) AS prev_at
      FROM "JourneyTurn"
      WHERE "userId" = ANY (${userIds}::text[])
    ),
    starts AS (
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM') AS month
      FROM turns
      WHERE prev_at IS NULL
         OR EXTRACT(EPOCH FROM ("createdAt" - prev_at)) > 1800
    )
    SELECT month, COUNT(*)::bigint AS sessions
    FROM starts
    GROUP BY month
  `;
  const sessionsByMonth = new Map<string, number>();
  for (const r of sessRows) sessionsByMonth.set(r.month, Number(r.sessions));

  // Safety events per month.
  type SafRow = { month: string; events: bigint };
  const safRows = await prisma.$queryRaw<SafRow[]>`
    SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month, COUNT(*)::bigint AS events
    FROM "SafetyEvent"
    WHERE "userId" = ANY (${userIds}::text[])
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
  `;
  const eventsByMonth = new Map<string, number>();
  for (const r of safRows) eventsByMonth.set(r.month, Number(r.events));

  const months = new Set<string>();
  sessionsByMonth.forEach((_v, k) => months.add(k));
  eventsByMonth.forEach((_v, k) => months.add(k));
  const rows = Array.from(months).map((month) => {
    const sessions = sessionsByMonth.get(month) ?? 0;
    const events = eventsByMonth.get(month) ?? 0;
    return {
      month,
      sessions,
      safetyEvents: events,
      ratePer100Sessions: sessions > 0 ? (events / sessions) * 100 : null,
    };
  });
  rows.sort((a, b) => b.month.localeCompare(a.month));
  return rows.slice(0, 12);
}
