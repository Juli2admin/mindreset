// Apply a parsed state report's findings to the persistent landscape.
// Encrypts all user-words fields on write. Idempotent where it can be.
// Anchor is set-once and never overwritten (Shared Core §6).

import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/encrypt';
import type {
  JourneyChannel,
  MiiState,
  StoredWorkingPreference,
} from './types';
import type {
  StateReport,
  TaskContract,
  WorkingPreferenceNote,
} from '../stateReport/schema';

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
  // Journey remediation 2026-07-19 — sparse task-contract patch (RC2)
  taskContractPatch?: TaskContract;
  // Journey remediation 2026-07-19 — working-preference patch (RC4/A7)
  workingPreferencePatch?: {
    noted: WorkingPreferenceNote[];
    cleared: string[];
  };
  // MII updates (partial — merged into existing mii JSON)
  miiPatch?: Partial<MiiState>;
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
  // Journey remediation 2026-07-19 — task contract + working preferences.
  // Parser already validated non-empty, non-generic values; merge happens in
  // applyUpdates against the stored versions.
  if (report.taskContract) updates.taskContractPatch = report.taskContract;
  if (report.workingPreferenceNoted || report.workingPreferenceCleared) {
    updates.workingPreferencePatch = {
      noted: report.workingPreferenceNoted ?? [],
      cleared: report.workingPreferenceCleared ?? [],
    };
  }
  // Note: the red_flag freeze write is intentionally NOT here — turn/route.ts
  // calls freezeJourney({source:'state_report'}) after applyStateReportToProgress
  // so the reason string composed by freezeJourney (source | type | reasoning)
  // is the one that persists. Writing here too would (a) race with the freeze
  // helper and (b) clobber the composed reason with a bare type string.

  // Stage 4 MII-6 (48-hour settling check). The AI emits mii6Check ONLY
  // when the soft check-in instruction was injected this turn. Map the
  // AI's verdict to the persisted MII status:
  //   stable                       → met   (the gate passes)
  //   destabilised_then_recovered  → met   (wobble already resolved)
  //   unsure                       → pending (log only; gate does not fail)
  //   destabilised                 → failed (gate trips; Stage 4→5 held)
  // The gate check at stage-gates.ts mii6Status === 'failed' was previously
  // unreachable because no code path wrote to mii6_noDestabilisation —
  // this is the wiring fix from the 2026-06-19 audit (CRITICAL #2).
  if (report.mii6Check) {
    const status =
      report.mii6Check === 'destabilised'
        ? 'failed'
        : report.mii6Check === 'unsure'
          ? 'pending'
          : 'met';
    updates.miiPatch = {
      ...(updates.miiPatch ?? {}),
      mii6_noDestabilisation: {
        status,
        lastCheckedAt: new Date().toISOString(),
      },
    };
  }

  await applyUpdates(userId, updates);
  await applyLandscapeAdditions(userId, report);
}

