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

export async function loadJourneyState(userId: string): Promise<JourneyState | null> {
  const progress = await prisma.recodeProgress.findUnique({ where: { userId } });
  if (!progress) return null;

  const [partsRows, foreignFilesRows, signatureImagesRows] = await Promise.all([
    prisma.journeyPart.findMany({ where: { userId, active: true } }),
    prisma.journeyForeignFile.findMany({ where: { userId } }),
    prisma.journeySignatureImage.findMany({ where: { userId } }),
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
  };
}
