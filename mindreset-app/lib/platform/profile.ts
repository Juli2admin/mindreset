// Platform profile access module — Step 1 (2026-07-20).
//
// The "promotion" of WellbeingSnapshot from a MiniMind silo to the
// platform profile is an ACCESS-LAYER promotion: this module is the named
// API every future consumer goes through. No rename, no parallel object —
// the row stays the single source of truth for hidden diagnostics, and
// this module adds the platform tiers on top:
//
//   - user-authored onboarding answers (4 button codes; the user is the
//     author, products never write these)
//   - the append-only recommendation log (writers arrive in step 4/7)
//   - derived product access (computed, never duplicated as columns)
//   - a typed USER-FACING projection that structurally cannot leak hidden
//     diagnostics (see types.ts)
//
// Upsert semantics throughout: today a WellbeingSnapshot row exists only
// after MiniMind use; onboarding must create it for everyone.
//
// Existing MiniMind consumers (memory loader/updater, chat route, GDPR
// export) intentionally keep their direct access in Step 1 — they migrate
// to this module opportunistically in later steps.

import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encrypt';
import {
  ONBOARDING_WHY,
  ONBOARDING_AREA,
  ONBOARDING_STYLE,
  ONBOARDING_GOAL,
  RECOMMENDATION_SOURCES,
  RECOMMENDATION_RESPONSES,
  type OnboardingAnswers,
  type ActiveProducts,
  type ModuleAccess,
  type RecommendationSource,
  type RecommendationResponse,
  type UserFacingProfile,
  type UserFacingRecommendation,
  type OnboardingWhy,
  type OnboardingArea,
  type OnboardingStyle,
  type OnboardingGoal,
} from './types';

// Declined recommendations sleep for this long before a rule may
// re-recommend the same product. ("Never pushed", enforceable.)
export const RECOMMENDATION_COOL_OFF_DAYS = 30;

// ---------------------------------------------------------------------------
// Onboarding answers (user-authored)
// ---------------------------------------------------------------------------

function assertCode<T extends readonly string[]>(
  field: string,
  value: string | undefined,
  vocabulary: T,
): void {
  if (value === undefined) return;
  if (!(vocabulary as readonly string[]).includes(value)) {
    throw new Error(`[platform/profile] unknown ${field} code: ${value}`);
  }
}

/**
 * Save (possibly partial) onboarding answers. Merge semantics mirror the
 * Journey task contract: provided fields update, absent fields keep their
 * stored value — a partial save can never erase an earlier answer. Codes
 * outside the canonical vocabularies are rejected loudly (they would
 * otherwise silently poison recommendations downstream).
 *
 * onboardingCompletedAt is stamped once, when all four answers are present
 * after the merge. `now` injectable for tests. Returns whether onboarding
 * is complete after this save, so the caller can fire completion-time
 * side effects (Step 4: recommendation rules).
 */
export async function saveOnboarding(
  userId: string,
  answers: OnboardingAnswers,
  now: Date = new Date(),
): Promise<{ completed: boolean }> {
  assertCode('why', answers.why, ONBOARDING_WHY);
  assertCode('area', answers.area, ONBOARDING_AREA);
  assertCode('style', answers.style, ONBOARDING_STYLE);
  assertCode('goal', answers.goal, ONBOARDING_GOAL);

  const existing = await prisma.wellbeingSnapshot.findUnique({
    where: { userId },
    select: {
      onboardingWhy: true,
      onboardingArea: true,
      onboardingStyle: true,
      onboardingGoal: true,
      onboardingCompletedAt: true,
    },
  });

  const merged = {
    onboardingWhy: answers.why ?? existing?.onboardingWhy ?? null,
    onboardingArea: answers.area ?? existing?.onboardingArea ?? null,
    onboardingStyle: answers.style ?? existing?.onboardingStyle ?? null,
    onboardingGoal: answers.goal ?? existing?.onboardingGoal ?? null,
  };
  const allAnswered =
    merged.onboardingWhy !== null &&
    merged.onboardingArea !== null &&
    merged.onboardingStyle !== null &&
    merged.onboardingGoal !== null;
  const completedAt =
    existing?.onboardingCompletedAt ?? (allAnswered ? now : null);

  // Only onboarding fields ever appear in this write — the module must
  // never touch the MiniMind-owned diagnostic columns.
  const data = { ...merged, onboardingCompletedAt: completedAt };

  await prisma.wellbeingSnapshot.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
  return { completed: completedAt !== null };
}

/** Record that the user skipped onboarding. Set-once; upserts the row. */
export async function markOnboardingSkipped(
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const existing = await prisma.wellbeingSnapshot.findUnique({
    where: { userId },
    select: { onboardingSkippedAt: true },
  });
  if (existing?.onboardingSkippedAt) return;
  await prisma.wellbeingSnapshot.upsert({
    where: { userId },
    update: { onboardingSkippedAt: now },
    create: { userId, onboardingSkippedAt: now },
  });
}

/**
 * The user's onboarding answers, for product context injection (Step 3).
 * null when the user skipped or answered nothing — callers render no
 * block in that case.
 */
export async function getOnboardingAnswers(
  userId: string,
): Promise<OnboardingAnswers | null> {
  const row = await prisma.wellbeingSnapshot.findUnique({
    where: { userId },
    select: {
      onboardingWhy: true,
      onboardingArea: true,
      onboardingStyle: true,
      onboardingGoal: true,
    },
  });
  if (!row) return null;
  const answers: OnboardingAnswers = {};
  if (row.onboardingWhy) answers.why = row.onboardingWhy as OnboardingWhy;
  if (row.onboardingArea) answers.area = row.onboardingArea as OnboardingArea;
  if (row.onboardingStyle) answers.style = row.onboardingStyle as OnboardingStyle;
  if (row.onboardingGoal) answers.goal = row.onboardingGoal as OnboardingGoal;
  return Object.keys(answers).length > 0 ? answers : null;
}

