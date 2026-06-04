import Stripe from 'stripe';

// Lazy Stripe client. Constructing at module-import time made the
// Vercel build collect-page-data phase throw on Preview deploys when
// STRIPE_SECRET_KEY isn't set there (it's Production-only in our env
// config). Deferring the check to first use lets the build succeed on
// any environment; the throw only happens at request time, where it
// belongs.

let cached: Stripe | null = null;

function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  cached = new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });
  return cached;
}

// Proxy keeps the existing `import { stripe } from '@/lib/stripe/client'`
// call sites working unchanged. Stripe SDK methods are property accesses
// (stripe.checkout.sessions.create, etc.) — the Proxy intercepts the
// first one, lazily constructs the real client, and forwards.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});
