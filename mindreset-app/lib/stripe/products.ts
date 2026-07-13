// Stripe Price ID map. IDs are set in .env.local / Vercel env vars.
// Test-mode IDs (price_test_*) and live-mode IDs (price_*) are separate;
// they're selected automatically by which STRIPE_SECRET_KEY is active.

// Canonical env-var name per docs/operations/launch-cutover.md §1.2 and
// docs/implementation/block-b-stripe-plan.md. The legacy STRIPE_PRICE_TOP_UP
// (underscore-before-UP) was the original code-side name; supported as a
// fallback so test-mode envs that still use the legacy name don't break.
// Remove the fallback once Vercel env has been renamed in both
// Preview and Production.
const PRICE_ENV_VARS = {
  essentialMonthly: ['STRIPE_PRICE_ESSENTIAL_MONTHLY'],
  essentialAnnual:  ['STRIPE_PRICE_ESSENTIAL_ANNUAL'],
  extendedMonthly:  ['STRIPE_PRICE_EXTENDED_MONTHLY'],
  extendedAnnual:   ['STRIPE_PRICE_EXTENDED_ANNUAL'],
  topUp:            ['STRIPE_PRICE_TOPUP', 'STRIPE_PRICE_TOP_UP'],
  // The Journey — one-off £599, 1 year of access from first-block-accessed.
  // Payment mode (mode: 'payment'), non-refundable once first block accessed.
  journeyFull:      ['STRIPE_PRICE_JOURNEY_FULL'],
  // The Journey — installment plan: 12 × £55/month = £660 over 12 months.
  // Subscription mode. Access granted on the first successful payment.
  // Auto-cancel after 12 cycles is set on the Subscription via
  // stripe.subscriptions.update in the webhook handler (cancel_at is NOT
  // a valid field on checkout.sessions.create's subscription_data).
  // Legacy env var STRIPE_PRICE_JOURNEY_WEEKLY is kept as a fallback
  // while owner migrates from the old weekly cadence to the new monthly
  // cadence (Journey pricing v3, PR #204).
  journeyInstallment: ['STRIPE_PRICE_JOURNEY_INSTALLMENT', 'STRIPE_PRICE_JOURNEY_WEEKLY'],

  // State modules — 30-day access, £59 non-subscriber / £29 subscriber.
  // ONE product per state; subscribers get STRIPE_COUPON_MODULE (£30 off)
  // applied at checkout. Env-var slugs mirror the Stripe dashboard product
  // names, which differ from the code-side moduleId (apathy → LOW_ENERGY,
  // loss_of_self → COME_BACK, inner_emptiness → EMPTY). See
  // lib/states/modules.ts::STATE_MODULES for the mapping.
  state_anxiety:         ['STRIPE_PRICE_STATE_ANXIETY'],
  state_apathy:          ['STRIPE_PRICE_STATE_LOW_ENERGY'],
  state_loss_of_self:    ['STRIPE_PRICE_STATE_COME_BACK'],
  state_inner_emptiness: ['STRIPE_PRICE_STATE_EMPTY'],
} as const;

/**
 * How long the Journey installment subscription runs before auto-cancel.
 * Applied via stripe.subscriptions.update({cancel_at}) in the webhook
 * after the subscription is created. 365 days = 12 monthly cycles,
 * matches the 1-year access period.
 */
export const JOURNEY_INSTALLMENT_DURATION_SECONDS = 365 * 24 * 60 * 60;

export type StripePriceKey = keyof typeof PRICE_ENV_VARS;

export function getPriceId(product: StripePriceKey): string {
  const candidates = PRICE_ENV_VARS[product];
  for (const envVar of candidates) {
    const id = process.env[envVar];
    if (id) return id;
  }
  throw new Error(
    `Stripe Price ID not configured: tried ${candidates.join(', ')}`,
  );
}