// ---------------------------------------------------------------------------
// Derived product access (computed — never duplicated as columns)
// ---------------------------------------------------------------------------

/**
 * What the user owns and where they are, derived from the tables that
 * already hold the truth: User.currentTier, completed Purchases (+
 * accessExpiresAt), RecodeProgress. `now` injectable for tests.
 */
export async function getActiveProducts(
  userId: string,
  now: Date = new Date(),
): Promise<ActiveProducts> {
  const [user, purchases, recode] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { currentTier: true },
    }),
    prisma.purchase.findMany({
      where: { userId, status: 'completed' },
      select: {
        productType: true,
        productId: true,
        accessExpiresAt: true,
      },
    }),
    prisma.recodeProgress.findUnique({
      where: { userId },
      select: { dischargedAt: true },
    }),
  ]);

  const moduleAccess = (productType: string): ModuleAccess[] =>
    purchases
      .filter((p) => p.productType === productType && p.productId)
      .map((p) => ({
        moduleId: p.productId as string,
        accessExpiresAt: p.accessExpiresAt,
        active: p.accessExpiresAt === null || p.accessExpiresAt.getTime() > now.getTime(),
      }));

  return {
    minimindTier: user?.currentTier ?? null,
    journey: {
      purchased: purchases.some((p) => p.productType === 'recode'),
      started: recode !== null,
      discharged: recode?.dischargedAt != null,
    },
    states: moduleAccess('state_module'),
    themes: moduleAccess('theme_module'),
  };
}

// ---------------------------------------------------------------------------
// Recommendation log (append-only; writers arrive in steps 4 and 7)
// ---------------------------------------------------------------------------

export async function recordRecommendation(args: {
  userId: string;
  product: string; // 'minimind' | 'journey' | 'state:<id>' | 'theme:<id>'
  source: RecommendationSource;
  ruleKey?: string;
  reason?: string; // plain language; may quote the user's words → encrypted
}): Promise<{ id: string }> {
  if (!(RECOMMENDATION_SOURCES as readonly string[]).includes(args.source)) {
    throw new Error(`[platform/profile] unknown recommendation source: ${args.source}`);
  }
  const row = await prisma.platformRecommendation.create({
    data: {
      userId: args.userId,
      product: args.product,
      source: args.source,
      ruleKey: args.ruleKey ?? null,
      reasonEncrypted: args.reason ? encrypt(args.reason) : null,
    },
    select: { id: true },
  });
  return row;
}

/**
 * Record the user's response. A decline sets coolOffUntil so rules must
 * not re-recommend that product before it lapses ("never pushed").
 */
export async function respondToRecommendation(
  id: string,
  response: RecommendationResponse,
  now: Date = new Date(),
): Promise<void> {
  if (!(RECOMMENDATION_RESPONSES as readonly string[]).includes(response)) {
    throw new Error(`[platform/profile] unknown recommendation response: ${response}`);
  }
  const coolOffUntil =
    response === 'declined'
      ? new Date(now.getTime() + RECOMMENDATION_COOL_OFF_DAYS * 24 * 60 * 60 * 1000)
      : null;
  await prisma.platformRecommendation.update({
    where: { id },
    data: { response, respondedAt: now, coolOffUntil },
  });
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

/**
 * The USER-FACING projection — the only platform-profile shape a dashboard
 * may render. Contains: the user's own onboarding answers, un-responded
 * recommendations (with decrypted reasons), and derived product access.
 * Hidden diagnostics are structurally absent (see UserFacingProfile in
 * types.ts); the field-list test pins this.
 */
export async function getUserFacingProfile(
  userId: string,
  now: Date = new Date(),
): Promise<UserFacingProfile> {
  const [snapshot, recommendations, products] = await Promise.all([
    prisma.wellbeingSnapshot.findUnique({
      where: { userId },
      select: {
        onboardingWhy: true,
        onboardingArea: true,
        onboardingStyle: true,
        onboardingGoal: true,
        onboardingCompletedAt: true,
        onboardingSkippedAt: true,
      },
    }),
    prisma.platformRecommendation.findMany({
      where: { userId, response: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        product: true,
        reasonEncrypted: true,
        createdAt: true,
        coolOffUntil: true,
      },
    }),
    getActiveProducts(userId, now),
  ]);

  const activeRecommendations: UserFacingRecommendation[] = recommendations
    .filter((r) => r.coolOffUntil === null || r.coolOffUntil.getTime() <= now.getTime())
    .map((r) => ({
      id: r.id,
      product: r.product,
      reason: decryptOrNull(r.reasonEncrypted),
      createdAt: r.createdAt,
    }));

  return {
    onboarding: {
      why: (snapshot?.onboardingWhy as OnboardingWhy | null) ?? null,
      area: (snapshot?.onboardingArea as OnboardingArea | null) ?? null,
      style: (snapshot?.onboardingStyle as OnboardingStyle | null) ?? null,
      goal: (snapshot?.onboardingGoal as OnboardingGoal | null) ?? null,
      completedAt: snapshot?.onboardingCompletedAt ?? null,
      skippedAt: snapshot?.onboardingSkippedAt ?? null,
    },
    activeRecommendations,
    products,
  };
}

function decryptOrNull(v: string | null): string | null {
  if (v == null) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}
