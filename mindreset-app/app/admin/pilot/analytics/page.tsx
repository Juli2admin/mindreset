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
  aggregateScales,
  scaleVerdict,
  SCALES,
  type TesterPair,
  type ScaleAggregate,
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

  const [summary, pairs] = await Promise.all([
    loadSummary(),
    loadTesterPairs(),
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
  return (
    <>
      <tr className="border-t border-neutral-200 bg-neutral-50">
        <td className="px-2 py-1.5 font-medium" colSpan={2 + SCALES.length}>
          <span className="text-[12px]">{p.email ?? '—'}</span>
          <span className="text-[11px] text-neutral-500 ml-2">{p.code}</span>
          <span className="text-[11px] text-neutral-500 ml-3">
            Before {fmtDate(p.beforeAt)} · After {fmtDate(p.afterAt)}
          </span>
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
