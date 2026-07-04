// Load the Journey state for a user. Decrypts all user-words fields in-memory.
// Returns null if the user has not started The Journey yet.

import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';
import type {
  JourneyState,
  JourneyChannel,
  JourneyDepth,
  JourneyPart,
  JourneyForeignFile,
  JourneySignatureImage,
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

  const [partsRows, foreignFilesRows, signatureImagesRows, recentTurns] =
    await Promise.all([
      prisma.journeyPart.findMany({ where: { userId, active: true } }),
      prisma.journeyForeignFile.findMany({ where: { userId } }),
      prisma.journeySignatureImage.findMany({ where: { userId } }),
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

  const continuity = deriveContinuitySignals(progress.currentStage, recentTurns);

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
    sessionCount: continuity.sessionCount,
    daysEngaged: continuity.daysEngaged,
    thisSessionMessageCount: continuity.thisSessionMessageCount,
    stageJustAdvanced: continuity.stageJustAdvanced,
    hoursSinceLastTurn: continuity.hoursSinceLastTurn,
    isSessionResume: continuity.isSessionResume,
  };
}
