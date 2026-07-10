import Link from 'next/link';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// /admin/telemetry — the AI-usage & cost dashboard (PR δ, 2026-07-10).
// Reads the AiUsage table populated by every Anthropic call site.
//
// Aggregates it wants:
//   - Total spend + tokens for today, last 7 days, this month
//   - Per-call-site split so we can see if verifier / memory updater are
//     quietly eating budget
//   - Per-user top-N for the month so we can spot heavy users
//   - Cache-read ratio (cheap-input / total-input) as a caching-health signal

function fmtUsd(n: number | null | undefined): string {
  const v = n ?? 0;
  return `$${v.toFixed(2)}`;
}

function fmtInt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('en-GB');
}

function StatTile({
  kicker,
  primary,
  secondary,
}: {
  kicker: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="border border-neutral-200 rounded-lg p-5 bg-white">
      <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 mb-2">
        {kicker}
      </div>
      <div className="text-[26px] leading-none mb-1 font-medium text-neutral-900">
        {primary}
      </div>
      {secondary && (
        <div className="text-[12px] text-neutral-500">{secondary}</div>
      )}
    </div>
  );
}

// Human labels for the call-site slugs stored in the DB.
const CALL_SITE_LABEL: Record<string, string> = {
  journey_turn: 'Journey turn',
  minimind_chat: 'MiniMind chat',
  verifier_journey: 'Journey safety verifier',
  verifier_minimind: 'MiniMind safety verifier',
  memory_updater: 'MiniMind memory updater',
  support_categorise: 'Support categorise',
};

function labelForCallSite(slug: string): string {
  return CALL_SITE_LABEL[slug] ?? slug;
}

