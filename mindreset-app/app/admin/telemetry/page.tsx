import Link from 'next/link';
import prisma from '@/lib/prisma';
import {
  JOURNEY_CALL_SITES,
  isJourneyCallSite,
  journeyReportWindows,
  avgCostPerCall,
  toCostRows,
  toUserCostRows,
  bucketDailyCost,
  buildCapTable,
  type CapStatus,
} from '@/lib/admin/journey-cost-report';

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

// Per-AI-call costs are small — show 4 dp so they don't round to $0.00.
function fmtUsd4(n: number | null | undefined): string {
  const v = n ?? 0;
  return `$${v.toFixed(4)}`;
}

// Cap-utilisation status — the only place on this page that uses colour.
// Inline colours (not Tailwind classes) so they survive any purge config.
const CAP_STATUS_STYLE: Record<CapStatus, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#525252' },
  warning: { label: 'Warning', color: '#b45309' },
  over_cap: { label: 'Over cap', color: '#b91c1c' },
};

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
  // UTC-explicit windows so this dashboard matches cap enforcement
  // (lib/ai-usage/monthly-cap.ts monthWindowUtc). On Vercel the server clock
  // is UTC so this is behaviourally a no-op today; it makes the boundaries
  // correct regardless of server timezone and internally consistent across
  // the page (the audit flagged the old local-time boundaries).
  const { todayStartUtc, sevenDayStart, monthStartUtc } =
    journeyReportWindows(now);
  const startOfToday = todayStartUtc;
  const weekAgo = sevenDayStart;
  const startOfMonth = monthStartUtc;
  // 30 UTC days inclusive of today for the Journey daily trend.
  const dailyStart = new Date(
    todayStartUtc.getTime() - 29 * 24 * 60 * 60 * 1000,
  );
  // Journey = these two call sites only (mirrors the monthly-cap filter).
  const journeyCallSiteFilter = { in: [...JOURNEY_CALL_SITES] };

  // One aggregate query per window + group-bys, plus the Journey-scoped
  // queries. Prisma runs these in parallel; AiUsage is indexed on
  // createdAt, [userId, createdAt] and [callSite, createdAt].
  const [
    today,
    week,
    month,
    byCallSite,
    topUsers,
    jToday,
    jWeek,
    jMonth,
    jByModel,
    jUsers,
    jDailyRows,
  ] = await Promise.all([
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
    // ---- Journey-only (journey_turn + verifier_journey) ----
    prisma.aiUsage.aggregate({
      where: { callSite: journeyCallSiteFilter, createdAt: { gte: startOfToday } },
      _sum: { costUsd: true },
      _count: true,
    }),
    prisma.aiUsage.aggregate({
      where: { callSite: journeyCallSiteFilter, createdAt: { gte: weekAgo } },
      _sum: { costUsd: true },
      _count: true,
    }),
    prisma.aiUsage.aggregate({
      where: { callSite: journeyCallSiteFilter, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
      _count: true,
    }),
    prisma.aiUsage.groupBy({
      by: ['model'],
      where: { callSite: journeyCallSiteFilter, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.groupBy({
      by: ['userId'],
      where: {
        callSite: journeyCallSiteFilter,
        createdAt: { gte: startOfMonth },
        userId: { not: null },
      },
      _sum: { costUsd: true },
      _count: { _all: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 100,
    }),
    prisma.aiUsage.findMany({
      where: { callSite: journeyCallSiteFilter, createdAt: { gte: dailyStart } },
      select: { createdAt: true, costUsd: true },
    }),
  ]);

  // Cache-read ratio for the month — how much of the input-side spend was
  // cheap cached reads vs paid uncached input. Higher is better.
  const cacheReadMonth = month._sum.cacheReadTokens ?? 0;
  const uncachedInputMonth = month._sum.inputTokens ?? 0;
  const totalInputSideMonth = cacheReadMonth + uncachedInputMonth;
  const cacheReadRatio =
    totalInputSideMonth > 0 ? cacheReadMonth / totalInputSideMonth : 0;

  // Enrich the user tables (all-product top users + Journey users) with
  // emails via one lookup over the union of their ids.
  const allUserIds = Array.from(
    new Set(
      [...topUsers, ...jUsers]
        .map((r) => r.userId)
        .filter((id): id is string => id !== null),
    ),
  );
  const userRows = allUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailById = new Map(userRows.map((u) => [u.id, u.email]));

  // ---- Journey view-models (pure helpers; unit-tested) ----
  const jMonthCost = jMonth._sum.costUsd ?? 0;
  const jMonthCalls = jMonth._count;
  const jAvgPerCall = avgCostPerCall(jMonthCost, jMonthCalls);
  const journeyModelRows = toCostRows(
    jByModel.map((r) => ({
      key: r.model,
      costUsd: r._sum.costUsd,
      calls: r._count._all,
    })),
  );
  const journeyCallSiteRows = toCostRows(
    byCallSite
      .filter((r) => isJourneyCallSite(r.callSite))
      .map((r) => ({
        key: r.callSite,
        costUsd: r._sum.costUsd,
        calls: r._count._all,
      })),
  );
  const journeyTopUsers = toUserCostRows(
    jUsers.map((r) => ({
      userId: r.userId as string,
      costUsd: r._sum.costUsd,
      calls: r._count._all,
    })),
    emailById,
  ).slice(0, 20);
  const journeyCapRows = buildCapTable(
    jUsers.map((r) => ({
      userId: r.userId as string,
      spentUsd: r._sum.costUsd ?? 0,
    })),
    emailById,
    now,
  );
  const journeyDaily = bucketDailyCost(jDailyRows, now, 30);

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

      {/* ===================================================================
          The Journey — operational cost (Level A). journey_turn +
          verifier_journey only. All figures are per AI CALL / successful
          generation, NOT per user turn (AiUsage.journeyTurnId is not
          populated); failed/interrupted turns record no usage, so these
          numbers are a conservative lower bound.
      ==================================================================== */}
      <div className="border-t border-neutral-200 pt-8 mb-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
          The Journey · operational cost
        </div>
        <p className="text-[13px] leading-[1.65] text-neutral-600">
          <code>journey_turn</code> + <code>verifier_journey</code> only.
          Figures are per AI call / successful generation (not per user turn),
          and exclude failed or interrupted turns, which record no usage.
        </p>
      </div>

      {/* Journey spend windows */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatTile
          kicker="Journey · today"
          primary={fmtUsd(jToday._sum.costUsd)}
          secondary={`${jToday._count.toLocaleString('en-GB')} calls`}
        />
        <StatTile
          kicker="Journey · last 7 days"
          primary={fmtUsd(jWeek._sum.costUsd)}
          secondary={`${jWeek._count.toLocaleString('en-GB')} calls`}
        />
        <StatTile
          kicker="Journey · this month"
          primary={fmtUsd(jMonthCost)}
          secondary={`${jMonthCalls.toLocaleString('en-GB')} calls · avg ${fmtUsd4(jAvgPerCall)}/call`}
        />
      </div>

      {/* Journey cost by model */}
      <div className="border border-neutral-200 rounded-lg p-5 bg-white mb-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Journey month · by model
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-4 font-normal">Model</th>
              <th className="py-2 pr-4 font-normal text-right">Calls</th>
              <th className="py-2 pr-4 font-normal text-right">Avg / call</th>
              <th className="py-2 font-normal text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {journeyModelRows.map((row) => (
              <tr key={row.key} className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-[12px]">{row.key}</td>
                <td className="py-2 pr-4 text-right">{fmtInt(row.calls)}</td>
                <td className="py-2 pr-4 text-right">
                  {fmtUsd4(row.avgCostPerCall)}
                </td>
                <td className="py-2 text-right font-medium">
                  {fmtUsd(row.costUsd)}
                </td>
              </tr>
            ))}
            {journeyModelRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-neutral-500">
                  No Journey usage recorded yet this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Journey cost by call site */}
      <div className="border border-neutral-200 rounded-lg p-5 bg-white mb-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Journey month · by call site
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-4 font-normal">Call site</th>
              <th className="py-2 pr-4 font-normal text-right">Calls</th>
              <th className="py-2 pr-4 font-normal text-right">Avg / call</th>
              <th className="py-2 font-normal text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {journeyCallSiteRows.map((row) => (
              <tr key={row.key} className="border-b border-neutral-100">
                <td className="py-2 pr-4">{labelForCallSite(row.key)}</td>
                <td className="py-2 pr-4 text-right">{fmtInt(row.calls)}</td>
                <td className="py-2 pr-4 text-right">
                  {fmtUsd4(row.avgCostPerCall)}
                </td>
                <td className="py-2 text-right font-medium">
                  {fmtUsd(row.costUsd)}
                </td>
              </tr>
            ))}
            {journeyCallSiteRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-neutral-500">
                  No Journey usage recorded yet this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Journey daily cost trend — last 30 UTC days, newest first */}
      <div className="border border-neutral-200 rounded-lg p-5 bg-white mb-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Journey · daily cost (last 30 days, UTC)
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-4 font-normal">Day (UTC)</th>
              <th className="py-2 pr-4 font-normal text-right">Calls</th>
              <th className="py-2 font-normal text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {[...journeyDaily].reverse().map((d) => (
              <tr key={d.dayUtc} className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-[12px]">{d.dayUtc}</td>
                <td className="py-2 pr-4 text-right">{fmtInt(d.calls)}</td>
                <td className="py-2 text-right font-medium">
                  {fmtUsd(d.costUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Journey top users this month */}
      <div className="border border-neutral-200 rounded-lg p-5 bg-white mb-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Journey · top users this month
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-4 font-normal">User</th>
              <th className="py-2 pr-4 font-normal text-right">Calls</th>
              <th className="py-2 font-normal text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {journeyTopUsers.map((row) => (
              <tr key={row.userId} className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-[12px]">
                  {row.email ?? row.userId.slice(0, 12)}
                </td>
                <td className="py-2 pr-4 text-right">{fmtInt(row.calls)}</td>
                <td className="py-2 text-right font-medium">
                  {fmtUsd(row.costUsd)}
                </td>
              </tr>
            ))}
            {journeyTopUsers.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-neutral-500">
                  No per-user Journey usage recorded yet this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Journey monthly cap utilisation */}
      <div className="border border-neutral-200 rounded-lg p-5 bg-white mb-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Journey · monthly cap utilisation (UTC month)
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-4 font-normal">User</th>
              <th className="py-2 pr-4 font-normal text-right">Effective cap</th>
              <th className="py-2 pr-4 font-normal text-right">Spent</th>
              <th className="py-2 pr-4 font-normal text-right">Remaining</th>
              <th className="py-2 pr-4 font-normal text-right">Usage</th>
              <th className="py-2 font-normal text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {journeyCapRows.map((row) => (
              <tr key={row.userId} className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-[12px]">
                  {row.email ?? row.userId.slice(0, 12)}
                </td>
                <td className="py-2 pr-4 text-right">{fmtUsd(row.capUsd)}</td>
                <td className="py-2 pr-4 text-right">{fmtUsd(row.spentUsd)}</td>
                <td className="py-2 pr-4 text-right">
                  {fmtUsd(row.remainingUsd)}
                </td>
                <td className="py-2 pr-4 text-right">{row.usagePercent}%</td>
                <td
                  className="py-2 text-right font-medium"
                  style={{ color: CAP_STATUS_STYLE[row.status].color }}
                >
                  {CAP_STATUS_STYLE[row.status].label}
                </td>
              </tr>
            ))}
            {journeyCapRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-neutral-500">
                  No Journey spend recorded yet this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="text-[12px] leading-[1.6] text-neutral-500 mt-3">
          Effective cap resolves any configured per-user override through the
          same function used by enforcement. Status: normal (below the warn
          threshold), warning (warn reached, below cap), over cap (cap reached).
        </p>
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
