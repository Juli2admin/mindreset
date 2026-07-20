// Platform recommendation rules — onboarding v2 typed routing
// (2026-07-20, owner-approved with two routing corrections).
//
// TWO independent families, deliberately kept apart:
//
//   1. ORIENTATION (onboarding) — a STATELESS ranked set computed at
//      dashboard render time from the four onboarding answers. It never
//      writes to the DB: recompute on every visit, so it self-corrects for
//      every existing user and needs no migration. See rankOnboardingRecommendations.
//   2. RECOGNITION (state threshold) — the roadmap's locked "recognition
//      before recommendation": the same detected state 3+ times in 7 days
//      recommends the matching module. This one PERSISTS to
//      PlatformRecommendation (dismissals, cool-off, explicit responses).
//
// Orientation logic — the TYPING model. Step 3 (goal column) decides the
// user's preferred TYPE of work; Steps 1–2 decide which product of that
// type. Output: one Primary + up to two Other options (max 3 cards); the
// full catalogue stays visible below; nothing restricts access.
//
//   Transformation → «Путь к себе» primary (informed-choice page, ANY
//     topic) + the matching module (State preferred, else Theme — never
//     both in this shape) + MiniMind companion.
//   Relief + a named state → that State primary + MiniMind
//     (+ soft Journey only with a soft signal).
//   Focused + a named theme → that Theme primary + MiniMind
//     (+ soft Journey only with a soft signal).
//   Talk / not-sure (and all fallbacks) → Companion shape: MiniMind
//     primary + matching State and/or Theme; a soft Journey card may
//     NEVER displace a directly matching module — it appears only when a
//     soft signal exists AND fewer than two modules matched.
//
// Hard rules: onboarding is not diagnosis — no trauma/parts/diagnosis
// inference from buttons. Love/relationships never maps to Family.
// "Strong reactions" never auto-maps to Anxiety. Shame & Guilt only via
// the explicit self-worth/shame area. The Journey is primary ONLY when
// transformation is explicitly chosen, and always routes through the
// informed-choice page, never checkout. Style affects voice only.

import prisma from '@/lib/prisma';
import { getActiveProducts, recordRecommendation } from './profile';
import type { ActiveProducts } from './types';

export type RuleRecommendation = { product: string; ruleKey: string };

export type RecommendedProduct =
  | 'minimind'
  | 'state:anxiety'
  | 'state:apathy'
  | 'state:loss_of_self'
  | 'state:inner_emptiness'
  | 'theme:money'
  | 'theme:family'
  | 'theme:body'
  | 'theme:shame'
  | 'theme:self_realisation'
  | 'journey';

// Loose answer shape: the projection hands us nullable strings.
export type OnboardingAnswerInput = {
  why?: string | null;
  area?: string | null;
  style?: string | null;
  goal?: string | null;
};

export type RankedRec = {
  product: RecommendedProduct;
  reasonKey: string; // -> Dashboard.reason_<reasonKey>
  route: 'product' | 'informed_choice'; // journey -> informed_choice, never checkout
};

// Every reason key the ORIENTATION engine can emit. The dashboard i18n
// coverage test walks this list — a new key without localised copy in BOTH
// native bundles fails CI before it can render as a raw key to a user.
export const ONBOARDING_REASON_KEYS = [
  'journey_primary',
  'journey_soft',
  'state_anxiety',
  'state_apathy',
  'state_loss_of_self',
  'state_inner_emptiness',
  'theme_money',
  'theme_family',
  'theme_body',
  'theme_shame',
  'theme_self_realisation',
  'minimind_talk',
  'minimind_unsure',
  'minimind_decision',
  'minimind_companion',
] as const;

// ---------------------------------------------------------------------------
// ORIENTATION — typed routing (pure, stateless)
// ---------------------------------------------------------------------------

// Step 1 → State module. Only these four answers name a state; everything
// else (strong_reactions included — owner rule) names NO state.
const STATE_BY_WHY: Partial<Record<string, RecommendedProduct>> = {
  anxiety_overwhelm: 'state:anxiety',
  no_energy_drive: 'state:apathy',
  far_from_myself: 'state:loss_of_self',
  emptiness_numbness: 'state:inner_emptiness',
};

// Step 2 → Theme module. love_relationships deliberately absent (product
// gap #25 — never mapped to Family); several_areas / whole_life_identity
// are breadth signals, not areas.
const THEME_BY_AREA: Partial<Record<string, RecommendedProduct>> = {
  money: 'theme:money',
  family_parents: 'theme:family',
  body_intimacy: 'theme:body',
  self_worth_shame: 'theme:shame',
  work_purpose: 'theme:self_realisation',
};

const REASON_BY_PRODUCT: Partial<Record<RecommendedProduct, string>> = {
  'state:anxiety': 'state_anxiety',
  'state:apathy': 'state_apathy',
  'state:loss_of_self': 'state_loss_of_self',
  'state:inner_emptiness': 'state_inner_emptiness',
  'theme:money': 'theme_money',
  'theme:family': 'theme_family',
  'theme:body': 'theme_body',
  'theme:shame': 'theme_shame',
  'theme:self_realisation': 'theme_self_realisation',
};

