import Link from 'next/link';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';

// /admin/journey-inspect — decrypt and show the AI's per-turn state reports
// for a chosen user. Diagnostic surface for clinical review: shows exactly
// what the AI emitted (readinessTouched tokens, practiceRun events,
// stabilityCheck, clinicalRead, stage-specific captures) — ground truth
// that plain SQL can't reveal because the state report is encrypted at rest.
//
// Query params:
//   ?email=jloya4436@gmail.com      # which user to inspect (default: Julia's test email)
//   ?limit=10                       # how many turns (default 5, max 50)
//   ?before=2026-07-11T06:15:00Z    # optional — load the N turns immediately BEFORE this UTC timestamp.
//                                    Use when you need a historic window (e.g. an old red_flag)
//                                    that's out of reach of the default "most-recent N" view.
//   ?raw=1                          # show full raw JSON per turn (default: summary)
//
// Admin-gated by the parent /admin layout.

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function pickParam(p: SearchParams, k: string): string | undefined {
  const v = p[k];
  return Array.isArray(v) ? v[0] : v;
}

// Accept ISO-8601 (with or without trailing Z, with or without seconds).
// Returns null if the input can't be parsed as a real Date — callers treat
// null as "no cursor set" rather than failing the whole page render.
function parseBefore(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function truncate(s: unknown, max = 240): string {
  if (typeof s !== 'string') return String(s);
  return s.length > max ? s.slice(0, max) + `… (${s.length} chars)` : s;
}

function tryDecrypt(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return '[decrypt failed]';
  }
}

type StateReport = Record<string, unknown>;

function safeParse(json: string | null): StateReport | { _error: string } | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as StateReport;
  } catch (e) {
    return { _error: `unparseable: ${(e as Error).message}` };
  }
}