export default async function AdminTelemetry() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // One aggregate query per window + two group-bys. Prisma runs these in
  // parallel; the AiUsage table is indexed on createdAt for these ranges.
  const [today, week, month, byCallSite, topUsers] = await Promise.all([
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: startOfToday } },
      _sum: {
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheCreationTokens: true,
      },
      _count: true,
    }),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: weekAgo } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: {
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheCreationTokens: true,
      },
      _count: true,
    }),
    prisma.aiUsage.groupBy({
      by: ['callSite'],
      where: { createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startOfMonth },
        userId: { not: null },
      },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 20,
    }),
  ]);

  // Cache-read ratio for the month — how much of the input-side spend was
  // cheap cached reads vs paid uncached input. Higher is better.
  const cacheReadMonth = month._sum.cacheReadTokens ?? 0;
  const uncachedInputMonth = month._sum.inputTokens ?? 0;
  const totalInputSideMonth = cacheReadMonth + uncachedInputMonth;
  const cacheReadRatio =
    totalInputSideMonth > 0 ? cacheReadMonth / totalInputSideMonth : 0;

  // Enrich topUsers with the user's email for the table.
  const topUserIds = topUsers
    .map((r) => r.userId)
    .filter((id): id is string => id !== null);
  const topUserEmails = topUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailById = new Map(topUserEmails.map((u) => [u.id, u.email]));

  return (
    <div className="max-w-5xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Telemetry
      </div>
      <h1 className="text-[28px] mb-6 font-medium">AI usage & cost</h1>
      <p className="text-[13px] leading-[1.65] text-neutral-600 mb-8">
        Live from the <code>AiUsage</code> table. Every Anthropic call (Journey,
        MiniMind, safety verifiers, memory updater, support categorise) writes
        one row with its token counts and derived cost. See the Anthropic
        console for the authoritative invoice; these numbers reflect what the
        app itself measured.
      </p>

      {/* Top row: current-window spend */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatTile
          kicker="Today"
          primary={fmtUsd(today._sum.costUsd)}
          secondary={`${today._count.toLocaleString('en-GB')} calls`}
        />
        <StatTile
          kicker="Last 7 days"
          primary={fmtUsd(week._sum.costUsd)}
          secondary={`${week._count.toLocaleString('en-GB')} calls`}
        />
        <StatTile
          kicker="This month"
          primary={fmtUsd(month._sum.costUsd)}
          secondary={`${month._count.toLocaleString('en-GB')} calls`}
        />
      </div>

      {/* Cache health for the month */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatTile
          kicker="Month · input tokens (uncached)"
          primary={fmtInt(month._sum.inputTokens)}
          secondary="Regular input tokens billed at full price"
        />
        <StatTile
          kicker="Month · cache reads"
          primary={fmtInt(month._sum.cacheReadTokens)}
          secondary="Cached tokens read at ~10% of full input price"
        />
        <StatTile
          kicker="Month · cache-read ratio"
          primary={`${Math.round(cacheReadRatio * 100)}%`}
          secondary={
            cacheReadRatio >= 0.7
              ? 'Caching working well (>70%)'
              : cacheReadRatio >= 0.4
                ? 'OK — many sessions have long gaps'
                : 'Low — few cache hits, cost-per-turn is elevated'
          }
        />
      </div>

      {/* By call site */}
      <div className="border border-neutral-200 rounded-lg p-5 bg-white mb-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Month by call site
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-4 font-normal">Call site</th>
              <th className="py-2 pr-4 font-normal text-right">Calls</th>
              <th className="py-2 pr-4 font-normal text-right">Input tokens</th>
              <th className="py-2 pr-4 font-normal text-right">Output tokens</th>
              <th className="py-2 font-normal text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {byCallSite
              .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
              .map((row) => (
                <tr key={row.callSite} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">{labelForCallSite(row.callSite)}</td>
                  <td className="py-2 pr-4 text-right">
                    {row._count._all.toLocaleString('en-GB')}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {fmtInt(row._sum.inputTokens)}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {fmtInt(row._sum.outputTokens)}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {fmtUsd(row._sum.costUsd)}
                  </td>
                </tr>
              ))}
            {byCallSite.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-neutral-500">
                  No usage recorded yet this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Top 20 users this month */}
      <div className="border border-neutral-200 rounded-lg p-5 bg-white mb-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Top 20 users · this month
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-4 font-normal">User</th>
              <th className="py-2 pr-4 font-normal text-right">Calls</th>
              <th className="py-2 pr-4 font-normal text-right">Input tokens</th>
              <th className="py-2 pr-4 font-normal text-right">Output tokens</th>
              <th className="py-2 font-normal text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {topUsers.map((row) => (
              <tr
                key={row.userId ?? 'null'}
                className="border-b border-neutral-100"
              >
                <td className="py-2 pr-4 font-mono text-[12px]">
                  {row.userId
                    ? (emailById.get(row.userId) ?? row.userId.slice(0, 12))
                    : '(unattributed)'}
                </td>
                <td className="py-2 pr-4 text-right">
                  {row._count._all.toLocaleString('en-GB')}
                </td>
                <td className="py-2 pr-4 text-right">
                  {fmtInt(row._sum.inputTokens)}
                </td>
                <td className="py-2 pr-4 text-right">
                  {fmtInt(row._sum.outputTokens)}
                </td>
                <td className="py-2 text-right font-medium">
                  {fmtUsd(row._sum.costUsd)}
                </td>
              </tr>
            ))}
            {topUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-neutral-500">
                  No per-user usage recorded yet this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cross-reference for the invoice */}
      <div className="border border-dashed border-neutral-300 rounded-lg p-5 bg-white">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-2">
          Cross-reference
        </div>
        <p className="text-[13px] leading-[1.6] text-neutral-600 mb-3">
          The dollar figures above are derived from token counts multiplied
          by the pricing snapshot in{' '}
          <code>lib/ai-usage/cost.ts</code>. Anthropic&apos;s console is the
          authoritative invoice — small drift is expected.
        </p>
        <Link
          href="https://console.anthropic.com/settings/usage"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[13px] text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
        >
          Open Anthropic Console → Usage →
        </Link>
      </div>
    </div>
  );
}
