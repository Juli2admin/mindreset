// State module registry.
//
// Each state is a short single-topic reset conversation. Bought individually
// (£59 non-subscriber / £29 subscriber), 30-day access, unlimited fresh
// sessions in that window.
//
// Stripe architecture: ONE product per module (£59). Subscribers get a
// shared £30 coupon (STRIPE_COUPON_MODULE) applied programmatically at
// checkout, bringing them to £29. See app/api/states/checkout/route.ts.
//
// Adding a new state module: append to STATE_MODULES + create the matching
// Stripe product + env var. No migration required — moduleId is a string
// in the DB.

export type StateModuleId = 'anxiety' | 'apathy' | 'loss_of_self' | 'inner_emptiness';

export type StateModule = {
  /** URL slug + DB identifier. */
  id: StateModuleId;
  /** Short brand-facing name (EN). Displayed in the /states catalogue. */
  name: string;
  /** One-line description shown on the catalogue tile. */
  tagline: string;
  /**
   * Env var holding the single Stripe Price ID for this module (£59).
   * Subscribers get the STRIPE_COUPON_MODULE discount applied at checkout;
   * there is no separate subscriber price.
   *
   * Note the DB slug and env-var name can diverge: `apathy` in code maps
   * to `STRIPE_PRICE_STATE_LOW_ENERGY`, `loss_of_self` → `_COME_BACK`,
   * `inner_emptiness` → `_EMPTY`. This is intentional — the code-side
   * slugs are the technical taxonomy; the env vars mirror the Stripe
   * product names as they exist in the dashboard.
   */
  priceEnv: string;
};

export const STATE_MODULES: readonly StateModule[] = [
  {
    id: 'anxiety',
    name: 'Anxiety',
    tagline: 'Steady the moment. Practices for when the wave hits.',
    priceEnv: 'STRIPE_PRICE_STATE_ANXIETY',
  },
  {
    id: 'apathy',
    name: 'Apathy',
    tagline: "The 'nothing matters' state. Micro-sparks back to life.",
    priceEnv: 'STRIPE_PRICE_STATE_LOW_ENERGY',
  },
  {
    id: 'loss_of_self',
    name: 'Loss of self',
    tagline: 'When you feel far away from yourself — gentle return practices.',
    priceEnv: 'STRIPE_PRICE_STATE_COME_BACK',
  },
  {
    id: 'inner_emptiness',
    name: 'Inner emptiness',
    tagline: 'The grey filter. A first breath of warmth back inside.',
    priceEnv: 'STRIPE_PRICE_STATE_EMPTY',
  },
];

export const STATE_MODULE_IDS: readonly StateModuleId[] = STATE_MODULES.map(
  (m) => m.id,
);

export function getStateModule(id: string): StateModule | null {
  return STATE_MODULES.find((m) => m.id === id) ?? null;
}

export function isValidStateModuleId(id: string): id is StateModuleId {
  return STATE_MODULES.some((m) => m.id === id);
}

/** Access duration granted by one purchase (30 days). */
export const STATE_ACCESS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Price in pence shown in the UI (for display only — Stripe is the
 * source of truth). PR χ0 (2026-07-13): flattened to a single £29 price
 * for all buyers. Removed the £59 non-subscriber tier and the
 * subscriber-only discount.
 */
export const STATE_PRICE_PENCE = 2900;

/**
 * Env var holding the Stripe Coupon ID for the £30 module discount.
 * PR χ0 (2026-07-13): applied to EVERY State-module checkout — the
 * Stripe products stay at £59 face and the coupon brings the total
 * to £29 for all buyers, so no subscriber gate remains. When Julia
 * has time to reprice the Stripe products to £29 directly, this
 * coupon becomes a no-op.
 */
export const STATE_MODULE_COUPON_ENV = 'STRIPE_COUPON_MODULE';
