// Load the Journey state for a user. Decrypts all user-words fields in-memory.
// Returns null if the user has not started The Journey yet.

import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';
import { parseStateReport } from '../stateReport/parse';
import type { ModalityRejected } from '../stateReport/schema';
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
} from './types';

function decryptOrNull(v: string | null): string | null {
  if (v == null) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

// PR 5 / Bundle C — session boundary heuristic. Aligns with the
// 4-hour threshold delayedCheck/signal.ts already uses for the soft
// check-in trigger; the same threshold marks a new session.
export const SESSION_BOUNDARY_MS = 4 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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
      prisma.journeyPart.findMany({ where: { userId, active: true } }),
      prisma.journeyForeignFile.findMany({ where: { userId } }),
      prisma.journeySignatureImage.findMany({ where: { userId } }),
      // Journey polish PR 5 — active unresolved patterns, most-recently
      // confirmed first. Cap load to the top 20 so a long-term user with
      // many patterns doesn't bloat the state block. State rendering
      // caps further based on the prompt's token budget.
      prisma.journeyPattern.findMany({
        where: { userId, active: true },
        orderBy: { lastConfirmedAt: 'desc' },
        take: 20,
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
async function loadRecentSensitivitySignals(
  userId: string,
  isSessionResume: boolean,
): Promise<{
  hasOpenCycle: boolean;
  openCycleDescription: string | null;
  sessionRejectedModalities: ModalityRejected[];
  recentChannelShift: boolean;
}> {
  const rows = await prisma.journeyTurn.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, stateReportEncrypted: true },
  });
  if (rows.length === 0) {
    return {
      hasOpenCycle: false,
      openCycleDescription: null,
      sessionRejectedModalities: [],
      recentChannelShift: false,
    };
  }
  // Walk backwards from most-recent, stopping at the first session
  // boundary (>=4h gap since the previous row). Everything inside that
  // range is "the current session."
  const nowMs = Date.now();
  const currentSessionRows: typeof rows = [];
  let prevMs = nowMs;
  for (const row of rows) {
    const rowMs = row.createdAt.getTime();
    if (prevMs - rowMs >= SESSION_BOUNDARY_MS) break;
    currentSessionRows.push(row);
    prevMs = rowMs;
  }
  // If the current turn IS a session resume, treat this session as
  // empty — the AI decides whether to reopen anything.
  const scanRows = isSessionResume ? [] : currentSessionRows;

  let hasOpenCycle = false;
  let openCycleDescription: string | null = null;
  const rejectedSet = new Set<ModalityRejected>();
  let recentChannelShift = false;
  let shiftScanCount = 0;

  for (const row of scanRows) {
    if (!row.stateReportEncrypted) continue;
    let report;
    try {
      report = parseStateReport(decrypt(row.stateReportEncrypted));
    } catch {
      continue;
    }
    // Most-recent cycleStatus wins (scanRows is newest-first).
    if (!hasOpenCycle && report.cycleStatus) {
      if (report.cycleStatus === 'open' || report.cycleStatus === 'closing') {
        hasOpenCycle = true;
        openCycleDescription = report.clinicalRead ?? null;
      }
    }
    if (report.modalityRejected) {
      for (const m of report.modalityRejected) {
        if (m !== 'none') rejectedSet.add(m);
      }
    }
    if (shiftScanCount < 3 && report.channelShiftDetected === true) {
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
