// Apply a parsed state report's findings to the persistent landscape.
// Encrypts all user-words fields on write. Idempotent where it can be.
// Anchor is set-once and never overwritten (Shared Core §6).

import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encrypt';
import type { JourneyChannel, MiiState } from './types';
import type { StateReport } from '../stateReport/schema';

type Updates = {
  // Anchor capture (Stage 1 — set once, never overwritten)
  anchorIdentified?: string;
  // Identity Anchor capture (Stage 6 — added alongside, not replacing the original)
  identityAnchor?: string;
  // Channel detection / refinement
  processingChannel?: JourneyChannel | null;
  // Adult Self qualities (Stage 3+)
  adultSelfQualities?: string;
  // Operational metadata
  lastIntensity?: number | null;
  recommendedDepth?: 'surface' | 'middle' | 'deep';
  // Deep Layer settling-time signal (Stage 4 / Stage 5)
  deepLayerContact?: boolean;
  // Rolling continuity note for the next session
  continuityNote?: string;
  // MII updates (partial — merged into existing mii JSON)
  miiPatch?: Partial<MiiState>;
  // Frozen-for-review (Red Flag)
  frozen?: { reason: string };
};

export async function applyStateReportToProgress(
  userId: string,
  report: StateReport,
): Promise<void> {
  const updates: Updates = {};

  if (report.anchorIdentified) updates.anchorIdentified = report.anchorIdentified;
  if (report.identityAnchor) updates.identityAnchor = report.identityAnchor;
  if (report.channel) updates.processingChannel = report.channel;
  if (report.adultSelfQualities) updates.adultSelfQualities = report.adultSelfQualities;
  if (typeof report.intensity === 'number') updates.lastIntensity = report.intensity;
  if (report.continuityNote) updates.continuityNote = report.continuityNote;
  if (report.practiceRun?.depth === 'deep') updates.deepLayerContact = true;
  if (report.safetyFlag === 'red_flag') {
    updates.frozen = { reason: report.redFlagType ?? 'unspecified' };
  }

  await applyUpdates(userId, updates);
  await applyLandscapeAdditions(userId, report);
}

async function applyUpdates(userId: string, u: Updates): Promise<void> {
  // Read current state so we can: (a) not overwrite the anchor once set,
  // (b) merge the MII patch into the existing JSON.
  const current = await prisma.recodeProgress.findUnique({
    where: { userId },
    select: {
      anchorTextEncrypted: true,
      mii: true,
    },
  });
  if (!current) return; // start endpoint must have been called first

  const data: Record<string, unknown> = {
    lastActivityAt: new Date(),
  };

  // Anchor is set-once. If already present, do nothing.
  if (u.anchorIdentified && !current.anchorTextEncrypted) {
    data.anchorTextEncrypted = encrypt(u.anchorIdentified);
    data.anchorSetAt = new Date();
  }
  if (u.identityAnchor) {
    data.identityAnchorEncrypted = encrypt(u.identityAnchor);
    data.identityAnchorSetAt = new Date();
  }
  if (u.processingChannel) data.processingChannel = u.processingChannel;
  if (u.adultSelfQualities) data.adultSelfQualitiesEncrypted = encrypt(u.adultSelfQualities);
  if (typeof u.lastIntensity === 'number') {
    data.lastIntensity = u.lastIntensity;
    data.lastIntensityAt = new Date();
  }
  if (u.recommendedDepth) data.currentDepth = u.recommendedDepth;
  if (u.deepLayerContact) data.lastDeepLayerContactAt = new Date();
  if (u.continuityNote) data.continuityNoteEncrypted = encrypt(u.continuityNote);

  if (u.miiPatch) {
    const merged = { ...(current.mii as MiiState), ...u.miiPatch };
    data.mii = merged;
  }

  if (u.frozen) {
    data.frozenForReview = true;
    data.frozenAt = new Date();
    data.frozenReason = u.frozen.reason;
  }

  await prisma.recodeProgress.update({
    where: { userId },
    data,
  });
}

async function applyLandscapeAdditions(userId: string, report: StateReport): Promise<void> {
  // Parts touched — insert new parts as JourneyPart rows.
  // For Slice 1: simple insert-if-new policy (no dedup yet — that comes when
  // we have a stable identity for parts across turns, in a later slice).
  if (report.partsTouched && report.partsTouched.length > 0) {
    for (const p of report.partsTouched) {
      if (!p.description) continue;
      await prisma.journeyPart.create({
        data: {
          userId,
          userDescriptionEncrypted: encrypt(p.description),
          channel: p.channel ?? null,
          safeDistanceEncrypted: p.safeDistance ? encrypt(p.safeDistance) : null,
        },
      });
    }
  }

  // Foreign files touched — insert as JourneyForeignFile rows.
  if (report.foreignFilesTouched && report.foreignFilesTouched.length > 0) {
    for (const f of report.foreignFilesTouched) {
      if (!f.description) continue;
      await prisma.journeyForeignFile.create({
        data: {
          userId,
          userDescriptionEncrypted: encrypt(f.description),
          identifiedAt: new Date(),
        },
      });
    }
  }

  // Signature images discovered.
  if (report.userImagesCaptured && report.userImagesCaptured.length > 0) {
    for (const img of report.userImagesCaptured) {
      if (!img) continue;
      await prisma.journeySignatureImage.create({
        data: {
          userId,
          userDescriptionEncrypted: encrypt(img),
        },
      });
    }
  }
}