async function applyUpdates(userId: string, u: Updates): Promise<void> {
  // Read current state so we can: (a) not overwrite the anchor once set,
  // (b) merge the MII patch into the existing JSON, (c) merge the task
  // contract and working preferences against stored values.
  const current = await prisma.recodeProgress.findUnique({
    where: { userId },
    select: {
      anchorTextEncrypted: true,
      mii: true,
      taskContractEncrypted: true,
      workingPreferencesEncrypted: true,
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

  // Journey remediation 2026-07-19 — task-contract merge (RC2). Field-wise:
  // an incoming non-empty value updates its field; absent fields keep their
  // stored value. Parser already dropped empty/generic values, so a sparse
  // emission can never erase a valid contract.
  if (u.taskContractPatch) {
    const existing = decryptJsonOrNull<TaskContract>(current.taskContractEncrypted);
    const merged = mergeTaskContract(existing, u.taskContractPatch);
    if (merged) data.taskContractEncrypted = encrypt(JSON.stringify(merged));
  }

  // Journey remediation 2026-07-19 — working-preference merge (RC4/A7).
  if (u.workingPreferencePatch) {
    const existing =
      decryptJsonOrNull<StoredWorkingPreference[]>(
        current.workingPreferencesEncrypted,
      ) ?? [];
    const merged = mergeWorkingPreferences(
      existing,
      u.workingPreferencePatch.noted,
      u.workingPreferencePatch.cleared,
    );
    data.workingPreferencesEncrypted = encrypt(JSON.stringify(merged));
  }

  await prisma.recodeProgress.update({
    where: { userId },
    data,
  });
}

function decryptJsonOrNull<T>(v: string | null): T | null {
  if (!v) return null;
  try {
    return JSON.parse(decrypt(v)) as T;
  } catch {
    return null;
  }
}

/**
 * Journey remediation 2026-07-19 (RC2). Merge a sparse task-contract patch
 * into the stored contract. Pure; exported for tests.
 *
 * Rules:
 *   - Only non-empty string fields in the patch update the stored value
 *     (the parser has already dropped empty/generic values — this guard is
 *     defence in depth for callers that bypass the parser).
 *   - Fields absent from the patch keep their stored value — a sparse or
 *     partial emission never erases a valid contract (fixture E).
 *   - presentingRequest MAY be revised by a new non-empty value: the user
 *     is allowed to change direction. Emerging material lives in
 *     currentFocus; the prompt instructs the model to revise
 *     presentingRequest only on an explicit change of direction.
 *   - Returns null only when both sides are empty.
 */
export function mergeTaskContract(
  existing: TaskContract | null,
  patch: TaskContract,
): TaskContract | null {
  const merged: TaskContract = { ...(existing ?? {}) };
  for (const field of [
    'presentingRequest',
    'expectedHelp',
    'currentFocus',
    'completionCriterion',
  ] as const) {
    const v = patch[field];
    if (typeof v === 'string' && v.trim().length >= 3) {
      merged[field] = v.trim().slice(0, 300);
    }
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

const MAX_STORED_PREFERENCES = 10;

/**
 * Journey remediation 2026-07-19 (RC4/A7). Merge newly noted working
 * preferences into the stored list and remove cleared ones. Pure; exported
 * for tests.
 *
 * Rules:
 *   - Dedup case-insensitively on text: re-noting an existing preference
 *     refreshes its notedAt and kind rather than duplicating.
 *   - Cleared entries are matched case-insensitively on exact text OR
 *     substring in either direction ("no imagery" clears "please no
 *     imagery work").
 *   - Cap at MAX_STORED_PREFERENCES — oldest dropped first.
 *   - Preferences survive session boundaries by design; only an explicit
 *     clear (user revised their position) removes one.
 */
export function mergeWorkingPreferences(
  existing: StoredWorkingPreference[],
  noted: WorkingPreferenceNote[],
  cleared: string[],
  now: Date = new Date(),
): StoredWorkingPreference[] {
  const clearedNorms = cleared
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
  const matchesCleared = (text: string): boolean => {
    const t = text.toLowerCase();
    return clearedNorms.some((c) => t === c || t.includes(c) || c.includes(t));
  };

  const out: StoredWorkingPreference[] = existing.filter(
    (p) => !matchesCleared(p.text),
  );
  for (const n of noted) {
    const text = n.text.trim();
    if (text.length < 3) continue;
    if (matchesCleared(text)) continue; // cleared this turn wins over noted
    const idx = out.findIndex(
      (p) => p.text.toLowerCase() === text.toLowerCase(),
    );
    const entry: StoredWorkingPreference = {
      text,
      kind: n.kind,
      notedAt: now.toISOString(),
    };
    if (idx >= 0) out[idx] = entry;
    else out.push(entry);
  }
  // Cap: keep the most recently noted.
  if (out.length > MAX_STORED_PREFERENCES) {
    out.sort((a, b) => a.notedAt.localeCompare(b.notedAt));
    return out.slice(out.length - MAX_STORED_PREFERENCES);
  }
  return out;
}

async function applyLandscapeAdditions(userId: string, report: StateReport): Promise<void> {
  // Parts touched — upsert. Match on the user's exact words. If a JourneyPart
  // row already exists for this user with the same decrypted description,
  // touch updatedAt only. Otherwise insert a new row. Stops the same part
  // (e.g. "the 10-year-old with two braids") from being inserted 20 times
  // across 20 turns.
  if (report.partsTouched && report.partsTouched.length > 0) {
    const activeParts = await prisma.journeyPart.findMany({
      where: { userId, active: true },
      select: { id: true, userDescriptionEncrypted: true, channel: true, safeDistanceEncrypted: true },
    });
    const byDescription = new Map<string, (typeof activeParts)[number]>();
    for (const row of activeParts) {
      try {
        byDescription.set(decrypt(row.userDescriptionEncrypted), row);
      } catch {
        // ignore decryption failure for dedup lookup
      }
    }
    for (const p of report.partsTouched) {
      if (!p.description) continue;
      const existing = byDescription.get(p.description);
      if (existing) {
        // Same part already in the landscape — only update if new info arrived.
        const data: Record<string, unknown> = { updatedAt: new Date() };
        if (p.channel && !existing.channel) data.channel = p.channel;
        if (p.safeDistance && !existing.safeDistanceEncrypted) {
          data.safeDistanceEncrypted = encrypt(p.safeDistance);
        }
        if (Object.keys(data).length > 1) {
          await prisma.journeyPart.update({ where: { id: existing.id }, data });
        }
      } else {
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
  }

  // Stage 4 MII-5 — Adult Self offering / part secured at a resting place.
  // Updates the matching JourneyPart row in-place. Match on the user's exact
  // words for the part's description.
  if (report.partSecured?.partDescription) {
    const match = await findActivePartByDescription(userId, report.partSecured.partDescription);
    if (match) {
      const data: Record<string, unknown> = { updatedAt: new Date() };
      if (report.partSecured.restingPlace) {
        data.currentRestingPlaceEncrypted = encrypt(report.partSecured.restingPlace);
      }
      // The Adult-Self-offering is the textual capture of MII-5. We store it
      // on the part's currentRestingPlace if no separate field; otherwise we
      // could add a dedicated column later. For now, prefix the offering into
      // restingPlace text only if no resting place text was given.
      if (!report.partSecured.restingPlace && report.partSecured.adultSelfOffering) {
        data.currentRestingPlaceEncrypted = encrypt(report.partSecured.adultSelfOffering);
      }
      if (Object.keys(data).length > 1) {
        await prisma.journeyPart.update({ where: { id: match.id }, data });
      }
    }
  }

  // Foreign files touched — insert if new (identified for the first time).
  if (report.foreignFilesTouched && report.foreignFilesTouched.length > 0) {
    const existing = await prisma.journeyForeignFile.findMany({
      where: { userId },
      select: { id: true, userDescriptionEncrypted: true },
    });
    const knownDescriptions = new Set<string>();
    for (const row of existing) {
      try {
        knownDescriptions.add(decrypt(row.userDescriptionEncrypted));
      } catch {
        // ignore decryption failure for dedup lookup
      }
    }
    for (const f of report.foreignFilesTouched) {
      if (!f.description) continue;
      if (knownDescriptions.has(f.description)) continue; // already in the landscape
      await prisma.journeyForeignFile.create({
        data: {
          userId,
          userDescriptionEncrypted: encrypt(f.description),
          identifiedAt: new Date(),
        },
      });
    }
  }

  // Stage 5 — Symbolic Return of the Burden.
  //
  // Journey remediation 2026-07-19 (audit A8/B6): the AI's release emission
  // is a PROVISIONAL claim. It stamps releaseClaimedAt — never releasedAt.
  // releasedAt (which the Stage 5 gate reads) is set only by the separate
  // releaseConfirmed emission, when the user has confirmed the release held
  // across time. releaseInvalidated reopens the file (clears both stamps),
  // so the next user response can always invalidate the release hypothesis.
  if (report.foreignFileReleased?.description) {
    const all = await prisma.journeyForeignFile.findMany({
      where: { userId, releasedAt: null },
      select: {
        id: true,
        userDescriptionEncrypted: true,
      },
    });
    let matchId: string | null = null;
    for (const row of all) {
      try {
        if (decrypt(row.userDescriptionEncrypted) === report.foreignFileReleased.description) {
          matchId = row.id;
          break;
        }
      } catch {
        // ignore
      }
    }
    if (matchId) {
      await prisma.journeyForeignFile.update({
        where: { id: matchId },
        data: {
          releaseClaimedAt: new Date(),
          returnedToEncrypted: report.foreignFileReleased.returnedTo
            ? encrypt(report.foreignFileReleased.returnedTo)
            : null,
          honouringPhraseEncrypted: report.foreignFileReleased.honouringPhrase
            ? encrypt(report.foreignFileReleased.honouringPhrase)
            : null,
          whatStaysAsMineEncrypted: report.foreignFileReleased.whatStaysAsMine
            ? encrypt(report.foreignFileReleased.whatStaysAsMine)
            : null,
        },
      });
    } else {
      // No prior identification — insert with the claim only. Rare but
      // possible if the user named and released foreign material in one move.
      await prisma.journeyForeignFile.create({
        data: {
          userId,
          userDescriptionEncrypted: encrypt(report.foreignFileReleased.description),
          identifiedAt: new Date(),
          releaseClaimedAt: new Date(),
          returnedToEncrypted: report.foreignFileReleased.returnedTo
            ? encrypt(report.foreignFileReleased.returnedTo)
            : null,
          honouringPhraseEncrypted: report.foreignFileReleased.honouringPhrase
            ? encrypt(report.foreignFileReleased.honouringPhrase)
            : null,
          whatStaysAsMineEncrypted: report.foreignFileReleased.whatStaysAsMine
            ? encrypt(report.foreignFileReleased.whatStaysAsMine)
            : null,
        },
      });
    }
  }

  // Journey remediation 2026-07-19 — release CONFIRMATION. Only a file with
  // a standing provisional claim can be confirmed; confirmation stamps
  // releasedAt, which is what the Stage 5 gate counts.
  if (report.releaseConfirmed?.description) {
    const claimed = await prisma.journeyForeignFile.findMany({
      where: { userId, releasedAt: null, releaseClaimedAt: { not: null } },
      select: { id: true, userDescriptionEncrypted: true },
    });
    for (const row of claimed) {
      try {
        if (decrypt(row.userDescriptionEncrypted) === report.releaseConfirmed.description) {
          await prisma.journeyForeignFile.update({
            where: { id: row.id },
            data: { releasedAt: new Date() },
          });
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  // Journey remediation 2026-07-19 — release INVALIDATION. The user's
  // response contradicted the release (feels worse, material reactivated):
  // reopen the file immediately — clear both the claim and any confirmation
  // so unresolved activation reopens the process.
  if (report.releaseInvalidated?.description) {
    const candidates = await prisma.journeyForeignFile.findMany({
      where: {
        userId,
        OR: [{ releaseClaimedAt: { not: null } }, { releasedAt: { not: null } }],
      },
      select: { id: true, userDescriptionEncrypted: true },
    });
    for (const row of candidates) {
      try {
        if (decrypt(row.userDescriptionEncrypted) === report.releaseInvalidated.description) {
          await prisma.journeyForeignFile.update({
            where: { id: row.id },
            data: { releaseClaimedAt: null, releasedAt: null },
          });
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  // Journey polish PR 5. patternsTouched → JourneyPattern upsert.
  // One row per (userId, category); description evolves as the user's
  // words deepen; lastConfirmedAt bumps every time the AI names the same
  // pattern. New rows also stamp firstObservedAt (defaults to now).
  //
  // Encryption note: category is a plain snake_case identifier (not user
  // words) — stored as plaintext, safe to index and query. Description
  // is the user's exact words and IS encrypted at rest.
  //
  // Context is merged shallowly onto whatever's already there — a later
  // observation adding { ageTag: 9 } does not clobber a prior
  // { channel: 'visual' }. If the AI omits context, existing context is
  // preserved untouched.
  if (report.patternsTouched && report.patternsTouched.length > 0) {
    for (const p of report.patternsTouched) {
      if (!p.category || !p.description) continue;
      const now = new Date();
      const existing = await prisma.journeyPattern.findUnique({
        where: { userId_category: { userId, category: p.category } },
        select: { id: true, context: true },
      });
      if (existing) {
        // Merge context if new keys arrived.
        let mergedContext: Prisma.InputJsonValue | undefined;
        if (p.context && Object.keys(p.context).length > 0) {
          const prior =
            existing.context && typeof existing.context === 'object' && !Array.isArray(existing.context)
              ? (existing.context as Record<string, unknown>)
              : {};
          mergedContext = { ...prior, ...p.context } as Prisma.InputJsonValue;
        }
        await prisma.journeyPattern.update({
          where: { id: existing.id },
          data: {
            userDescriptionEncrypted: encrypt(p.description),
            lastConfirmedAt: now,
            ...(mergedContext !== undefined ? { context: mergedContext } : {}),
          },
        });
      } else {
        const newContext: Prisma.InputJsonValue | undefined =
          p.context && Object.keys(p.context).length > 0
            ? (p.context as Prisma.InputJsonValue)
            : undefined;
        await prisma.journeyPattern.create({
          data: {
            userId,
            category: p.category,
            userDescriptionEncrypted: encrypt(p.description),
            firstObservedAt: now,
            lastConfirmedAt: now,
            ...(newContext !== undefined ? { context: newContext } : {}),
          },
        });
      }
    }
  }

  // Signature images discovered — dedup on description so a user re-mentioning
  // the same image across many turns doesn't create dozens of rows.
  if (report.userImagesCaptured && report.userImagesCaptured.length > 0) {
    const existing = await prisma.journeySignatureImage.findMany({
      where: { userId },
      select: { userDescriptionEncrypted: true },
    });
    const known = new Set<string>();
    for (const row of existing) {
      try {
        known.add(decrypt(row.userDescriptionEncrypted));
      } catch {
        // ignore
      }
    }
    for (const img of report.userImagesCaptured) {
      if (!img) continue;
      if (known.has(img)) continue;
      await prisma.journeySignatureImage.create({
        data: {
          userId,
          userDescriptionEncrypted: encrypt(img),
        },
      });
    }
  }
}

/** Find an active part by the decrypted description. */
async function findActivePartByDescription(
  userId: string,
  description: string,
): Promise<{ id: string } | null> {
  const all = await prisma.journeyPart.findMany({
    where: { userId, active: true },
    select: { id: true, userDescriptionEncrypted: true },
  });
  for (const row of all) {
    try {
      if (decrypt(row.userDescriptionEncrypted) === description) return { id: row.id };
    } catch {
      // ignore
    }
  }
  return null;
}
