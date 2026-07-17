// /admin/pilot/analytics — the pilot's core measurement view.
//
// PR ω3c (2026-07-14). Before-vs-after per-scale deltas, individual
// tester deltas, key free-text answers, and a CSV export link.
//
// Deliberately simple: server-rendered, no interactive charts. If you
// see anything moving (understand ↑ / stuck ↓), the pilot did
// something real; if everything is flat, it didn't. That is Julia's
// authored reading in her md ("understanding ↑ and stuck ↓ = the
// method is doing its job").

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUserIsAdmin } from '@/lib/admin/auth';
import {
  loadSummary,
  loadTesterPairs,
  loadMethodEfficacy,
  aggregateScales,
  scaleVerdict,
  SCALES,
  type TesterPair,
  type ScaleAggregate,
  type MethodEfficacy,
} from '@/lib/pilot/analytics';

export const dynamic = 'force-dynamic';

function fmt(n: number | null, digits = 1): string {
  if (n === null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

function fmtSigned(n: number | null, digits = 1): string {
  if (n === null || Number.isNaN(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
}

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

const VERDICT_STYLE: Record<
  NonNullable<ReturnType<typeof scaleVerdict>>,
  string
> = {
  good: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  bad: 'bg-red-50 text-red-800 border-red-200',
  flat: 'bg-neutral-50 text-neutral-600 border-neutral-200',
};

const VERDICT_LABEL: Record<
  NonNullable<ReturnType<typeof scaleVerdict>>,
  string
> = {
  good: 'moving',
  bad: 'wrong direction',
  flat: 'flat',
};

export default async function AdminPilotAnalyticsPage() {
  if (!(await currentUserIsAdmin())) redirect('/');

  const [summary, pairs, efficacy] = await Promise.all([
    loadSummary(),
    loadTesterPairs(),
    loadMethodEfficacy(),
  ]);
  const scaleAggs = aggregateScales(pairs);

  const withAnyBefore = pairs.filter((p) => p.beforeAt !== null);
  const withBoth = pairs.filter(
    (p) => p.beforeAt !== null && p.afterAt !== null,
  );

  return (
    <div className="max-w-6xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Pilot programme
      </div>
      <h1 className="text-[28px] mb-2 font-medium">Analytics</h1>
      <p className="text-[13px] leading-[1.65] text-neutral-700 mb-6">
        Julia&rsquo;s core measurement: the same six 0–10 scales in Before
        and After. Understand ↑ and Stuck ↓ = the method is doing its job.
        Heavy drop-off in the same place = fix that place. Everyone
        polite, nobody critical = they&rsquo;re being kind, not honest
        (you learned nothing).
      </p>

      {/* Summary card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatChip label="Redeemed" value={summary.totalRedeemed} />
        <StatChip label="Before filled" value={summary.totalBefore} />
        <StatChip label="After filled" value={summary.totalAfter} />
        <StatChip label="Both forms" value={summary.totalBoth} accent />
      </div>

      {/* Scale aggregates */}
      <h2 className="text-[18px] font-medium mb-3">Per-scale movement</h2>
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden mb-8">
        {withBoth.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-neutral-500">
            No tester has completed both Before and After yet. Once even
            one has, per-scale deltas will appear here.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Scale</th>
                <th className="px-3 py-2 font-medium">Expected</th>
                <th className="px-3 py-2 font-medium text-right">N</th>
                <th className="px-3 py-2 font-medium text-right">Mean before</th>
                <th className="px-3 py-2 font-medium text-right">Mean after</th>
                <th className="px-3 py-2 font-medium text-right">Δ</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {scaleAggs.map((agg) => (
                <ScaleAggregateRow key={agg.key} agg={agg} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Engagement summary — filled + Journey usage. Only shown when
          there's at least one tester with a Before response so an empty
          cohort renders clean. */}
      {withAnyBefore.length > 0 && <EngagementSummary pairs={withAnyBefore} />}

      {/* Method efficacy — aggregate Journey-data view built for future
          certification evidence. Six metrics from unencrypted operational
          fields (JourneyTurn / JourneyPracticeRun / RecodeProgress /
          SafetyEvent). Cohort scope = pilot invitees only. */}
      {efficacy.cohortSize > 0 && <MethodEfficacyBlock efficacy={efficacy} />}

      {/* Per-tester rows */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-[18px] font-medium">Per-tester movement</h2>
        <a
          href="/api/admin/pilot/export"
          className="text-[12px] text-blue-700 hover:underline"
        >
          Download CSV →
        </a>
      </div>
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden mb-8">
        {withAnyBefore.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-neutral-500">
            No responses yet.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium">Tester</th>
                <th className="px-2 py-2 font-medium">Before / After</th>
                {SCALES.map((s) => (
                  <th key={s.key} className="px-2 py-2 font-medium text-center">
                    {shortLabel(s.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withAnyBefore.map((p) => (
                <TesterRow key={p.invitationId} p={p} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Free-text — the qualitative signal per Julia's md */}
      <h2 className="text-[18px] font-medium mb-3">Key free-text answers</h2>
      <p className="text-[12px] leading-[1.65] text-neutral-500 mb-4">
        Q11 (shifted without forcing) is the pilot&rsquo;s key claim.
        Q15 (confusing / boring / missing) is what to fix. Q19
        (anything else, especially negative) is where the real feedback
        lives.
      </p>

      {withAnyBefore.map((p) => {
        const hasFreeText =
          p.beforePatternText ||
          p.beforeHope ||
          p.afterShifted ||
          p.afterConfusingBoring ||
          p.afterAnythingElse;
        if (!hasFreeText) return null;
        return (
          <div
            key={p.invitationId}
            className="bg-white rounded-lg border border-neutral-200 p-5 mb-4"
          >
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-[13px] font-medium">{p.email ?? '—'}</span>
              <span className="text-[12px] text-neutral-500">{p.code}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 text-[13px]">
              {p.beforePatternText && (
                <Quote label="Pattern (Before)" body={p.beforePatternText} />
              )}
              {p.beforeHope && (
                <Quote label="Hope in a month (Before)" body={p.beforeHope} />
              )}
              {p.afterShifted && (
                <Quote
                  label="Shifted without forcing (After — KEY)"
                  body={p.afterShifted}
                  emphasise
                />
              )}
              {p.afterConfusingBoring && (
                <Quote
                  label="Confusing / boring / missing (After)"
                  body={p.afterConfusingBoring}
                />
              )}
              {p.afterAnythingElse && (
                <Quote
                  label="Anything else (After)"
                  body={p.afterAnythingElse}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational
// ---------------------------------------------------------------------------

function EngagementSummary({ pairs }: { pairs: TesterPair[] }) {
  const total = pairs.length;
  const neverOpened = pairs.filter((p) => p.engagement.userTurnCount === 0).length;
  const meanTurns =
    pairs.reduce((a, p) => a + p.engagement.userTurnCount, 0) / total;
  const meanDaysActive =
    pairs.reduce((a, p) => a + p.engagement.daysActive, 0) / total;
  const withSafety = pairs.filter((p) => p.engagement.safetyEventCount > 0).length;
  return (
    <div className="mb-6">
      <h2 className="text-[18px] font-medium mb-3">Journey engagement</h2>
      <p className="text-[12px] leading-[1.6] text-neutral-500 mb-3">
        Turn count is user messages only (assistant replies excluded to
        avoid double-counting). Days active = distinct dates a user
        posted at least one Journey turn. Safety events are triggered
        when the Journey safety layer detects a red-flag phrase and
        auto-freezes.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip label="Never opened Journey" value={neverOpened} />
        <StatChip label="Mean turns / tester" value={Math.round(meanTurns)} />
        <StatChip label="Mean days active" value={Math.round(meanDaysActive)} />
        <StatChip label="Safety events triggered" value={withSafety} />
      </div>
    </div>
  );
}

function shortLabel(full: string): string {
  const map: Record<string, string> = {
    'Understand why I react': 'Und.',
    'Notice before it takes over': 'Not.',
    'Able to choose a different response': 'Ch.',
    'Hard on myself': 'Hard',
    'Affects daily life': 'Aff.',
    'Stuck': 'Stuck',
  };
  return map[full] ?? full.slice(0, 6);
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        accent
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="text-[24px] font-medium leading-none">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mt-1">
        {label}
      </div>
    </div>
  );
}

function ScaleAggregateRow({ agg }: { agg: ScaleAggregate }) {
  const verdict = scaleVerdict(agg);
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-3 py-2">{agg.label}</td>
      <td className="px-3 py-2 text-neutral-500">
        {agg.expected === 'up' ? 'goes up ↑' : 'goes down ↓'}
      </td>
      <td className="px-3 py-2 text-right">{agg.nWithBoth}</td>
      <td className="px-3 py-2 text-right">{fmt(agg.meanBefore)}</td>
      <td className="px-3 py-2 text-right">{fmt(agg.meanAfter)}</td>
      <td className="px-3 py-2 text-right font-medium">
        {fmtSigned(agg.meanDelta)}
      </td>
      <td className="px-3 py-2">
        {verdict && (
          <span
            className={`inline-block text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${VERDICT_STYLE[verdict]}`}
          >
            {VERDICT_LABEL[verdict]}
          </span>
        )}
      </td>
    </tr>
  );
}

function TesterRow({ p }: { p: TesterPair }) {
  const e = p.engagement;
  return (
    <>
      <tr className="border-t border-neutral-200 bg-neutral-50">
        <td className="px-2 py-1.5 font-medium" colSpan={2 + SCALES.length}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[12px]">{p.email ?? '—'}</span>
            <span className="text-[11px] text-neutral-500">{p.code}</span>
            <span className="text-[11px] text-neutral-500">
              Before {fmtDate(p.beforeAt)} · After {fmtDate(p.afterAt)}
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                e.userTurnCount === 0
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-neutral-100 text-neutral-700 border-neutral-200'
              }`}
              title={
                e.firstJourneyAt
                  ? `First message ${fmtDate(e.firstJourneyAt)} · last ${fmtDate(e.lastJourneyAt)}`
                  : 'Never opened Journey'
              }
            >
              {e.userTurnCount} turns · {e.daysActive}d active
            </span>
            {e.safetyEventCount > 0 && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200"
                title="Safety events triggered during the pilot arc"
              >
                {e.safetyEventCount} safety event{e.safetyEventCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </td>
      </tr>
      <tr className="border-b border-neutral-100">
        <td className="px-2 py-1.5 text-neutral-500">Before</td>
        <td className="px-2 py-1.5 text-neutral-500">→</td>
        {SCALES.map((s) => (
          <td key={s.key} className="px-2 py-1.5 text-center">
            {fmt(p.scales[s.key].before, 0)}
          </td>
        ))}
      </tr>
      <tr className="border-b border-neutral-100">
        <td className="px-2 py-1.5 text-neutral-500">After</td>
        <td className="px-2 py-1.5 text-neutral-500">→</td>
        {SCALES.map((s) => (
          <td key={s.key} className="px-2 py-1.5 text-center">
            {fmt(p.scales[s.key].after, 0)}
          </td>
        ))}
      </tr>
      <tr className="border-b border-neutral-100">
        <td className="px-2 py-1.5 text-neutral-500">Δ</td>
        <td className="px-2 py-1.5"></td>
        {SCALES.map((s) => {
          const b = p.scales[s.key].before;
          const a = p.scales[s.key].after;
          const d = b !== null && a !== null ? a - b : null;
          const good =
            d === null
              ? null
              : Math.abs(d) < 0.5
                ? 'flat'
                : s.expected === 'up'
                  ? d > 0
                    ? 'good'
                    : 'bad'
                  : d < 0
                    ? 'good'
                    : 'bad';
          return (
            <td
              key={s.key}
              className={`px-2 py-1.5 text-center font-medium ${
                good === 'good'
                  ? 'text-emerald-700'
                  : good === 'bad'
                    ? 'text-red-700'
                    : 'text-neutral-500'
              }`}
            >
              {fmtSigned(d, 0)}
            </td>
          );
        })}
      </tr>
    </>
  );
}

function Quote({
  label,
  body,
  emphasise,
}: {
  label: string;
  body: string;
  emphasise?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-[11px] uppercase tracking-[0.12em] mb-1 ${
          emphasise ? 'text-emerald-800' : 'text-neutral-500'
        }`}
      >
        {label}
      </div>
      <div
        className={`whitespace-pre-wrap leading-[1.55] ${
          emphasise
            ? 'text-neutral-900 font-medium'
            : 'text-neutral-700'
        }`}
      >
        {body}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Method efficacy — six metric tables from Journey data (unencrypted).
// ---------------------------------------------------------------------------

function MethodEfficacyBlock({ efficacy }: { efficacy: MethodEfficacy }) {
  return (
    <div className="mb-8">
      <h2 className="text-[18px] font-medium mb-1">Method efficacy</h2>
      <p className="text-[12px] leading-[1.6] text-neutral-500 mb-5">
        Aggregate certification-evidence view built from Journey state
        reports (unencrypted operational fields only). Cohort:{' '}
        {efficacy.cohortSize} pilot tester
        {efficacy.cohortSize === 1 ? '' : 's'}. Session = a run of
        JourneyTurn rows with no gap longer than 30 minutes — same
        definition used in the Journey Inspector diagnostics.
      </p>

      <MetricBlock
        title="Cohort session activity — weekly"
        note="Sessions started + distinct active testers per ISO week. Watch: engagement climbing = readers finding it useful. Falling = drop-off happening (find where)."
      >
        {efficacy.weekly.length === 0 ? (
          <EmptyRow message="No Journey sessions started yet." />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Week starting</th>
                <th className="px-3 py-2 font-medium text-right">Sessions</th>
                <th className="px-3 py-2 font-medium text-right">Active testers</th>
                <th className="px-3 py-2 font-medium text-right">Sessions / active</th>
              </tr>
            </thead>
            <tbody>
              {efficacy.weekly.map((w) => (
                <tr
                  key={w.weekStart.toISOString()}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-3 py-2">{fmtDate(w.weekStart)}</td>
                  <td className="px-3 py-2 text-right">{w.sessions}</td>
                  <td className="px-3 py-2 text-right">{w.activeTesters}</td>
                  <td className="px-3 py-2 text-right text-neutral-600">
                    {w.activeTesters > 0
                      ? (w.sessions / w.activeTesters).toFixed(1)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MetricBlock>

      <MetricBlock
        title="Intensity trajectory — by session number in each tester's arc"
        note="Median CLOSING intensity, aggregated across all testers, per Nth session in their arc. Method working = later sessions close at lower intensity than earlier ones. N = distinct testers who reached that session number."
      >
        {efficacy.intensityByOrdinal.length === 0 ? (
          <EmptyRow message="No closing-intensity data yet." />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Session #</th>
                <th className="px-3 py-2 font-medium text-right">N testers</th>
                <th className="px-3 py-2 font-medium text-right">Median closing intensity</th>
              </tr>
            </thead>
            <tbody>
              {efficacy.intensityByOrdinal.map((r) => (
                <tr
                  key={r.sessionNo}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-3 py-2">Session {r.sessionNo}</td>
                  <td className="px-3 py-2 text-right">{r.nSessions}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {r.medianClosingIntensity === null
                      ? '—'
                      : r.medianClosingIntensity.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MetricBlock>

      <MetricBlock
        title="Closing intensity distribution — monthly"
        note="How readers left each session, bucketed. Calm (≤ 3) + Neutral (4-5) = safe close. Activated (6-7) + Overwhelmed (8-10) = session did not land. Trend calm % up over months for certification."
      >
        {efficacy.closingIntensityByMonth.length === 0 ? (
          <EmptyRow message="No closing data yet." />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 font-medium text-right">N sessions</th>
                <th className="px-3 py-2 font-medium text-right">Calm ≤3</th>
                <th className="px-3 py-2 font-medium text-right">Neutral 4-5</th>
                <th className="px-3 py-2 font-medium text-right">Activated 6-7</th>
                <th className="px-3 py-2 font-medium text-right">Overwhelmed 8-10</th>
              </tr>
            </thead>
            <tbody>
              {efficacy.closingIntensityByMonth.map((r) => (
                <tr
                  key={r.month}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-3 py-2">{r.month}</td>
                  <td className="px-3 py-2 text-right">{r.nSessions}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">
                    {r.calmPct.toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-700">
                    {r.neutralPct.toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right text-amber-700">
                    {r.activatedPct.toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right text-red-700">
                    {r.overwhelmedPct.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MetricBlock>

      <MetricBlock
        title="Stage distribution — snapshot"
        note="Where the cohort is on the arc right now. Movement over time is captured naturally as testers advance stages (higher stages fill up as pilot matures)."
      >
        {efficacy.stageDistribution.length === 0 ? (
          <EmptyRow message="No stage data yet." />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Current stage</th>
                <th className="px-3 py-2 font-medium text-right">Testers</th>
                <th className="px-3 py-2 font-medium text-right">% of cohort</th>
              </tr>
            </thead>
            <tbody>
              {efficacy.stageDistribution.map((r) => (
                <tr
                  key={r.stage}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-3 py-2">Stage {r.stage}</td>
                  <td className="px-3 py-2 text-right">{r.testers}</td>
                  <td className="px-3 py-2 text-right text-neutral-600">
                    {((r.testers / efficacy.cohortSize) * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MetricBlock>

      <MetricBlock
        title="Practice completion — all-time"
        note="How practices ran across all pilot sessions. Aborts declining over time = AI + reader tuning to each other. High started/mid without completed = practice not landing to close."
      >
        {efficacy.practiceOutcomes.length === 0 ? (
          <EmptyRow message="No practices run yet." />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Count</th>
                <th className="px-3 py-2 font-medium text-right">% of runs</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const total = efficacy.practiceOutcomes.reduce(
                  (a, r) => a + r.count,
                  0,
                );
                return efficacy.practiceOutcomes.map((r) => (
                  <tr
                    key={r.status}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 text-right">{r.count}</td>
                    <td className="px-3 py-2 text-right text-neutral-600">
                      {total > 0 ? ((r.count / total) * 100).toFixed(0) : 0}%
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        )}
      </MetricBlock>

      <MetricBlock
        title="Safety event rate — monthly"
        note="Safety events triggered per 100 sessions. Certification-grade: how often does the safety net fire? Trending toward zero as method matures = fewer readers reaching red-flag territory."
      >
        {efficacy.safetyByMonth.length === 0 ? (
          <EmptyRow message="No sessions in the window yet." />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 font-medium text-right">Sessions</th>
                <th className="px-3 py-2 font-medium text-right">Safety events</th>
                <th className="px-3 py-2 font-medium text-right">Rate per 100 sessions</th>
              </tr>
            </thead>
            <tbody>
              {efficacy.safetyByMonth.map((r) => (
                <tr
                  key={r.month}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-3 py-2">{r.month}</td>
                  <td className="px-3 py-2 text-right">{r.sessions}</td>
                  <td
                    className={`px-3 py-2 text-right ${
                      r.safetyEvents > 0 ? 'text-amber-800 font-medium' : ''
                    }`}
                  >
                    {r.safetyEvents}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-600">
                    {r.ratePer100Sessions === null
                      ? '—'
                      : r.ratePer100Sessions.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MetricBlock>
    </div>
  );
}

function MetricBlock({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-[14px] font-medium mb-1">{title}</h3>
      <p className="text-[11px] leading-[1.55] text-neutral-500 mb-2">{note}</p>
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="p-5 text-center text-[13px] text-neutral-500">
      {message}
    </div>
  );
}
