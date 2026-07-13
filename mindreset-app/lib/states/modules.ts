// State module registry.
//
// Each state is a short single-topic reset conversation. Bought individually
// (£59 non-subscriber / £29 subscriber), 30-day access, unlimited fresh
// sessions in that window.
//
// Adding a new state module: append to STATE_MODULES + create the matching
// Stripe products (see docs/implementation/states-themes-plan.md). No
// migration required — moduleId is a string in the DB.

export type StateModuleId = 'anxiety' | 'apathy' | 'loss_of_self' | 'inner_emptiness';

export type StateModule = {
  /** URL slug + DB identifier. */
  id: StateModuleId;
  /** Short brand-facing name (EN). Displayed in the /states catalogue. */
  name: string;
  /** One-line description shown on the catalogue tile. */
  tagline: string;
  /** Env var name for the full (non-subscriber) £59 price. */
  fullPriceEnv: string;
  /** Env var name for the £29 subscriber price. */
  subscriberPriceEnv: string;
};

export const STATE_MODULES: readonly StateModule[] = [
  {
    id: 'anxiety',
    name: 'Anxiety',
    tagline: 'Steady the moment. Practices for when the wave hits.',
    fullPriceEnv: 'STRIPE_PRICE_STATE_ANXIETY_FULL',
    subscriberPriceEnv: 'STRIPE_PRICE_STATE_ANXIETY_SUBSCRIBER',
  },
  {
    id: 'apathy',
    name: 'Apathy',
    tagline: "The 'nothing matters' state. Micro-sparks back to life.",
    fullPriceEnv: 'STRIPE_PRICE_STATE_APATHY_FULL',
    subscriberPriceEnv: 'STRIPE_PRICE_STATE_APATHY_SUBSCRIBER',
  },
  {
    id: 'loss_of_self',
    name: 'Loss of self',
    tagline: 'When you feel far away from yourself — gentle return practices.',
    fullPriceEnv: 'STRIPE_PRICE_STATE_LOSS_OF_SELF_FULL',
    subscriberPriceEnv: 'STRIPE_PRICE_STATE_LOSS_OF_SELF_SUBSCRIBER',
  },
  {
    id: 'inner_emptiness',
    name: 'Inner emptiness',
    tagline: 'The grey filter. A first breath of warmth back inside.',
    fullPriceEnv: 'STRIPE_PRICE_STATE_INNER_EMPTINESS_FULL',
    subscriberPriceEnv: 'STRIPE_PRICE_STATE_INNER_EMPTINESS_SUBSCRIBER',
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

/** Base prices in pence (for display only — Stripe is the source of truth). */
export const STATE_PRICE_FULL_PENCE = 5900;
export const STATE_PRICE_SUBSCRIBER_PENCE = 2900;
