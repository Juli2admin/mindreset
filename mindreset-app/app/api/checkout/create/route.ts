import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe/client';
import { getPriceId, type StripePriceKey } from '@/lib/stripe/products';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SUBSCRIPTION_KEYS = new Set<StripePriceKey>([
  'essentialMonthly',
  'essentialAnnual',
  'extendedMonthly',
  'extendedAnnual',
  // The Journey installment plan: 12 × £55/month, auto-cancels via
  // subscription_data.cancel_at after the twelfth cycle. Subscription
  // mode but NOT a MiniMind tier — webhook distinguishes by priceKey.
  'journeyInstallment',
]);

const VALID_KEYS = new Set<string>([
  'essentialMonthly',
  'essentialAnnual',
  'extendedMonthly',
  'extendedAnnual',
  'topUp',
  'journeyFull',        // one-off £599, payment mode
  'journeyInstallment', // 12 × £55/month, subscription mode with cancel_at
]);

// The Journey installment plan is 12 monthly cycles then auto-cancel.
// Stripe honours subscription_data.cancel_at (Unix seconds) to schedule
// the cancellation at checkout-session-creation time. 12 × 30 days ≈ 365
// days; we use 365 exactly so a month with fewer than 30 days doesn't
// cut the plan short.
const JOURNEY_INSTALLMENT_DURATION_SECONDS = 365 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { priceKey?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { priceKey, locale = 'en' } = body;

  if (!priceKey || !VALID_KEYS.has(priceKey)) {
    return NextResponse.json({ error: 'Invalid price key' }, { status: 400 });
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Retrieve existing Stripe Customer or create one
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { clerkId: userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });
    }

    const typedKey = priceKey as StripePriceKey;
    const isSubscription = SUBSCRIPTION_KEYS.has(typedKey);

    // Journey installment: schedule auto-cancel after 12 monthly cycles.
    // Any other subscription: run indefinitely until user cancels.
    const isJourneyInstallment = typedKey === 'journeyInstallment';
    const subscriptionData = isSubscription
      ? {
          metadata: { clerkId: userId, priceKey },
          ...(isJourneyInstallment && {
            cancel_at: Math.floor(Date.now() / 1000) + JOURNEY_INSTALLMENT_DURATION_SECONDS,
          }),
        }
      : undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: [{ price: getPriceId(typedKey), quantity: 1 }],
      success_url: `${origin}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/pricing`,
      billing_address_collection: 'required',
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
      metadata: { clerkId: userId, priceKey },
      ...(subscriptionData && { subscription_data: subscriptionData }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[checkout/create]', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to create checkout session', detail }, { status: 500 });
  }
}
