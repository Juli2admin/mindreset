// Load the Journey state for a user. Decrypts all user-words fields in-memory.
// Returns null if the user has not started The Journey yet.

import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';
import { parseStateReport } from '../stateReport/parse';
import { normaliseClosureProcess } from '../closure/process';
import { MAX_MEASUREMENT_AGE_MS } from '../closure/measurement-age';
import type {
  ModalityRejected,
  PracticeRun,
  StateReport,
  TaskContract,
} from '../stateReport/schema';
import { getOnboardingAnswers } from '@/lib/platform/profile';
import type {
  JourneyState,
  JourneyChannel,
  JourneyDepth,
  JourneyPart,
  JourneyForeignFile,
  JourneySignatureImage,
  JourneyPattern,
  CompassionBridgeQuality,
  MiiState,
  SafetyFlag,
  ClinicalWorkingMemory,
  WorkingMemoryDelta,
  WorkingMemoryPractice,
  WorkingMemoryReading,
} from './types';

function decryptOrNull(v: string | null): string | null {
  if (v == null) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

// Journey P3 — parse a decrypted JSON column into a typed value; null on
// malformed content so a corrupt row degrades to "no contract yet".
function parseStoredJson<T>(v: string | null): T | null {
  if (v == null) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

// PR 5 / Bundle C — session boundary heuristic. Aligns with the
// 4-hour threshold delayedCheck/signal.ts already uses for the soft
// check-in trigger; the same threshold marks a new session.
//
// Defined in ./session-boundary.ts and re-exported here so every existing
// import site keeps working; see that file for why it had to move.
import { SESSION_BOUNDARY_MS } from './session-boundary';
export { SESSION_BOUNDARY_MS };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Clinician Working Memory bounds (2026-08-08). Structural caps, not
// heuristics: the projection is rebuilt from scratch every turn, so these
// fix its maximum size for a user on turn 10 and on turn 10,000 alike.
//
// MAX_WM_DELTAS (3)      — the only turn-count the methodology itself states
//                          is "the last 2-3 turns" (Sensitivity Layer Q2).
//                          Short on purpose: prior reasoning re-injected in
//                          volume hardens superseded hypotheses.
// MAX_WM_DELTA_CHARS (240) — the same slice already applied to
//                          openCycleDescription at the render site.
//
// Practices carry NO separate cap. The existing report window bounds them:
// at most one practiceRun per state report and at most `take: 10` reports,
// narrowed further by the current-session walk. A second number here would be
// an arbitrary one.
const MAX_WM_DELTAS = 3;
const MAX_WM_DELTA_CHARS = 240;

/**
 * Coarse AI-facing time bucket for "how long since the previous turn."
 * Kept coarse on purpose — precise deltas invite over-precision phrasing
 * from the model ("2 hours and 14 minutes ago"). Buckets are:
 *
 *   null              — first-ever turn (no prior turn to compare to)
 *   "just now"        — < 30 min
 *   "today"           — 30 min – 8 h
 *   "yesterday"       — 8 – 36 h
 *   "a few days ago"  — 2 – 7 d
 *   "last week"       — 7 – 14 d
 *   "a couple weeks ago" — 14 – 28 d
 *   "last month"      — 28 – 60 d
 *   "months ago"      — > 60 d
 *
 * These are internal strings the AI reads in the state block. The user
 * never sees them; the AI phrases its human reply naturally from them.
 */
export function formatTimeSinceLastTurnBucket(
  hours: number | null,
): string | null {
  if (hours == null) return null;
  if (hours < 0.5) return 'just now';
  if (hours < 8) return 'today';
  if (hours < 36) return 'yesterday';
  if (hours < 24 * 7) return 'a few days ago';
  if (hours < 24 * 14) return 'last week';
  if (hours < 24 * 28) return 'a couple weeks ago';
  if (hours < 24 * 60) return 'last month';
  return 'months ago';
}

/**
 * Derive continuity signals from the JourneyTurn audit log.
 * - sessionCount: 0 if no turns; otherwise 1 + count of gaps >= 4 hrs
 *   between consecutive turns.
 * - daysEngaged: count of distinct calendar dates (UTC) with any turn.
 * - thisSessionMessageCount: turns since the last session boundary
 *   (treats "now" as the start of the current session if the last turn
 *   was >= 4 hours ago, returning 0). Counts AI turns only — user
 *   messages haven't been written to JourneyTurn yet at the time
 *   loadJourneyState is called.
 * - stageJustAdvanced: true when the user's currentStage on
 *   RecodeProgress is greater than the most-recent JourneyTurn.stageAtTurn
 *   (i.e. code advanced the user since the last AI turn).
 * - hoursSinceLastTurn: fractional hours between now and the most recent
 *   JourneyTurn. null for a first-ever turn. Feeds the coarse-bucket
 *   string in the AI state block so the model can honour "you came back
 *   in 2 hours" vs "you came back in 2 months" instead of fabricating.
 * - isSessionResume: true when there is at least one prior turn AND the
 *   gap since it is >= SESSION_BOUNDARY_MS. Gates session-open
 *   behaviours (re-anchor before deeper work, staleness reconfirmation,
 *   etc.). False on first-ever turn — that's a start, not a resume.
 *
 * `now` is injected for deterministic testing.
 */
export function deriveContinuitySignals(
  currentStage: number,
  turns: { createdAt: Date; stageAtTurn: number }[],
  now: Date = new Date(),
): {
  sessionCount: number;
  daysEngaged: number;
  thisSessionMessageCount: number;
  stageJustAdvanced: boolean;
  hoursSinceLastTurn: number | null;
  isSessionResume: boolean;
} {
  if (turns.length === 0) {
    return {
      sessionCount: 0,
      daysEngaged: 0,
      thisSessionMessageCount: 0,
      stageJustAdvanced: false,
      hoursSinceLastTurn: null,
      isSessionResume: false,
    };
  }
  // Sort ascending (oldest first) for boundary scan.
  const sorted = [...turns].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  let sessionCount = 1;
  let thisSessionStartIdx = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].createdAt.getTime() - sorted[i - 1].createdAt.getTime();
    if (gap >= SESSION_BOUNDARY_MS) {
      sessionCount++;
      thisSessionStartIdx = i;
    }
  }
  const distinctDays = new Set<string>();
  for (const t of sorted) {
    distinctDays.add(t.createdAt.toISOString().slice(0, 10));
  }
  const thisSessionMessageCount = sorted.length - thisSessionStartIdx;
  const lastTurn = sorted[sorted.length - 1];
  const stageJustAdvanced = currentStage > lastTurn.stageAtTurn;

  const msSinceLastTurn = now.getTime() - lastTurn.createdAt.getTime();
  // Clock skew guard: if now is somehow before the last turn's timestamp
  // (server clock jitter, DB clock drift), report 0 instead of negative.
  const hoursSinceLastTurn = Math.max(0, msSinceLastTurn / HOUR_MS);
  const isSessionResume = msSinceLastTurn >= SESSION_BOUNDARY_MS;

  return {
    sessionCount,
    daysEngaged: distinctDays.size,
    thisSessionMessageCount,
    stageJustAdvanced,
    hoursSinceLastTurn,
    isSessionResume,
  };
}