/** Soft-Journey signal: repeated pattern, several areas, or whole-life/identity. */
export function hasSoftJourneySignal(a: OnboardingAnswerInput): boolean {
  return (
    a.why === 'repeating_story' ||
    a.area === 'several_areas' ||
    a.area === 'whole_life_identity'
  );
}

// MiniMind PRIMARY reason: the user's own words decide — not-sure first
// (it is the Step 3 type answer), then the decision presenting, then talk.
function minimindPrimaryReason(a: OnboardingAnswerInput): string {
  if (a.goal === 'not_sure') return 'minimind_unsure';
  if (a.why === 'weighing_decision') return 'minimind_decision';
  return 'minimind_talk';
}

function moduleRec(product: RecommendedProduct): RankedRec {
  return { product, reasonKey: REASON_BY_PRODUCT[product]!, route: 'product' };
}

const MINIMIND_COMPANION: RankedRec = {
  product: 'minimind',
  reasonKey: 'minimind_companion',
  route: 'product',
};

const JOURNEY_SOFT: RankedRec = {
  product: 'journey',
  reasonKey: 'journey_soft',
  route: 'informed_choice',
};

/**
 * The typed routing. Returns 1–3 cards; index 0 is the PRIMARY
 * recommendation, the rest are "other options". Pure function of the
 * (normalized, v2) answers; style never affects the result.
 */
export function rankOnboardingRecommendations(a: OnboardingAnswerInput): RankedRec[] {
  const state = a.why ? STATE_BY_WHY[a.why] : undefined;
  const theme = a.area ? THEME_BY_AREA[a.area] : undefined;
  const soft = hasSoftJourneySignal(a);

  // 1. Transformation user — «Путь к себе» primary from ANY topic.
  if (a.goal === 'transformation') {
    const others: RankedRec[] = [];
    // Owner correction 1: the module most directly matching the presenting
    // request — State if Step 1 names one, else Theme; never both here.
    if (state) others.push(moduleRec(state));
    else if (theme) others.push(moduleRec(theme));
    others.push(MINIMIND_COMPANION);
    return [
      { product: 'journey', reasonKey: 'journey_primary', route: 'informed_choice' },
      ...others.slice(0, 2),
    ];
  }

  // 2. State user — relief sought AND a state named.
  if (a.goal === 'relief_now' && state) {
    const others: RankedRec[] = [MINIMIND_COMPANION];
    if (soft) others.push(JOURNEY_SOFT);
    return [moduleRec(state), ...others.slice(0, 2)];
  }

  // 3. Theme user — focused work sought AND a theme named.
  if (a.goal === 'focused_work' && theme) {
    const others: RankedRec[] = [MINIMIND_COMPANION];
    if (soft) others.push(JOURNEY_SOFT);
    return [moduleRec(theme), ...others.slice(0, 2)];
  }

  // 4. Companion user — talk_through / not_sure, and every fallback
  //    (relief without a named state, focused without a named theme,
  //    incomplete answers). MiniMind primary.
  const others: RankedRec[] = [];
  if (state) others.push(moduleRec(state));
  if (theme) others.push(moduleRec(theme));
  // Owner correction 2: soft Journey never displaces a directly matching
  // module — only when a signal exists AND fewer than two modules matched.
  if (soft && others.length < 2) others.push(JOURNEY_SOFT);
  return [
    { product: 'minimind', reasonKey: minimindPrimaryReason(a), route: 'product' },
    ...others.slice(0, 2),
  ];
}

/**
 * Does the user already have active access to this product? Owned products
 * are NOT suppressed — the dashboard shows them as "you already have access —
 * continue here" instead of a buy CTA.
 */
export function recommendationOwned(
  product: RecommendedProduct,
  products: ActiveProducts,
): boolean {
  if (product === 'minimind') {
    return products.minimindTier === 'essential' || products.minimindTier === 'extended';
  }
  if (product === 'journey') return products.journey.purchased;
  const [kind, moduleId] = product.split(':');
  const list = kind === 'state' ? products.states : products.themes;
  return list.some((m) => m.moduleId === moduleId && m.active);
}

// ---------------------------------------------------------------------------
// RECOGNITION — state-threshold rule (persisted; unchanged behaviour)
// ---------------------------------------------------------------------------

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

/**
 * May the recognition rule recommend `product` to this user right now?
 * False when: any recognition recommendation is still open (one at a time);
 * the same product is inside a decline cool-off; or the user already
 * owns/uses the product.
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
    // Recognition rules never recommend the Journey — it needs the user's
    // own informed choice, not a threshold.
    return false;
  }
  const [kind, moduleId] = product.split(':');
  const owned =
    kind === 'state'
      ? products.states.some((m) => m.moduleId === moduleId && m.active)
      : products.themes.some((m) => m.moduleId === moduleId && m.active);
  return !owned;
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
