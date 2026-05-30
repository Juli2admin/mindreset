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
