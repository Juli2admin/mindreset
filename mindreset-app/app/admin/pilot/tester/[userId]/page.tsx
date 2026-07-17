// /admin/pilot/tester/[userId] — per-tester progress view.
//
// The drill-down surface for the pilot analytics page. Answers: is this
// specific tester's arc working? Individual-level certification evidence.
//
// Layout, top-to-bottom:
//   1. Header — email, code, invitation dates, Before/After delta chips
//   2. Sessions timeline — table of every session
//   3. Intensity heatmap — session × turn grid, colour-graded
//   4. Stage progression — first-reached-at timestamp per stage
//   5. Journey patterns / parts / foreign material (decrypted)
//   6. Practices — status counts + last 30 runs
//
// Cohort scope: only pilot invitees. Non-pilot userIds render a
// "not-found" state rather than exposing arbitrary Journey data.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUserIsAdmin } from '@/lib/admin/auth';
import {
  isPilotTesterUserId,
  loadTesterProgress,
  loadHeatmap,
  SCALES,
  scaleVerdict,
  type TesterProgress,
  type HeatmapRow,
  type ScaleKey,
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

function fmtDateTime(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Intensity → colour band. Green calm, amber activated, red overwhelmed.
// Kept as inline styles because the heatmap uses hundreds of cells and
// Tailwind class churn would inflate the compiled CSS.
function intensityColour(v: number | null): string {
  if (v === null) return '#f5f5f5';
  if (v <= 1) return '#dcfce7';
  if (v <= 3) return '#bbf7d0';
  if (v <= 5) return '#fef3c7';
  if (v <= 7) return '#fed7aa';
  if (v <= 8) return '#fca5a5';
  return '#f87171';
}

export default async function AdminPilotTesterProgressPage({
  params,
}: {
  params: { userId: string };
}) {
  if (!(await currentUserIsAdmin())) redirect('/');

  const isPilot = await isPilotTesterUserId(params.userId);
  if (!isPilot) return <NotFoundView userId={params.userId} />;

  const progress = await loadTesterProgress(params.userId);
  if (!progress) return <NotFoundView userId={params.userId} />;

  const heatmap = await loadHeatmap(params.userId, progress.heatmap);

  return (
    <div className="max-w-6xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Pilot programme · Tester progress
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-[24px] font-medium">
          {progress.email ?? '—'}
        </h1>
        <span className="text-[13px] font-mono text-neutral-500">
          {progress.invitationCode}
        </span>
      </div>
      <Link
        href="/admin/pilot/analytics"
        className="text-[12px] text-blue-700 hover:underline mb-6 inline-block"
      >
        ← Back to cohort analytics
      </Link>

      <HeaderCard p={progress} />

      <SessionsSection sessions={progress.sessions} />

      <HeatmapSection heatmap={heatmap} />

      <StageProgressionSection
        progression={progress.stageProgression}
        currentStage={progress.currentStage}
      />

      <PatternsSection patterns={progress.patterns} />

      <PartsSection parts={progress.parts} />

      <ForeignMaterialSection files={progress.foreignMaterial} />

      <PracticesSection
        statusCounts={progress.practiceStatusCounts}
        recent={progress.recentPractices}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function NotFoundView({ userId }: { userId: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Pilot programme · Tester progress
      </div>
      <h1 className="text-[24px] font-medium mb-4">Not a pilot tester</h1>
      <p className="text-[13px] text-neutral-700 mb-4">
        <code className="font-mono">{userId}</code> is not a redeemed pilot
        invitee. This drill-down surfaces only cohort testers.
      </p>
      <Link
        href="/admin/pilot/analytics"
        className="text-[13px] text-blue-700 hover:underline"
      >
        ← Back to cohort analytics
      </Link>
    </div>
  );
}

function HeaderCard({ p }: { p: TesterProgress }) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-5 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-[13px] mb-4">
        <Meta k="Invited" v={fmtDate(p.invitedAt)} />
        <Meta k="Redeemed" v={fmtDate(p.redeemedAt)} />
        <Meta
          k="Pilot ends"
          v={fmtDate(p.pilotTrialEndsAt)}
          warn={
            p.pilotTrialEndsAt !== null &&
            p.pilotTrialEndsAt.getTime() < Date.now()
          }
        />
        <Meta
          k="Revoked"
          v={p.invitationRevokedAt ? fmtDate(p.invitationRevokedAt) : '—'}
          warn={p.invitationRevokedAt !== null}
        />
        <Meta
          k="Current stage"
          v={p.currentStage === null ? '—' : `Stage ${p.currentStage}`}
        />
        <Meta k="Journey turns" v={String(p.engagement.userTurnCount)} />
        <Meta k="Days active" v={String(p.engagement.daysActive)} />
        <Meta
          k="Safety events"
          v={String(p.engagement.safetyEventCount)}
          warn={p.engagement.safetyEventCount > 0}
        />
      </div>
      <div className="border-t border-neutral-100 pt-3">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-2">
          Before / After per-scale delta
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-[12px]">
          {SCALES.map((s) => {
            const key = s.key as ScaleKey;
            const before = p.scales[key].before;
            const after = p.scales[key].after;
            const delta =
              before !== null && after !== null ? after - before : null;
            const verdict = delta === null
              ? null
              : scaleVerdict({
                  key,
                  label: s.label,
                  expected: s.expected,
                  nWithBoth: 1,
                  meanBefore: before,
                  meanAfter: after,
                  meanDelta: delta,
                });
            const colour =
              verdict === 'good'
                ? 'text-emerald-700'
                : verdict === 'bad'
                  ? 'text-red-700'
                  : 'text-neutral-500';
            return (
              <div
                key={key}
                className="rounded border border-neutral-200 p-2"
              >
                <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-1">
                  {shortLabel(s.label)}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {fmt(before, 0)} → {fmt(after, 0)}
                </div>
                <div className={`text-[13px] font-medium ${colour}`}>
                  {fmtSigned(delta, 1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SessionsSection({
  sessions,
}: {
  sessions: TesterProgress['sessions'];
}) {
  return (
    <Section title="Sessions timeline" note="Every Journey session for this tester, newest first. Stage span shows the min → max stage touched during the session. Capped at last 100 sessions.">
      {sessions.length === 0 ? (
        <EmptyRow message="No Journey sessions yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-right">Session #</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium text-right">Duration (min)</th>
                <th className="px-3 py-2 font-medium text-right">Turns</th>
                <th className="px-3 py-2 font-medium text-right">Closing intensity</th>
                <th className="px-3 py-2 font-medium">Closing safety</th>
                <th className="px-3 py-2 font-medium">Stage span</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.sessionNo}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-3 py-2 text-right font-mono text-neutral-600">
                    #{s.sessionNo}
                  </td>
                  <td className="px-3 py-2">{fmtDateTime(s.startedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {s.durationMinutes.toFixed(0)}
                  </td>
                  <td className="px-3 py-2 text-right">{s.turnCount}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className="inline-block w-6 h-6 leading-6 text-center rounded font-medium"
                      style={{
                        background: intensityColour(s.closingIntensity),
                      }}
                    >
                      {s.closingIntensity ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <SafetyChip flag={s.closingSafety} />
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {s.minStage === s.maxStage
                      ? `Stage ${s.minStage}`
                      : `Stage ${s.minStage} → ${s.maxStage}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function HeatmapSection({ heatmap }: { heatmap: HeatmapRow[] }) {
  return (
    <Section
      title="Intensity heatmap"
      note="Session × turn. Each cell is the intensity captured on that turn (colour-graded: green calm, red overwhelmed). Rows are sessions newest-first; columns are turn number within the session. Capped at last 30 sessions × first 40 turns."
    >
      {heatmap.length === 0 ? (
        <EmptyRow message="No sessions to visualise yet." />
      ) : (
        <div className="p-4 overflow-x-auto">
          <table className="text-[10px] font-mono">
            <thead>
              <tr>
                <th className="text-left pr-2 font-medium text-neutral-500">
                  Session
                </th>
                {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => (
                  <th
                    key={n}
                    className="w-5 text-center font-normal text-neutral-400"
                  >
                    {n % 5 === 0 ? n : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map((row) => (
                <tr key={row.sessionNo}>
                  <td className="pr-2 text-neutral-500 whitespace-nowrap">
                    #{row.sessionNo} · {fmtDate(row.startedAt)}
                  </td>
                  {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
                    const cell = row.cells.find((c) => c.turnNo === n);
                    return (
                      <td
                        key={n}
                        className="w-5 h-5 border border-white text-center align-middle"
                        style={{
                          background: intensityColour(cell?.intensity ?? null),
                        }}
                        title={
                          cell
                            ? `Turn ${n} · intensity ${cell.intensity ?? '—'} · safety ${cell.safety}`
                            : `Turn ${n} · no data`
                        }
                      >
                        {cell?.intensity !== null && cell?.intensity !== undefined
                          ? cell.intensity
                          : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function StageProgressionSection({
  progression,
  currentStage,
}: {
  progression: TesterProgress['stageProgression'];
  currentStage: number | null;
}) {
  return (
    <Section
      title="Stage progression"
      note="When this tester first reached each Journey stage. The current stage (from RecodeProgress) is highlighted."
    >
      {progression.length === 0 ? (
        <EmptyRow message="No stage data yet." />
      ) : (
        <table className="w-full text-[13px]">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">First reached</th>
              <th className="px-3 py-2 font-medium text-right">Session #</th>
            </tr>
          </thead>
          <tbody>
            {progression.map((r) => (
              <tr
                key={r.stage}
                className={`border-b border-neutral-100 last:border-0 ${
                  r.stage === currentStage ? 'bg-emerald-50' : ''
                }`}
              >
                <td className="px-3 py-2 font-medium">
                  Stage {r.stage}
                  {r.stage === currentStage && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-emerald-700">
                      current
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{fmtDateTime(r.firstReachedAt)}</td>
                <td className="px-3 py-2 text-right font-mono text-neutral-600">
                  #{r.sessionNo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function PatternsSection({
  patterns,
}: {
  patterns: TesterProgress['patterns'];
}) {
  return (
    <Section
      title="Journey patterns"
      note="Structural pattern notes the AI emits (fear_of_visibility, mother_voice, money_shame, etc.) with the reader's own words. Ordered by most-recently-confirmed."
    >
      {patterns.length === 0 ? (
        <EmptyRow message="No patterns captured yet." />
      ) : (
        <table className="w-full text-[13px]">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Reader&rsquo;s words</th>
              <th className="px-3 py-2 font-medium">First observed</th>
              <th className="px-3 py-2 font-medium">Last confirmed</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((r, i) => (
              <tr
                key={`${r.category}-${i}`}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="px-3 py-2 font-mono text-[12px] text-amber-800 whitespace-nowrap">
                  {r.category}
                </td>
                <td className="px-3 py-2 text-neutral-700 italic">
                  &ldquo;{r.description}&rdquo;
                </td>
                <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                  {fmtDate(r.firstObservedAt)}
                </td>
                <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                  {fmtDate(r.lastConfirmedAt)}
                </td>
                <td className="px-3 py-2">
                  <ActiveChip active={r.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function PartsSection({ parts }: { parts: TesterProgress['parts'] }) {
  return (
    <Section
      title="Journey parts"
      note="Inner figures the reader has met, in their own words. Resting place = where the part landed after Adult Self offered something. Newest first."
    >
      {parts.length === 0 ? (
        <EmptyRow message="No parts touched yet." />
      ) : (
        <div className="space-y-3 p-3">
          {parts.map((r) => (
            <div
              key={r.id}
              className="border border-neutral-200 rounded p-3 bg-neutral-50"
            >
              <div className="flex items-baseline gap-3 mb-1">
                <div className="text-[13px] font-medium text-neutral-800 italic">
                  &ldquo;{r.description}&rdquo;
                </div>
                <ActiveChip active={r.active} />
                <div className="text-[11px] text-neutral-500 ml-auto">
                  {fmtDate(r.createdAt)}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                <MetaSmall k="Channel" v={r.channel ?? '—'} />
                <MetaSmall k="Safe distance" v={r.safeDistance ?? '—'} />
                <MetaSmall k="Resting place" v={r.restingPlace ?? '—'} />
              </div>
              {r.compassionBridge && (
                <div className="mt-2 text-[11px] text-neutral-500">
                  Compassion bridge:{' '}
                  <span className="text-neutral-700">{r.compassionBridge}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function ForeignMaterialSection({
  files,
}: {
  files: TesterProgress['foreignMaterial'];
}) {
  return (
    <Section
      title="Foreign material"
      note="Beliefs / voices / patterns identified as not-mine. Released = returned to origin with an honouring phrase."
    >
      {files.length === 0 ? (
        <EmptyRow message="No foreign material identified yet." />
      ) : (
        <table className="w-full text-[13px]">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Belief / voice</th>
              <th className="px-3 py-2 font-medium">Origin</th>
              <th className="px-3 py-2 font-medium">Released to</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {files.map((r) => (
              <tr
                key={r.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="px-3 py-2 italic text-neutral-800">
                  &ldquo;{r.description}&rdquo;
                </td>
                <td className="px-3 py-2 text-neutral-600 italic">
                  {r.origin ? `"${r.origin}"` : '—'}
                </td>
                <td className="px-3 py-2 text-neutral-600 italic">
                  {r.returnedTo ? `"${r.returnedTo}"` : '—'}
                </td>
                <td className="px-3 py-2">
                  {r.releasedAt ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                      released {fmtDate(r.releasedAt)}
                    </span>
                  ) : r.identifiedAt ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                      identified
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-500">
                      pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function PracticesSection({
  statusCounts,
  recent,
}: {
  statusCounts: TesterProgress['practiceStatusCounts'];
  recent: TesterProgress['recentPractices'];
}) {
  const total = statusCounts.reduce((a, r) => a + r.count, 0);
  return (
    <Section
      title="Practices"
      note="Every practice run for this tester. Completion rate should climb over the arc as AI + reader tune to each other."
    >
      {total === 0 ? (
        <EmptyRow message="No practices run yet." />
      ) : (
        <div className="p-3 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-2">
              All-time outcomes
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {statusCounts.map((r) => (
                <div
                  key={r.status}
                  className="border border-neutral-200 rounded p-2 bg-white"
                >
                  <div className="text-[16px] font-medium">
                    {r.count}
                    <span className="ml-1 text-[11px] text-neutral-500">
                      ({((r.count / total) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-500">
                    {r.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-2">
              Recent — last 30
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 font-medium">When</th>
                    <th className="px-2 py-1.5 font-medium">Stage</th>
                    <th className="px-2 py-1.5 font-medium">Kind</th>
                    <th className="px-2 py-1.5 font-medium">Family</th>
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {fmtDateTime(r.createdAt)}
                      </td>
                      <td className="px-2 py-1.5 text-neutral-600">
                        {r.stage}
                      </td>
                      <td className="px-2 py-1.5 text-neutral-600 font-mono text-[11px]">
                        {r.kind}
                      </td>
                      <td className="px-2 py-1.5 text-neutral-600">
                        {r.family ?? '—'}
                      </td>
                      <td className="px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5">
                        <PracticeStatusChip status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Section({
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
      <h2 className="text-[16px] font-medium mb-1">{title}</h2>
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

function Meta({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">
        {k}
      </div>
      <div className={warn ? 'text-red-700 font-medium' : 'text-neutral-800'}>
        {v}
      </div>
    </div>
  );
}

function MetaSmall({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-500">
        {k}
      </div>
      <div className="text-[12px] text-neutral-800">{v}</div>
    </div>
  );
}

function SafetyChip({ flag }: { flag: string }) {
  const styles: Record<string, string> = {
    none: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    watch: 'bg-amber-50 text-amber-800 border-amber-200',
    red_flag: 'bg-red-50 text-red-800 border-red-200',
  };
  return (
    <span
      className={`text-[11px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${
        styles[flag] ?? styles.none
      }`}
    >
      {flag}
    </span>
  );
}

function ActiveChip({ active }: { active: boolean }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${
        active
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-neutral-50 text-neutral-600 border-neutral-200'
      }`}
    >
      {active ? 'active' : 'resolved'}
    </span>
  );
}

function PracticeStatusChip({ status }: { status: string }) {
  const good = status === 'completed';
  const abort = status.startsWith('aborted_');
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border whitespace-nowrap ${
        good
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : abort
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-neutral-50 text-neutral-600 border-neutral-200'
      }`}
    >
      {status}
    </span>
  );
}

function shortLabel(full: string): string {
  const map: Record<string, string> = {
    'Understand why I react': 'Und.',
    'Notice before it takes over': 'Not.',
    'Able to choose a different response': 'Ch.',
    'Hard on myself': 'Hard',
    'Affects daily life': 'Aff.',
    Stuck: 'Stuck',
  };
  return map[full] ?? full.slice(0, 6);
}