export async function loadJourneyState(userId: string): Promise<JourneyState | null> {
  const progress = await prisma.recodeProgress.findUnique({ where: { userId } });
  if (!progress) return null;

  const [partsRows, foreignFilesRows, signatureImagesRows, patternsRows, recentTurns] =
    await Promise.all([
      // PR M1 (2026-07-18) — Journey memory redesign. Runtime caps on
      // captured landscape so long-running users don't drown the AI's
      // fresh reading in accumulated formulation. Full archive stays
      // in the DB; only what loads into the prompt is capped.
      //
      // Parts: 5 most-recently-touched. `updatedAt` DESC so a part met
      // in an old session but recently re-touched stays in view;
      // untouched-for-months parts drop out until the reader references
      // them again (which would re-touch and re-lift into the window).
      prisma.journeyPart.findMany({
        where: { userId, active: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      // Foreign files: 3 most-recent by identification date. Foreign
      // material is typically one-shot (identified, later released,
      // done); recency of identification is the right freshness signal.
      prisma.journeyForeignFile.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      // Signature images: 5 most-recent. Was previously unbounded — the
      // single biggest source of memory bloat on long-running users
      // (~2000 tokens on a 67-image user). Older images stay retrievable
      // via the Inspector.
      prisma.journeySignatureImage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Patterns: 5 most-recently-confirmed active unresolved patterns.
      // (Was 20 loaded / 10 rendered before PR M1.) A pattern that
      // hasn't been re-confirmed drops out of the window; the AI can
      // still capture it fresh if the user shows it today.
      prisma.journeyPattern.findMany({
        where: { userId, active: true },
        orderBy: { lastConfirmedAt: 'desc' },
        take: 5,
      }),
      // Pull all turn timestamps for this user — needed for sessionCount
      // and daysEngaged. Plain int column queries are cheap; this is the
      // simplest correct approach.
      prisma.journeyTurn.findMany({
        where: { userId },
        select: { createdAt: true, stageAtTurn: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

  const parts: JourneyPart[] = partsRows.map((p) => ({
    id: p.id,
    userDescription: decrypt(p.userDescriptionEncrypted),
    channel: (p.channel as JourneyChannel | null) ?? null,
    safeDistance: decryptOrNull(p.safeDistanceEncrypted),
    compassionBridgeQuality: (p.compassionBridgeQuality as CompassionBridgeQuality | null) ?? null,
    currentRestingPlace: decryptOrNull(p.currentRestingPlaceEncrypted),
    active: p.active,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  const foreignFiles: JourneyForeignFile[] = foreignFilesRows.map((f) => ({
    id: f.id,
    userDescription: decrypt(f.userDescriptionEncrypted),
    originDescription: decryptOrNull(f.originDescriptionEncrypted),
    returnedTo: decryptOrNull(f.returnedToEncrypted),
    honouringPhrase: decryptOrNull(f.honouringPhraseEncrypted),
    whatStaysAsMine: decryptOrNull(f.whatStaysAsMineEncrypted),
    identifiedAt: f.identifiedAt,
    releaseClaimedAt: f.releaseClaimedAt,
    releasedAt: f.releasedAt,
  }));

  const signatureImages: JourneySignatureImage[] = signatureImagesRows.map((s) => ({
    id: s.id,
    userDescription: decrypt(s.userDescriptionEncrypted),
    context: s.context,
    createdAt: s.createdAt,
  }));

  const nowMs = Date.now();
  const patterns: JourneyPattern[] = patternsRows.map((p) => {
    // Journey polish PR 6 — derive the days-since counter for the state
    // block. Math.max(0, ...) guards against clock skew (a lastConfirmedAt
    // in the "future" from the server's perspective would otherwise
    // yield a negative and read as freshly confirmed).
    const daysSinceLastConfirmed = Math.max(
      0,
      Math.floor((nowMs - p.lastConfirmedAt.getTime()) / DAY_MS),
    );
    return {
      id: p.id,
      category: p.category,
      userDescription: decrypt(p.userDescriptionEncrypted),
      firstObservedAt: p.firstObservedAt,
      lastConfirmedAt: p.lastConfirmedAt,
      active: p.active,
      context:
        p.context && typeof p.context === 'object' && !Array.isArray(p.context)
          ? (p.context as Record<string, unknown>)
          : null,
      daysSinceLastConfirmed,
    };
  });

  const continuity = deriveContinuitySignals(progress.currentStage, recentTurns);

  // Therapeutic Sensitivity Layer — PR α (2026-07-09). Derive session-
  // level signals from the AI's own recent state reports so they can be
  // rendered in the state block and shape the next reply. Cheap: same
  // decrypt-per-turn cost the router already pays via loadRecentTurns.
  // Bounded to the last 10 turns and to the CURRENT session — a cycle
  // that closed at end of a previous session should not carry forward.
  const sensitivity = await loadRecentSensitivitySignals(
    userId,
    continuity.isSessionResume,
  );

  return {
    userId: progress.userId,
    currentStage: progress.currentStage,
    currentDepth: progress.currentDepth as JourneyDepth,
    startedAt: progress.startedAt,
    lastActivityAt: progress.lastActivityAt,
    dischargedAt: progress.dischargedAt,
    anchorText: decryptOrNull(progress.anchorTextEncrypted),
    anchorSetAt: progress.anchorSetAt,
    identityAnchor: decryptOrNull(progress.identityAnchorEncrypted),
    identityAnchorSetAt: progress.identityAnchorSetAt,
    processingChannel: (progress.processingChannel as JourneyChannel | null) ?? null,
    adultSelfQualities: decryptOrNull(progress.adultSelfQualitiesEncrypted),
    lastIntensity: progress.lastIntensity,
    lastIntensityAt: progress.lastIntensityAt,
    lastDeepLayerContactAt: progress.lastDeepLayerContactAt,
    mii: (progress.mii as MiiState) ?? {},
    stage8WeeksElapsed: progress.stage8WeeksElapsed,
    frozenForReview: progress.frozenForReview,
    frozenAt: progress.frozenAt,
    frozenReason: progress.frozenReason,
    continuityNote: decryptOrNull(progress.continuityNoteEncrypted),
    parts,
    foreignFiles,
    signatureImages,
    patterns,
    sessionCount: continuity.sessionCount,
    daysEngaged: continuity.daysEngaged,
    thisSessionMessageCount: continuity.thisSessionMessageCount,
    stageJustAdvanced: continuity.stageJustAdvanced,
    hoursSinceLastTurn: continuity.hoursSinceLastTurn,
    isSessionResume: continuity.isSessionResume,
    hasOpenCycle: sensitivity.hasOpenCycle,
    openCycleDescription: sensitivity.openCycleDescription,
    sessionRejectedModalities: sensitivity.sessionRejectedModalities,
    recentChannelShift: sensitivity.recentChannelShift,
    // Clinician Working Memory — derived from the same recent reports the
    // signals above already read. See deriveWorkingMemory.
    workingMemory: sensitivity.workingMemory,
    taskContract: parseStoredJson<TaskContract>(
      decryptOrNull(progress.taskContractEncrypted),
    ),
    // Platform Step 3 part B (2026-07-20) — sign-up onboarding answers,
    // rendered only until the Journey's own task contract exists.
    onboardingAnswers: await getOnboardingAnswers(userId),
    // Activated Closure Phase 1 (2026-08-05) — server-owned process state,
    // read DIRECTLY from RecodeProgress. Never derived from cycleStatus,
    // cycleCanClose, hasOpenCycle, encrypted state reports or any other
    // model-generated history; the sensitivity signals above stay exactly as
    // they were and remain a separate, model-reported concern.
    closureProcess: normaliseClosureProcess({
      state: progress.closureProcessState,
      route: progress.closureRoute,
      enteredAt: progress.closureEnteredAt,
      transitionedAt: progress.closureTransitionedAt,
      roundCount: progress.closureRoundCount,
      completedAt: progress.closureCompletedAt,
      incompleteAt: progress.closureIncompleteAt,
      freezeInterruptedAt: progress.closureFreezeInterruptedAt,
      initialScore: progress.closureInitialScore,
      initialScoreAt: progress.closureInitialScoreAt,
      postScore: progress.closurePostScore,
      postScoreAt: progress.closurePostScoreAt,
    }),
  };
}

/**
 * Load recent JourneyTurn state reports and derive the Therapeutic
 * Sensitivity Layer session-level signals — PR α (2026-07-09).
 *
 * Signals returned:
 *   - hasOpenCycle: true if the most-recent cycleStatus in the current
 *     session was 'open' or 'closing' (not 'closed').
 *   - openCycleDescription: the clinicalRead from the turn where the
 *     open cycle was last observed. Passes narrative continuity across
 *     turns without needing a separate persistent field.
 *   - sessionRejectedModalities: accumulated modalityRejected values
 *     across the current session's turns, deduplicated.
 *   - recentChannelShift: true if any of the last 3 turns emitted
 *     channelShiftDetected: true. Signal to the AI that channel drift
 *     is in play.
 *
 * If this is a session resume (>=4h since last turn), we treat the
 * PREVIOUS session's cycle as implicitly closed — open cycles do not
 * carry across session boundaries. The AI reads the resume flag and
 * decides whether to re-open the material.
 */
/**
 * Pure derivation of sensitivity signals from a list of already-decoded
 * turn state reports (newest first). Exported for exhaustive unit
 * testing of the walk-back + edge cases (empty rows, single row, exact
 * boundary equality, isSessionResume, missing reports).
 *
 * `nowMs` is injected for determinism in tests.
 */
export type SensitivityInputRow = {
  createdAtMs: number;
  report: StateReportForSensitivity | null;
};

// Narrower shape of the state report — the fields the two pure derivations
// read. Keeps the helpers decoupled from the full StateReport type shape.
//
// BP-A (2026-08-08). This projection is where the clinician's own analytical
// output used to stop: the runtime decrypts and FULLY parses the last ten
// reports on the pre-LLM path, then kept four fields and dropped the rest.
// The additions below are read by deriveWorkingMemory. Every field is
// optional, so deriveSensitivitySignals and its tests are unaffected.
export type StateReportForSensitivity = {
  cycleStatus?: 'open' | 'closing' | 'closed';
  clinicalRead?: string;
  modalityRejected?: ModalityRejected[];
  channelShiftDetected?: boolean;
  // --- carried for the working-memory projection ---
  intensity?: number;
  safetyFlag?: SafetyFlag;
  practiceRun?: PracticeRun;
  presentingRequestStatus?: 'addressed' | 'parked' | 'unresolved';
  adultSelfPresent?: boolean;
  stabilityCheck?: StateReport['stabilityCheck'];
  distressIntensity?: StateReport['distressIntensity'];
  /** BP-D — true when this report's required three are parser defaults. */
  _defaultedReport?: true;
};

/**
 * Walk backwards from most-recent (rows are already newest-first), stopping at
 * the first row that would sit BEFORE a session boundary relative to the row
 * that follows it in the walk. Boundary rule matches the same
 * >=SESSION_BOUNDARY_MS threshold used everywhere else in the codebase.
 *
 * Extracted 2026-08-08 so the sensitivity signals and the working-memory
 * projection share ONE definition of "this session" rather than each keeping
 * their own copy. Behaviour is unchanged.
 */
function collectCurrentSessionRows(
  rows: SensitivityInputRow[],
  nowMs: number,
): SensitivityInputRow[] {
  const out: SensitivityInputRow[] = [];
  let prevMs = nowMs;
  for (const row of rows) {
    if (prevMs - row.createdAtMs >= SESSION_BOUNDARY_MS) break;
    out.push(row);
    prevMs = row.createdAtMs;
  }
  return out;
}

export function deriveSensitivitySignals(
  rows: SensitivityInputRow[],
  isSessionResume: boolean,
  nowMs: number,
): {
  hasOpenCycle: boolean;
  openCycleDescription: string | null;
  sessionRejectedModalities: ModalityRejected[];
  recentChannelShift: boolean;
} {
  const emptyResult = {
    hasOpenCycle: false,
    openCycleDescription: null as string | null,
    sessionRejectedModalities: [] as ModalityRejected[],
    recentChannelShift: false,
  };
  if (rows.length === 0) return emptyResult;

  // If this turn IS a session resume, the previous session's cycle is
  // treated as implicitly closed. The AI decides whether to re-open
  // anything on the fresh session.
  if (isSessionResume) return emptyResult;

  const currentSessionRows = collectCurrentSessionRows(rows, nowMs);

  let hasOpenCycle = false;
  let openCycleDescription: string | null = null;
  // The FIRST row with any cycleStatus (newest-first walk) is
  // authoritative — a subsequent 'closed' from a newer turn overrides
  // an older 'open'. This flag tracks whether we've resolved cycle
  // status at all yet, so older statuses can't override newer ones.
  let cycleStatusResolved = false;
  const rejectedSet = new Set<ModalityRejected>();
  let recentChannelShift = false;
  let shiftScanCount = 0;

  for (const row of currentSessionRows) {
    if (!row.report) continue;
    const r = row.report;
    if (!cycleStatusResolved && r.cycleStatus) {
      cycleStatusResolved = true;
      if (r.cycleStatus === 'open' || r.cycleStatus === 'closing') {
        hasOpenCycle = true;
        openCycleDescription = r.clinicalRead ?? null;
      }
    }
    if (r.modalityRejected) {
      for (const m of r.modalityRejected) {
        if (m !== 'none') rejectedSet.add(m);
      }
    }
    if (shiftScanCount < 3 && r.channelShiftDetected === true) {
      recentChannelShift = true;
    }
    shiftScanCount++;
  }

  return {
    hasOpenCycle,
    openCycleDescription,
    sessionRejectedModalities: Array.from(rejectedSet),
    recentChannelShift,
  };
}

/**
 * Clinician Working Memory — the clinician's own analytical output from
 * earlier turns in THIS session, projected back for the next reply.
 *
 * FACTS ONLY. Every value here either restates something the clinician itself
 * emitted, or is arithmetic over such values (a direction, a maximum, an age,
 * a count). This function performs no clinical reasoning and must never start:
 * "activation rose" is arithmetic, "the user is deteriorating" is a judgement;
 * "recorded as aborted_overwhelm" is a restatement, "the practice did not
 * help" is not in the data at all. The clinician remains the only interpreter.
 *
 * Absent stays absent. Nothing is inferred, defaulted or back-filled — if a
 * source is missing the member is null and the renderer omits it.
 *
 * Pure; `nowMs` injected. Same rows the sensitivity signals already walk, so
 * no extra query, decrypt, parse or model call. Recomputed every turn and
 * never persisted, so it cannot accumulate.
 *
 * `openCycleDescriptionInUse` is the clinicalRead already rendering inside the
 * open-cycle block; it is skipped here so the same text cannot appear twice.
 */
export function deriveWorkingMemory(
  rows: SensitivityInputRow[],
  isSessionResume: boolean,
  nowMs: number,
  openCycleDescriptionInUse: string | null,
): ClinicalWorkingMemory | null {
  if (rows.length === 0) return null;
  // A resume starts a new session: session-scoped memory is legitimately
  // empty. Same rule the sensitivity signals apply, for the same reason.
  if (isSessionResume) return null;

  const sessionRows = collectCurrentSessionRows(rows, nowMs);
  if (sessionRows.length === 0) return null;

  // BP-D — a report that was defaulted carries no measurement. Its intensity
  // and safetyFlag are OUR fail-safe values, not the clinician's reading, and
  // must not enter a trajectory or a safety history as though they were.
  const measured = sessionRows.filter(
    (r) => r.report && r.report._defaultedReport !== true,
  );

  // --- 1. Activation trajectory (oldest first) --------------------------
  const intensitiesNewestFirst = measured
    .map((r) => r.report?.intensity)
    .filter((v): v is number => typeof v === 'number');
  const readings = intensitiesNewestFirst.slice().reverse();
  let activation: ClinicalWorkingMemory['activation'] = null;
  if (readings.length >= 2) {
    const first = readings[0];
    const last = readings[readings.length - 1];
    activation = {
      readings,
      max: Math.max(...readings),
      direction: last > first ? 'rising' : last < first ? 'falling' : 'steady',
    };
  }

  // --- 2. Regulation / safety status ------------------------------------
  const flags = measured
    .map((r) => r.report?.safetyFlag)
    .filter((v): v is SafetyFlag => v === 'none' || v === 'watch' || v === 'red_flag');
  let safety: ClinicalWorkingMemory['safety'] = null;
  if (flags.length > 0) {
    const rank: Record<SafetyFlag, number> = { none: 0, watch: 1, red_flag: 2 };
    let worst: SafetyFlag = flags[0];
    for (const f of flags) if (rank[f] > rank[worst]) worst = f;
    safety = { current: flags[0], sessionWorst: worst };
  }

  // --- 3. Practices attempted this session ------------------------------
  const practices: WorkingMemoryPractice[] = [];
  for (const row of sessionRows) {
    const pr = row.report?.practiceRun;
    if (!pr || pr.kind === 'none') continue;
    practices.push({
      family: pr.family ?? null,
      name: pr.name ?? null,
      status: pr.status,
      modalitySwitched: pr.modalitySwitched ?? null,
    });
  }

  // --- 4. Provisional formulation deltas --------------------------------
  const formulationDeltas: WorkingMemoryDelta[] = [];
  for (let i = 0; i < sessionRows.length; i++) {
    const text = sessionRows[i].report?.clinicalRead?.trim();
    if (!text) continue;
    if (openCycleDescriptionInUse && text === openCycleDescriptionInUse.trim()) continue;
    formulationDeltas.push({ turnsAgo: i + 1, text: text.slice(0, MAX_WM_DELTA_CHARS) });
    if (formulationDeltas.length >= MAX_WM_DELTAS) break;
  }

  // --- 5-7. Newest recorded value wins ----------------------------------
  let requestStatus: ClinicalWorkingMemory['requestStatus'] = null;
  let cycleStatus: ClinicalWorkingMemory['cycleStatus'] = null;
  let adultSelf: ClinicalWorkingMemory['adultSelf'] = null;
  for (let i = 0; i < sessionRows.length; i++) {
    const r = sessionRows[i].report;
    if (!r) continue;
    if (requestStatus === null && r.presentingRequestStatus) {
      requestStatus = r.presentingRequestStatus;
    }
    if (cycleStatus === null && r.cycleStatus) cycleStatus = r.cycleStatus;
    if (adultSelf === null && typeof r.adultSelfPresent === 'boolean') {
      adultSelf = { present: r.adultSelfPresent, turnsAgo: i + 1 };
    }
  }

  // --- 8. Fresh grounding readings, provenance intact -------------------
  const stability = firstFreshReading(
    sessionRows,
    nowMs,
    (r) => r.stabilityCheck,
    true,
  );
  const distress = firstFreshReading(
    sessionRows,
    nowMs,
    (r) => r.distressIntensity,
    false,
  );

  const empty =
    activation === null &&
    safety === null &&
    practices.length === 0 &&
    formulationDeltas.length === 0 &&
    requestStatus === null &&
    cycleStatus === null &&
    adultSelf === null &&
    stability === null &&
    distress === null;
  if (empty) return null;

  return {
    activation,
    safety,
    practices,
    formulationDeltas,
    requestStatus,
    cycleStatus,
    adultSelf,
    stability,
    distress,
  };
}

/**
 * Newest measurement whose SERVER-STAMPED `observedAt` is still within
 * MAX_MEASUREMENT_AGE_MS. A reading past that bound is dropped outright rather
 * than shown as stale — the closure guard applies the same threshold to the
 * same field, so freshness has one meaning in the runtime.
 *
 * `observedAt` is used deliberately, never the model-supplied `measuredAt`.
 * `scale` and `source` travel with the number because a score without them
 * cannot be read as a stability reading (Repair 1).
 */
function firstFreshReading(
  sessionRows: SensitivityInputRow[],
  nowMs: number,
  pick: (
    r: NonNullable<SensitivityInputRow['report']>,
  ) => { score: number; scale?: string; source?: string; observedAt?: string } | undefined,
  carryScale: boolean,
): WorkingMemoryReading | null {
  for (const row of sessionRows) {
    if (!row.report) continue;
    const m = pick(row.report);
    if (!m || typeof m.score !== 'number' || !m.observedAt) continue;
    const observedMs = Date.parse(m.observedAt);
    if (Number.isNaN(observedMs)) continue;
    const ageMs = nowMs - observedMs;
    if (ageMs < 0 || ageMs > MAX_MEASUREMENT_AGE_MS) continue;
    return {
      score: m.score,
      scale: carryScale
        ? m.scale === 'stability' || m.scale === 'ambiguous'
          ? m.scale
          : 'ambiguous'
        : null,
      source: m.source ?? null,
      ageMinutes: Math.floor(ageMs / 60000),
    };
  }
  return null;
}

async function loadRecentSensitivitySignals(
  userId: string,
  isSessionResume: boolean,
): Promise<{
  hasOpenCycle: boolean;
  openCycleDescription: string | null;
  sessionRejectedModalities: ModalityRejected[];
  recentChannelShift: boolean;
  workingMemory: ClinicalWorkingMemory | null;
}> {
  const rows = await prisma.journeyTurn.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, stateReportEncrypted: true },
  });
  const inputRows: SensitivityInputRow[] = rows.map((row) => {
    let report: StateReportForSensitivity | null = null;
    if (row.stateReportEncrypted) {
      try {
        const full = parseStateReport(decrypt(row.stateReportEncrypted));
        report = {
          cycleStatus: full.cycleStatus,
          clinicalRead: full.clinicalRead,
          modalityRejected: full.modalityRejected,
          channelShiftDetected: full.channelShiftDetected,
          // BP-A — the parse above already produced all of these; they used to
          // be dropped here.
          intensity: full.intensity,
          safetyFlag: full.safetyFlag,
          practiceRun: full.practiceRun,
          presentingRequestStatus: full.presentingRequestStatus,
          adultSelfPresent: full.adultSelfPresent,
          stabilityCheck: full.stabilityCheck,
          distressIntensity: full.distressIntensity,
          _defaultedReport: full._defaultedReport,
        };
      } catch {
        // decrypt / parse failure — leave null so the pure helpers
        // treat the row as unusable.
      }
    }
    return { createdAtMs: row.createdAt.getTime(), report };
  });
  const nowMs = Date.now();
  const signals = deriveSensitivitySignals(inputRows, isSessionResume, nowMs);
  return {
    ...signals,
    workingMemory: deriveWorkingMemory(
      inputRows,
      isSessionResume,
      nowMs,
      signals.openCycleDescription,
    ),
  };
}
