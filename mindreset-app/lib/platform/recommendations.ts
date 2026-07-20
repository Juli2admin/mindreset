// Platform recommendation rules (2026-07-20).
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
// Orientation product logic is the owner's exact spec (2026-07-20). It is a
// STATED-REQUEST engine, not a diagnosis engine: a product is recommended
// only from what the user directly said, never from an inferred hidden
// cause. Hard rules baked in below:
//   - MiniMind is in every result set (base 1; priority 3 for unclear /
//     curious / decision requests). max, not sum.
//   - States/Themes accumulate, and only from a direct matching request.
//   - relationships NEVER maps to Family; confidence NEVER auto-maps to
//     Shame; career NEVER auto-maps to Self-Realisation — each needs a
//     qualifying second answer.
//   - The Journey requires >=2 DISTINCT signal categories (never one
//     isolated answer) and routes to the informed-choice page, never checkout.
//   - Body and Inner-emptiness have NO onboarding mapping by construction.

import prisma from '@/lib/prisma';
import { getActiveProducts, recordRecommendation } from './profile';
import type { ActiveProducts } from './types';

export type RuleRecommendation = { product: string; ruleKey: string };

// Products the ORIENTATION engine can rank. Note the absentees:
//   - state:inner_emptiness → recognition-only (3-in-7), no onboarding signal
//   - theme:body ("Body and Sexuality") → catalogue-only; onboarding never
//     asks about the body, so it can never be produced here.
export type RecommendedProduct =
  | 'minimind'
  | 'state:anxiety'
  | 'state:apathy'
  | 'state:loss_of_self'
  | 'theme:money'
  | 'theme:family'
  | 'theme:self_realisation'
  | 'theme:shame'
  | 'journey';

export type JourneySignal =
  | 'loss_of_self'
  | 'repeating_patterns'
  | 'authenticity'
  | 'multi_domain'
  | 'identity_direction';

// Loose answer shape: the projection hands us nullable strings. We compare
// against code literals, so string|null is exactly right here.
export type OnboardingAnswerInput = {
  why?: string | null;
  area?: string | null;
  style?: string | null;
  goal?: string | null;
};

export type RankedRec = {
  product: RecommendedProduct;
  score: number;
  reasonKey: string; // -> Dashboard.reason_<reasonKey>
  route: 'product' | 'informed_choice'; // journey -> informed_choice, never checkout
};

// Every reason key the ORIENTATION engine can emit. The dashboard i18n
// coverage test walks this list — a new key without localised copy in BOTH
// native bundles fails CI before it can render as a raw key to a user.
export const ONBOARDING_REASON_KEYS = [
  'minimind_explore',
  'minimind_decision',
  'minimind_unsure',
  'state_loss_of_self',
  'state_apathy',
  'state_anxiety',
  'theme_money',
  'theme_family',
  'theme_self_realisation',
  'theme_shame',
  'journey_multi',
] as const;

// ---------------------------------------------------------------------------
// ORIENTATION — pure, stateless scoring (owner spec 2026-07-20)
// ---------------------------------------------------------------------------

// No WHY or GOAL code currently names family / parental expectations, so the
// boundaries_pleasing -> family +2 branch below is a documented dead branch:
// it activates only if such a code is ever added. Kept for spec fidelity.
function referencesFamily(_why?: string | null, _goal?: string | null): boolean {
  return false;
}

/**
 * Score all four answers into: a MiniMind level, per-product accumulated
 * scores (States/Themes), and the DISTINCT Journey-signal set. Step 3
 * (style) contributes NOTHING to scoring — it personalises the entry only.
 */
