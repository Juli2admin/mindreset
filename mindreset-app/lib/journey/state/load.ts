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
const SESSION_BOUNDARY_MS = 4 * 60 * 60 * 1000;

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
 */
function deriveContinuitySignals(
  currentStage: number,
  turns: { createdAt: Date; stageAtTurn: number }[],
): {
  sessionCount: number;
  daysEngaged: number;
  thisSessionMessageCount: number;
  stageJustAdvanced: boolean;
} {
  if (turns.length === 0) {
    return {
      sessionCount: 0,
      daysEngaged: 0,
      thisSessionMessageCount: 0,
      stageJustAdvanced: false,
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
  const lastTurnStage = sorted[sorted.length - 1].stageAtTurn;
  const stageJustAdvanced = currentStage > lastTurnStage;
  return {
    sessionCount,
    daysEngaged: distinctDays.size,
    thisSessionMessageCount,
    stageJustAdvanced,
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
  };
}
