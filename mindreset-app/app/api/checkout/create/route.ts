import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe/client';
import { getPriceId, type StripePriceKey } from '@/lib/stripe/products';
// JOURNEY_INSTALLMENT_DURATION_SECONDS now lives in lib/stripe/products
// and is applied via stripe.subscriptions.update in the webhook, not here.
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

    // Guard against double-purchasing The Journey. Both journeyFull
    // (£599 one-off) and journeyInstallment (12 × £55/month) grant
    // the same access via a completed Purchase(productType: 'recode').
    // A user with an existing recode Purchase gains nothing by buying
    // again — /journey uses findFirst as the access gate — but a
    // second checkout charges them again (double subscription =
    // £110/month instead of £55). Refuse with 409 Conflict.
    //
    // Load-bearing: the /pricing page also hides these buttons
    // client-side for owners, but a stale client or direct POST could
    // still hit this endpoint. Server refusal is the true guarantee.
    if (priceKey === 'journeyFull' || priceKey === 'journeyInstallment') {
      const existing = await prisma.purchase.findFirst({
        where: {
          userId: user.id,
          productType: 'recode',
          status: 'completed',
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'The Journey has already been purchased on this account' },
          { status: 409 },
        );
      }
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

    // Journey installment auto-cancel after 12 cycles is set on the
    // Subscription via stripe.subscriptions.update in the webhook handler
    // AFTER the subscription is created — cancel_at is NOT a valid field
    // on checkout.sessions.create's subscription_data (this was the bug
    // that returned 500 for the £55 button on 2026-07-03; verified against
    // Stripe SDK types at node_modules/stripe/types/Checkout/
    // SessionsResource.d.ts SubscriptionData interface).
    //
    // See handleCheckoutCompleted in the Stripe webhook route for the
    // cancel_at wiring.
    const subscriptionData = isSubscription
      ? { metadata: { clerkId: userId, priceKey } }
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
