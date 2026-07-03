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
]);

const VALID_KEYS = new Set<string>([
  'essentialMonthly',
  'essentialAnnual',
  'extendedMonthly',
  'extendedAnnual',
  'topUp',
  // The Journey — one-off £599. Payment mode, single line item. The
  // installment plan (12 × £55/month subscription) is separate and lands
  // in a follow-up PR.
  'journeyFull',
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
      ...(isSubscription && {
        subscription_data: { metadata: { clerkId: userId, priceKey } },
      }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[checkout/create]', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to create checkout session', detail }, { status: 500 });
  }
}