export default async function JourneyInspectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const email = pickParam(searchParams, 'email') ?? 'jloya4436@gmail.com';
  const limit = Math.max(1, Math.min(50, parseInt(pickParam(searchParams, 'limit') ?? '5', 10)));
  const raw = pickParam(searchParams, 'raw') === '1';
  const beforeRaw = pickParam(searchParams, 'before') ?? '';
  const beforeDate = parseBefore(beforeRaw);
  // Preserve the user's raw input in the form even if it didn't parse — they
  // may be mid-edit. Only the resolved Date is used for the DB filter.
  const beforeInvalid = beforeRaw.length > 0 && beforeDate === null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return (
      <div className="max-w-4xl">
        <PageHeader />
        <div className="border border-red-200 bg-red-50 rounded-lg p-5 text-red-800">
          No user found for <code className="font-mono">{email}</code>. Check the email and try again.
        </div>
        <SearchForm email={email} limit={limit} raw={raw} before={beforeRaw} beforeInvalid={beforeInvalid} />
      </div>
    );
  }

  const [progress, turns] = await Promise.all([
    prisma.recodeProgress.findUnique({ where: { userId: user.id } }),
    prisma.journeyTurn.findMany({
      where: {
        userId: user.id,
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        stageAtTurn: true,
        depthAtTurn: true,
        intensityReported: true,
        safetyFlag: true,
        redFlagType: true,
        recommendedAction: true,
        stateReportEncrypted: true,
      },
    }),
  ]);

  const turnsOldestFirst = [...turns].reverse();

  return (
    <div className="max-w-5xl">
      <PageHeader />
      <SearchForm email={email} limit={limit} raw={raw} before={beforeRaw} beforeInvalid={beforeInvalid} />

      <div className="mb-4 text-[13px] text-neutral-600">
        userId: <code className="font-mono text-neutral-800">{user.id}</code>
        {' · '}
        {turns.length} turn{turns.length === 1 ? '' : 's'} shown (limit {limit})
        {beforeDate && (
          <>
            {' · '}before <code className="font-mono text-neutral-800">{beforeDate.toISOString()}</code>
          </>
        )}
      </div>

      {progress && (
        <section className="border border-neutral-200 rounded-lg p-5 bg-white mb-6">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            Current state (RecodeProgress)
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] font-mono">
            <Row k="currentStage" v={progress.currentStage} />
            <Row k="currentDepth" v={progress.currentDepth} />
            <Row k="processingChannel" v={progress.processingChannel ?? '-'} />
            <Row k="lastIntensity" v={progress.lastIntensity ?? '-'} />
            <Row k="frozenForReview" v={String(progress.frozenForReview)} />
            <Row k="anchorText" v={truncate(tryDecrypt(progress.anchorTextEncrypted) ?? '- (not set)')} />
            <Row k="anchorSetAt" v={progress.anchorSetAt?.toISOString() ?? '-'} />
            <Row k="identityAnchor" v={truncate(tryDecrypt(progress.identityAnchorEncrypted) ?? '- (not set)')} />
            <Row k="adultSelfQualities" v={truncate(tryDecrypt(progress.adultSelfQualitiesEncrypted) ?? '- (not set)')} />
            <Row k="continuityNote" v={truncate(tryDecrypt(progress.continuityNoteEncrypted) ?? '- (not set)', 800)} span={2} />
            <Row k="mii" v={truncate(JSON.stringify(progress.mii))} span={2} />
            {/* Journey remediation 2026-07-19 — stored task contract +
                durable working preferences (observability, Phase 10). */}
            <Row k="taskContract" v={truncate(tryDecrypt(progress.taskContractEncrypted) ?? '- (not captured)', 800)} span={2} />
            <Row k="workingPreferences" v={truncate(tryDecrypt(progress.workingPreferencesEncrypted) ?? '- (none)', 800)} span={2} />
          </dl>
        </section>
      )}

      <h2 className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
        Turn-by-turn (oldest first)
      </h2>

      <div className="space-y-4">
        {turnsOldestFirst.length === 0 && (
          <div className="border border-neutral-200 rounded-lg p-5 bg-white text-neutral-600">
            No turns yet.
          </div>
        )}
        {turnsOldestFirst.map((t) => {
          const plaintext = tryDecrypt(t.stateReportEncrypted);
          const sr = safeParse(plaintext);
          const isError = sr && '_error' in sr;
          const report = !isError ? (sr as StateReport | null) : null;

          return (
            <article key={t.id} className="border border-neutral-200 rounded-lg p-5 bg-white">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <div className="text-[13px] font-mono text-neutral-500">
                  {t.createdAt.toISOString()}
                </div>
                <div className="text-[12px] text-neutral-500">
                  stage {t.stageAtTurn}/{t.depthAtTurn}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-[13px] font-mono mb-3">
                <StatChip label="intensity" value={String(t.intensityReported ?? '-')} />
                <StatChip
                  label="safety"
                  value={`${t.safetyFlag}${t.redFlagType ? ` (${t.redFlagType})` : ''}`}
                  warn={t.safetyFlag !== 'none'}
                />
                <StatChip
                  label="rec. action"
                  value={t.recommendedAction ?? '-'}
                  warn={t.recommendedAction === 'advance' || t.recommendedAction === 'discharge'}
                />
              </div>

              {isError && (
                <div className="text-[13px] text-red-700 font-mono">{(sr as { _error: string })._error}</div>
              )}

              {report && raw && (
                <pre className="text-[12px] font-mono bg-neutral-50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(report, null, 2)}
                </pre>
              )}

              {report && !raw && <StateSummary sr={report} />}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <>
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Journey Inspector
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Ground truth from the AI&apos;s state reports</h1>
    </>
  );
}

function SearchForm({
  email,
  limit,
  raw,
  before,
  beforeInvalid,
}: {
  email: string;
  limit: number;
  raw: boolean;
  before: string;
  beforeInvalid: boolean;
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap gap-3 items-end mb-6 border border-neutral-200 rounded-lg p-4 bg-white"
    >
      <label className="flex-1 min-w-[240px]">
        <span className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
          User email
        </span>
        <input
          name="email"
          defaultValue={email}
          className="w-full border border-neutral-300 rounded px-3 py-2 text-[13px] font-mono"
        />
      </label>
      <label>
        <span className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
          Turns
        </span>
        <input
          name="limit"
          type="number"
          min={1}
          max={50}
          defaultValue={limit}
          className="w-20 border border-neutral-300 rounded px-3 py-2 text-[13px] font-mono"
        />
      </label>
      <label className="min-w-[240px]">
        <span className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
          Before (UTC, optional)
        </span>
        <input
          name="before"
          placeholder="2026-07-11T06:15:00Z"
          defaultValue={before}
          className={
            'w-full border rounded px-3 py-2 text-[13px] font-mono ' +
            (beforeInvalid ? 'border-red-400 bg-red-50 text-red-900' : 'border-neutral-300')
          }
          title="ISO-8601 UTC timestamp. Loads the N turns immediately before this moment."
        />
        {beforeInvalid && (
          <span className="block text-[11px] text-red-700 mt-1">
            couldn&apos;t parse — expected ISO-8601 (e.g. 2026-07-11T06:15:00Z)
          </span>
        )}
      </label>
      <label className="flex items-center gap-2 pb-2">
        <input type="checkbox" name="raw" value="1" defaultChecked={raw} />
        <span className="text-[13px]">Raw JSON</span>
      </label>
      <button
        type="submit"
        className="px-4 py-2 bg-neutral-900 text-white text-[13px] rounded hover:bg-neutral-700"
      >
        Load
      </button>
    </form>
  );
}

function Row({ k, v, span = 1 }: { k: string; v: unknown; span?: number }) {
  const spanCls = span === 2 ? 'col-span-2' : '';
  return (
    <div className={spanCls}>
      <dt className="text-neutral-500 text-[11px] uppercase tracking-[0.12em]">{k}</dt>
      <dd className="text-neutral-800 break-words">{String(v)}</dd>
    </div>
  );
}

function StatChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={
        'px-3 py-2 rounded border text-[13px] ' +
        (warn ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-neutral-200 bg-neutral-50 text-neutral-800')
      }
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500 mb-0.5">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

// Fields we surface prominently — the ones that matter for clinical review
// and gate reasoning.
const CAPTURE_FIELDS = [
  'anchorIdentified',
  'identityAnchor',
  'observerSeatTouched',
  'adultSelfQualities',
  'adultSelfAnchorLinked',
  'heldEmotionInAdultSelf',
  'partSecured',
  'foreignFileReleased',
  'compassionBridgeQuality',
  'bridgeAchievedAt',
  'userGrounded',
  'cohesionAwareness',
  'mii6Check',
  'originIdentified',
  'somaticRelease',
  'bodyConfirmation',
  'cleanIdentityStatement',
  'whatStaysAsMine',
  'internalConsensus',
  'selfLoyaltyStatement',
  'oneSmallAction',
  'symbolicIdentityMap',
  'emergingQualities',
  'innerDirection',
  'urgencyMarkers',
  'safetyReorientation',
  'calRunOn',
  'calLayer',
  'userReportedRedirection',
  'adultSelfThisWeek',
  'feltAligned',
  'feltOld',
  'dischargeReadiness',
  'userImagesCaptured',
  'partsTouched',
  'foreignFilesTouched',
  // Journey remediation 2026-07-19 — task contract, durable preferences,
  // release semantics, and sensitivity-layer routing fields (Phase 10
  // observability). Rendered as JSON in "captures set" when emitted.
  'taskContract',
  'workingPreferenceNoted',
  'workingPreferenceCleared',
  'releaseConfirmed',
  'releaseInvalidated',
  'therapeuticMode',
  'nextBestMode',
  'cycleStatus',
  'cycleCanClose',
  'modalityRejected',
  'channelShiftDetected',
];

function StateSummary({ sr }: { sr: StateReport }) {
  const readinessTouched = Array.isArray(sr.readinessTouched)
    ? (sr.readinessTouched as string[])
    : [];
  const practice = sr.practiceRun as
    | {
        kind?: string;
        name?: string;
        family?: string;
        status?: string;
        depth?: string;
        triggeredBy?: string;
        userImages?: string;
        outcome?: string;
      }
    | undefined;
  const stability = sr.stabilityCheck as
    | { score?: number; contextNote?: string }
    | undefined;
  // Journey polish PR 4a + PR 5 fields. Both are dedicated inspector rows
  // so we can see at a glance whether the LLM adopted the vocabulary on
  // a given turn — the "not emitted" state is the diagnostic answer.
  const moveJustPerformed = Array.isArray(sr.moveJustPerformed)
    ? (sr.moveJustPerformed as string[])
    : [];
  const patternsTouched = Array.isArray(sr.patternsTouched)
    ? (sr.patternsTouched as Array<{
        category: string;
        description: string;
        context?: Record<string, unknown>;
      }>)
    : [];

  const setCaptures = CAPTURE_FIELDS.filter((k) => {
    const v = sr[k];
    if (v === undefined || v === null) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  return (
    <div className="space-y-2 text-[13px]">
      <SumRow k="channel" v={sr.channel} />
      <SumRow k="adultSelfPresent" v={sr.adultSelfPresent} />
      <div>
        <span className="inline-block w-40 text-neutral-500 text-[11px] uppercase tracking-[0.12em] align-top">
          readinessTouched
        </span>
        {readinessTouched.length === 0 ? (
          <span className="font-mono text-neutral-500">- (empty)</span>
        ) : (
          <span className="inline-flex flex-wrap gap-1">
            {readinessTouched.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono text-[12px]"
              >
                {t}
              </span>
            ))}
          </span>
        )}
      </div>

      <div>
        <span className="inline-block w-40 text-neutral-500 text-[11px] uppercase tracking-[0.12em] align-top">
          practiceRun
        </span>
        {!practice || practice.kind === 'none' || !practice.kind ? (
          <span className="font-mono text-neutral-500">
            - (kind: {practice?.kind ?? 'not emitted'})
          </span>
        ) : (
          <span className="font-mono">
            {practice.kind}/{practice.family ?? '-'} &quot;{practice.name ?? '-'}&quot; status={practice.status ?? '-'}
            {practice.outcome ? ` outcome=${practice.outcome}` : ''}
            {practice.depth ? ` depth=${practice.depth}` : ''}
            {practice.triggeredBy ? ` · triggeredBy: ${practice.triggeredBy}` : ''}
            {practice.userImages ? ` · userImages: ${truncate(practice.userImages)}` : ''}
          </span>
        )}
      </div>

      {/* Journey polish PR 4a — canonical clinical-move naming. Rendered
          on its own row (not folded into the captures list) so we can
          see at a glance which turns did emit and which did not. That's
          exactly the diagnostic question during the pilot: is the LLM
          adopting the vocabulary?  */}
      <div>
        <span className="inline-block w-40 text-neutral-500 text-[11px] uppercase tracking-[0.12em] align-top">
          moveJustPerformed
        </span>
        {moveJustPerformed.length === 0 ? (
          <span className="font-mono text-neutral-500">- (not emitted)</span>
        ) : (
          <span className="inline-flex flex-wrap gap-1">
            {moveJustPerformed.map((m, i) => (
              <span
                key={`${m}-${i}`}
                className={`px-2 py-0.5 rounded font-mono text-[12px] border ${
                  i === 0
                    ? 'bg-sky-100 border-sky-300 text-sky-900 font-semibold'
                    : 'bg-sky-50 border-sky-200 text-sky-800'
                }`}
                title={i === 0 ? 'primary move' : `secondary move #${i + 1}`}
              >
                {m}
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Journey polish PR 5 — structural pattern notes. Rendered on its
          own row for the same diagnostic reason. Shows category as chip
          + user's words + context inline. Empty state ("not emitted")
          tells us the LLM didn't reach for the vocabulary this turn. */}
      <div>
        <span className="inline-block w-40 text-neutral-500 text-[11px] uppercase tracking-[0.12em] align-top">
          patternsTouched
        </span>
        {patternsTouched.length === 0 ? (
          <span className="font-mono text-neutral-500">- (not emitted)</span>
        ) : (
          <div className="inline-block space-y-1">
            {patternsTouched.map((p, i) => (
              <div key={`${p.category}-${i}`} className="font-mono text-[12px]">
                <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900">
                  {p.category}
                </span>
                <span className="ml-2 text-neutral-800">
                  &quot;{truncate(p.description, 140)}&quot;
                </span>
                {p.context && Object.keys(p.context).length > 0 && (
                  <span className="ml-2 text-neutral-500">
                    {Object.entries(p.context)
                      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                      .join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {stability && (
        <SumRow
          k="stabilityCheck"
          v={`score=${stability.score} note="${stability.contextNote ?? '-'}"`}
        />
      )}

      {setCaptures.length > 0 && (
        <div>
          <div className="text-neutral-500 text-[11px] uppercase tracking-[0.12em] mb-1">
            captures set
          </div>
          <div className="space-y-1 font-mono text-[12px]">
            {setCaptures.map((k) => (
              <div key={k} className="grid grid-cols-[160px_1fr] gap-3">
                <span className="text-neutral-700">{k}</span>
                <span className="text-neutral-800 break-words">
                  {truncate(JSON.stringify(sr[k]))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {typeof sr.clinicalRead === 'string' && sr.clinicalRead.length > 0 && (
        <div>
          <div className="text-neutral-500 text-[11px] uppercase tracking-[0.12em] mb-1">
            clinicalRead
          </div>
          <div className="italic text-neutral-800 break-words">
            {truncate(sr.clinicalRead, 800)}
          </div>
        </div>
      )}

      {typeof sr.continuityNote === 'string' && sr.continuityNote.length > 0 && (
        <div>
          <div className="text-neutral-500 text-[11px] uppercase tracking-[0.12em] mb-1">
            continuityNote
          </div>
          <div className="text-neutral-800 break-words">
            {truncate(sr.continuityNote, 1200)}
          </div>
        </div>
      )}
    </div>
  );
}

function SumRow({ k, v }: { k: string; v: unknown }) {
  return (
    <div>
      <span className="inline-block w-40 text-neutral-500 text-[11px] uppercase tracking-[0.12em]">
        {k}
      </span>
      <span className="font-mono">{v === undefined ? '-' : String(v)}</span>
    </div>
  );
}

// Suppress unused import lint if Link isn't referenced.
void Link;
