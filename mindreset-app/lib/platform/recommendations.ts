// Platform recommendation rules — Step 4 (2026-07-20).
//
// Two rule families write to the PlatformRecommendation log:
//
//   1. Onboarding rules — fire once, when the 4-step onboarding completes.
//      Conservative by design: only high-confidence mappings recommend a
//      module; everything else falls back to MiniMind (the default for
//      the undecided) and ONLY when the user owns nothing yet.
//   2. State-threshold rule — the roadmap's locked "recognition before
//      recommendation": the same detected state 3+ times in 7 days (data
//      the MiniMind updater already maintains) recommends the matching
//      module.
//
// Hard principles (owner-locked):
//   - The Journey is NEVER recommended by onboarding rules — four button
//     taps are not recognition. Journey recommendations require patterns
//     over time (later work) or the user's own informed choice (step 6).
//   - At most ONE open platform-rule recommendation at a time.
//   - Declined products stay silent for the cool-off; owned-and-active
//     products are never recommended.
//   - Rules store a ruleKey, not display text — the dashboard (step 5)
//     localises the reason from the key, so reasons follow the user's
//     locale instead of freezing in English.

import prisma from '@/lib/prisma';
import {
  getActiveProducts,
  getOnboardingAnswers,
  recordRecommendation,
} from './profile';
import type { OnboardingAnswers } from './types';

export type RuleRecommendation = { product: string; ruleKey: string };

// Every ruleKey a platform rule can emit. The dashboard i18n coverage
// test walks this list — a new rule without localised reason copy in
// BOTH native bundles fails CI before it can render as a raw key.
export const ALL_RULE_KEYS = [
  'onboarding_why_lost_myself',
  'onboarding_area_money',
  'onboarding_area_family',
  'onboarding_area_career_purpose',
  'onboarding_why_stuck',
  'onboarding_default_minimind',
  'state_repeat_3in7',
] as const;

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

/**
 * Onboarding-completion rule. Precedence: the most specific signal wins,
 * one recommendation only. Returns null when nothing matches confidently —
 * no recommendation beats a weak one.
 */
export function onboardingRecommendation(
  answers: OnboardingAnswers | null,
): RuleRecommendation | null {
  if (!answers) return null;
  if (answers.why === 'lost_myself') {
    return { product: 'state:loss_of_self', ruleKey: 'onboarding_why_lost_myself' };
  }
  if (answers.area === 'money') {
    return { product: 'theme:money', ruleKey: 'onboarding_area_money' };
  }
  if (answers.area === 'family') {
    return { product: 'theme:family', ruleKey: 'onboarding_area_family' };
  }
  if (answers.area === 'career_purpose') {
    return { product: 'theme:self_realisation', ruleKey: 'onboarding_area_career_purpose' };
  }
  if (answers.why === 'stuck') {
    return { product: 'state:apathy', ruleKey: 'onboarding_why_stuck' };
  }
  if (answers.why === 'curious') {
    return { product: 'minimind', ruleKey: 'onboarding_default_minimind' };
  }
  return null;
}

// Detected-state (MiniMind's 9-state taxonomy) → module. Conservative:
// states without a clean module match recommend nothing.
export const STATE_THRESHOLD_PRODUCT: Partial<Record<string, string>> = {
  anxiety_overwhelm: 'state:anxiety',
  stuckness_inertia: 'state:apathy',
  identity_confusion: 'state:loss_of_self',
  disconnection_numbness: 'state:inner_emptiness',
  shame: 'theme:shame',
};

const THRESHOLD_COUNT = 3;
const THRESHOLD_WINDOW_DAYS = 7;

/**
 * The 3-in-7 recognition rule over WellbeingSnapshot.recentStateOccurrences
 * ([{ state, detectedAt }]). Pure; `now` injectable.
 */
export function stateThresholdRecommendation(
  occurrences: { state: string; detectedAt: string }[] | null,
  now: Date = new Date(),
): RuleRecommendation | null {
  if (!occurrences || occurrences.length === 0) return null;
  const cutoff = now.getTime() - THRESHOLD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const o of occurrences) {
    const at = Date.parse(o.detectedAt);
    if (Number.isNaN(at) || at < cutoff || at > now.getTime()) continue;
    counts.set(o.state, (counts.get(o.state) ?? 0) + 1);
  }
  for (const [state, count] of Array.from(counts.entries())) {
    if (count >= THRESHOLD_COUNT) {
      const product = STATE_THRESHOLD_PRODUCT[state];
      if (product) return { product, ruleKey: 'state_repeat_3in7' };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Guards + effectful evaluation
// ---------------------------------------------------------------------------

/**
 * May a platform rule recommend `product` to this user right now?
 * False when: any platform-rule recommendation is still open (one at a
 * time); the same product is inside a decline cool-off; or the user
 * already owns/uses the product.
 */
export async function canRecommend(
  userId: string,
  product: string,
  now: Date = new Date(),
): Promise<boolean> {
  const [openPlatformRec, coolingSameProduct, products] = await Promise.all([
    prisma.platformRecommendation.findFirst({
      where: { userId, source: 'platform_rule', response: null },
      select: { id: true },
    }),
    prisma.platformRecommendation.findFirst({
      where: { userId, product, coolOffUntil: { gt: now } },
      select: { id: true },
    }),
    getActiveProducts(userId, now),
  ]);
  if (openPlatformRec || coolingSameProduct) return false;

  if (product === 'minimind') return products.minimindTier === null;
  if (product === 'journey') {
    // Belt-and-braces: platform rules never recommend the Journey at all.
    return false;
  }
  const [kind, moduleId] = product.split(':');
  const owned =
    kind === 'state'
      ? products.states.some((m) => m.moduleId === moduleId && m.active)
      : products.themes.some((m) => m.moduleId === moduleId && m.active);
  return !owned;
}

/** Fire on onboarding completion. Errors must never break the caller. */
export async function evaluateOnboardingRecommendation(userId: string): Promise<void> {
  try {
    const rec = onboardingRecommendation(await getOnboardingAnswers(userId));
    if (!rec) return;
    if (!(await canRecommend(userId, rec.product))) return;
    await recordRecommendation({
      userId,
      product: rec.product,
      source: 'platform_rule',
      ruleKey: rec.ruleKey,
    });
  } catch (err) {
    console.error('[platform/recommendations] onboarding rule failed', err);
  }
}

/** Fire after each WellbeingSnapshot update. Errors must never break the updater. */
export async function evaluateStateThresholdRecommendation(userId: string): Promise<void> {
  try {
    const snapshot = await prisma.wellbeingSnapshot.findUnique({
      where: { userId },
      select: { recentStateOccurrences: true },
    });
    const occurrences = snapshot?.recentStateOccurrences as
      | { state: string; detectedAt: string }[]
      | null;
    const rec = stateThresholdRecommendation(occurrences);
    if (!rec) return;
    if (!(await canRecommend(userId, rec.product))) return;
    await recordRecommendation({
      userId,
      product: rec.product,
      source: 'platform_rule',
      ruleKey: rec.ruleKey,
    });
  } catch (err) {
    console.error('[platform/recommendations] threshold rule failed', err);
  }
}