export function scoreOnboarding(a: OnboardingAnswerInput): {
  minimind: number;
  products: Map<RecommendedProduct, number>;
  journeySignals: Set<JourneySignal>;
} {
  const { why, area, goal } = a; // style intentionally ignored for scoring

  // MiniMind is a LEVEL (base 1, priority up to 3), not an accumulation.
  let minimind = 1;
  const bump = (n: number) => {
    if (n > minimind) minimind = n;
  };

  // States/Themes ACCUMULATE (a signal in two steps sums).
  const products = new Map<RecommendedProduct, number>();
  const add = (p: RecommendedProduct, n: number) =>
    products.set(p, (products.get(p) ?? 0) + n);

  const journey = new Set<JourneySignal>();

  // ---- STEP 1 · WHY ARE YOU HERE TODAY? ----
  switch (why) {
    case 'lost_myself':
      bump(1);
      add('state:loss_of_self', 3);
      journey.add('loss_of_self');
      break;
    case 'repeating_patterns':
      bump(1);
      journey.add('repeating_patterns');
      break;
    case 'dont_know_what_i_want':
      bump(2);
      journey.add('identity_direction');
      break;
    case 'difficult_decision':
      bump(3); // MiniMind only
      break;
    case 'relationships_not_working':
      bump(2); // NOT family; Journey only via other categories
      break;
    case 'understand_reactions':
      bump(2); // anxiety only if Step 2/4 also refer to it (handled there)
      break;
    case 'stuck':
      bump(1);
      add('state:apathy', 3);
      break;
    case 'curious':
      bump(3); // MiniMind only
      break;
  }

  // ---- STEP 2 · WHERE IS THIS SHOWING UP MOST? ----
  switch (area) {
    case 'relationships':
      bump(2); // NOT family — product gap recorded in open-questions.md
      break;
    case 'career_purpose':
      bump(1);
      if (
        goal === 'whats_holding_me_back' ||
        goal === 'mine_vs_expected' ||
        goal === 'feel_like_myself' ||
        goal === 'what_no_longer_fits'
      ) {
        add('theme:self_realisation', 3); // only with a qualifying goal
      }
      break;
    case 'confidence_worth':
      bump(2);
      if (
        goal === 'whats_holding_me_back' ||
        goal === 'understand_reactions' ||
        goal === 'mine_vs_expected'
      ) {
        add('theme:shame', 2); // only with a qualifying goal
      }
      break;
    case 'family':
      bump(1);
      add('theme:family', 3);
      break;
    case 'money':
      bump(1);
      add('theme:money', 3);
      break;
    case 'boundaries_pleasing':
      bump(2);
      if (goal === 'mine_vs_expected') journey.add('authenticity');
      if (referencesFamily(why, goal)) add('theme:family', 2); // dead branch today
      break;
    case 'emotional_reactions':
      bump(1);
      add('state:anxiety', 3);
      break;
    case 'several_areas':
      bump(1);
      journey.add('multi_domain');
      break;
  }

  // ---- STEP 4 · WHAT WOULD MAKE THIS CONVERSATION MOST USEFUL? ----
  switch (goal) {
    case 'whats_holding_me_back':
      bump(1);
      if (area === 'career_purpose') add('theme:self_realisation', 2);
      if (why === 'stuck') add('state:apathy', 1);
      break;
    case 'decision_clarity':
      bump(3); // MiniMind only
      break;
    case 'why_repeating_patterns':
      bump(1);
      journey.add('repeating_patterns');
      break;
    case 'mine_vs_expected':
      bump(1);
      add('theme:self_realisation', 3);
      journey.add('authenticity');
      break;
    case 'feel_like_myself':
      bump(1);
      add('state:loss_of_self', 3);
      journey.add('loss_of_self');
      break;
    case 'understand_reactions':
      bump(1);
      add('state:anxiety', 3);
      break;
    case 'what_no_longer_fits':
      bump(1);
      add('theme:self_realisation', 3);
      journey.add('authenticity');
      break;
    case 'not_sure':
      bump(3); // MiniMind only
      break;
  }

  return { minimind, products, journeySignals: journey };
}

/**
 * The Journey qualifies ONLY with >=2 DISTINCT signal categories — the same
 * category twice counts once (a Set dedupes it). Score = distinct count × 2.
 * null = does not qualify.
 */
export function journeyScore(signals: Set<JourneySignal>): number | null {
  if (signals.size < 2) return null;
  return signals.size * 2;
}

// Fixed tie-break (the spec ranks by score; this only breaks ties): deepest
// first, MiniMind last. Affects display order among already-chosen cards and
// the rare 2nd/3rd-slot tie — never whether MiniMind appears.
const PRIORITY: Record<RecommendedProduct, number> = {
  journey: 0,
  'state:loss_of_self': 1,
  'state:apathy': 1,
  'state:anxiety': 1,
  'theme:money': 2,
  'theme:family': 2,
  'theme:self_realisation': 2,
  'theme:shame': 2,
  minimind: 3,
};

function reasonKeyForProduct(p: RecommendedProduct): string {
  switch (p) {
    case 'state:loss_of_self':
      return 'state_loss_of_self';
    case 'state:apathy':
      return 'state_apathy';
    case 'state:anxiety':
      return 'state_anxiety';
    case 'theme:money':
      return 'theme_money';
    case 'theme:family':
      return 'theme_family';
    case 'theme:self_realisation':
      return 'theme_self_realisation';
    case 'theme:shame':
      return 'theme_shame';
    case 'journey':
      return 'journey_multi';
    case 'minimind':
      return 'minimind_explore';
  }
}

// MiniMind reason variant — priority: decision -> unsure -> explore.
function minimindReasonKey(a: OnboardingAnswerInput): string {
  if (a.why === 'difficult_decision' || a.goal === 'decision_clarity')
    return 'minimind_decision';
  if (a.why === 'dont_know_what_i_want' || a.goal === 'not_sure')
    return 'minimind_unsure';
  return 'minimind_explore';
}

/**
 * The ranked "Recommended starting points": MiniMind (always) + up to two
 * highest-scoring other products. 1–3 cards. No arbitrary fallback — when
 * nothing else qualifies, MiniMind alone is the honest answer.
 */
export function rankOnboardingRecommendations(a: OnboardingAnswerInput): RankedRec[] {
  const { minimind, products, journeySignals } = scoreOnboarding(a);

  const others: RankedRec[] = [];
  for (const [product, score] of Array.from(products.entries())) {
    if (score > 0) {
      others.push({ product, score, reasonKey: reasonKeyForProduct(product), route: 'product' });
    }
  }
  const js = journeyScore(journeySignals);
  if (js !== null) {
    others.push({ product: 'journey', score: js, reasonKey: 'journey_multi', route: 'informed_choice' });
  }

  others.sort((x, y) => y.score - x.score || PRIORITY[x.product] - PRIORITY[y.product]);

  const mm: RankedRec = {
    product: 'minimind',
    score: minimind,
    reasonKey: minimindReasonKey(a),
    route: 'product',
  };

  // MiniMind is ALWAYS present, even when it ranks third.
  const set = [...others.slice(0, 2), mm];
  set.sort((x, y) => y.score - x.score || PRIORITY[x.product] - PRIORITY[y.product]);
  return set;
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
