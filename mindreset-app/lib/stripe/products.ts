// Stripe Price ID map. IDs are set in .env.local / Vercel env vars.
// Test-mode IDs (price_test_*) and live-mode IDs (price_*) are separate;
// they're selected automatically by which STRIPE_SECRET_KEY is active.

const PRICE_ENV_VARS = {
  essentialMonthly: 'STRIPE_PRICE_ESSENTIAL_MONTHLY',
  essentialAnnual:  'STRIPE_PRICE_ESSENTIAL_ANNUAL',
  extendedMonthly:  'STRIPE_PRICE_EXTENDED_MONTHLY',
  extendedAnnual:   'STRIPE_PRICE_EXTENDED_ANNUAL',
  topUp:            'STRIPE_PRICE_TOP_UP',
} as const;

export type StripePriceKey = keyof typeof PRICE_ENV_VARS;

export function getPriceId(product: StripePriceKey): string {
  const envVar = PRICE_ENV_VARS[product];
  const id = process.env[envVar];
  if (!id) throw new Error(`Stripe Price ID not configured: ${envVar}`);
  return id;
}
