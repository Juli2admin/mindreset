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
  // Subscription mode with subscription_data.cancel_at set to +12 months
  // so Stripe auto-cancels after the twelfth cycle. Access granted on the
  // first successful payment. Legacy env var STRIPE_PRICE_JOURNEY_WEEKLY
  // is kept as a fallback while owner migrates from the old weekly cadence
  // to the new monthly cadence (Journey pricing v3, PR #204).
  journeyInstallment: ['STRIPE_PRICE_JOURNEY_INSTALLMENT', 'STRIPE_PRICE_JOURNEY_WEEKLY'],
} as const;

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
