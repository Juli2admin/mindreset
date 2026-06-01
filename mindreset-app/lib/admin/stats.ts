import prisma from '@/lib/prisma';

// Admin overview stats. Fast aggregates from Prisma — kept narrow so the
// admin landing page loads quickly. All counts are point-in-time at
// request time (force-dynamic on the page).

const ESSENTIAL_MONTHLY_GBP = 14.99;
const EXTENDED_MONTHLY_GBP = 24.99;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type AdminStats = {
  signupsToday: number;
  signupsThisWeek: number;
  activeThisWeek: number;
  essentialCount: number;
  extendedCount: number;
  freeCount: number;
  estimatedMRR: number;
  sev5ThisWeek: number;
  sev3to4ThisWeek: number;
};

// Per-locale safety event counts — used by /admin Overview to surface
// whether non-EN/RU users are hitting safety events. The keyword scanner
// has native phrases for EN + RU only; the 6 placeholder locales rely
// on the AI verifier. Watching this table tells us if those users are
// experiencing safety classifications (and whether to expand the
// keyword list to their locale).
export type SafetyByLocaleRow = {
  locale: string;
  sev5: number;
  sev3to4: number;
  sev2: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const today = startOfToday();
  const weekAgo = startOfWeek();

  const [
    signupsToday,
    signupsThisWeek,
    activeUsersThisWeek,
    essentialCount,
    extendedCount,
    freeCount,
    sev5ThisWeek,
    sev3to4ThisWeek,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    // Active = unique users who sent at least one chat message in the
    // last 7 days. Distinct on Conversation.userId where any child message
    // is from the user side within the window.
    prisma.conversation
      .findMany({
        where: {
          messages: {
            some: { role: 'user', timestamp: { gte: weekAgo } },
          },
        },
        select: { userId: true },
        distinct: ['userId'],
      })
      .then((rows) => rows.length),
    prisma.user.count({ where: { currentTier: 'essential' } }),
    prisma.user.count({ where: { currentTier: 'extended' } }),
    prisma.user.count({ where: { currentTier: 'free' } }),
    prisma.safetyEvent.count({
      where: { severity: 5, triggeredAt: { gte: weekAgo } },
    }),
    prisma.safetyEvent.count({
      where: { severity: { in: [3, 4] }, triggeredAt: { gte: weekAgo } },
    }),
  ]);

  // MRR estimate — naive: assumes everyone is on monthly billing. Annual
  // subscribers will be slightly under-counted (annual is cheaper per
  // month than monthly). Good enough for a launch glance; precise revenue
  // lives in Stripe Dashboard.
  const estimatedMRR =
    essentialCount * ESSENTIAL_MONTHLY_GBP + extendedCount * EXTENDED_MONTHLY_GBP;

  return {
    signupsToday,
    signupsThisWeek,
    activeThisWeek: activeUsersThisWeek,
    essentialCount,
    extendedCount,
    freeCount,
    estimatedMRR,
    sev5ThisWeek,
    sev3to4ThisWeek,
  };
}

// Per-locale safety event breakdown for the last 7 days. Joins SafetyEvent
// to User to pull locale; aggregates in JS to keep the Prisma query
// straightforward (groupBy doesn't support joins). At launch volumes the
// SafetyEvent table is small (tens-to-hundreds of rows per week), so
// in-memory aggregation is fine.
export async function getSafetyByLocale(): Promise<SafetyByLocaleRow[]> {
  const weekAgo = startOfWeek();

  const events = await prisma.safetyEvent.findMany({
    where: { triggeredAt: { gte: weekAgo } },
    select: {
      severity: true,
      user: { select: { locale: true } },
    },
    take: 5000, // safety cap; surfaces a warning rather than DoS'ing the page
  });

  const byLocale = new Map<string, { sev5: number; sev3to4: number; sev2: number }>();
  for (const e of events) {
    const locale = e.user?.locale ?? 'unknown';
    const counts = byLocale.get(locale) ?? { sev5: 0, sev3to4: 0, sev2: 0 };
    if (e.severity === 5) counts.sev5++;
    else if (e.severity === 3 || e.severity === 4) counts.sev3to4++;
    else if (e.severity === 2) counts.sev2++;
    byLocale.set(locale, counts);
  }

  // Sort by total severity weight descending so the highest-attention
  // locales surface first. Sev 5 weighted heaviest.
  return Array.from(byLocale.entries())
    .map(([locale, c]) => ({ locale, ...c }))
    .sort((a, b) => {
      const aw = a.sev5 * 100 + a.sev3to4 * 10 + a.sev2;
      const bw = b.sev5 * 100 + b.sev3to4 * 10 + b.sev2;
      return bw - aw;
    });
}
