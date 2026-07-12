// Pilot → paid Journey upgrade checkout.
//
// Called by the "Continue with 50% off" button on the "Pilot ended"
// screen. Creates a Stripe checkout session for the £599 Journey full
// one-off, with the pilot 50% coupon auto-applied (net £299.50).
//
// Access rules:
//   - User must be authenticated
//   - User must have redeemed a PilotInvitation (pilotInvitationId set)
//   - Trial must be naturally expired (pilotTrialEndsAt in the past)
//   - Invitation must NOT be revoked (revoked testers don't get the offer)
//   - STRIPE_COUPON_PILOT_50 env var must be set
//
// The Stripe webhook already handles checkout.session.completed for
// journeyFull — it creates a completed recode Purchase(amount=59900).
// checkJourneyAccess prefers the paid Purchase (amount > 0) over the
// original pilot Purchase (amount = 0), so the user's access
// automatically switches to the normal 1-year window.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe/client';
import { getPriceId } from '@/lib/stripe/products';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const locale = body.locale === 'ru' ? 'ru' : 'en';

  const couponId = process.env.STRIPE_COUPON_PILOT_50;
  if (!couponId) {
    console.error('[pilot/upgrade] STRIPE_COUPON_PILOT_50 env var not set');
    return NextResponse.json(
      { error: 'Pilot upgrade offer not configured' },
      { status: 500 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      stripeCustomerId: true,
      pilotInvitationId: true,
      pilotTrialEndsAt: true,
      pilotInvitation: {
        select: { revokedAt: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!user.pilotInvitationId) {
    return NextResponse.json(
      { error: 'This offer is only available to pilot testers.' },
      { status: 403 },
    );
  }
  if (user.pilotInvitation?.revokedAt) {
    return NextResponse.json(
      { error: 'Your pilot access has been closed. Please contact support.' },
      { status: 403 },
    );
  }
  if (!user.pilotTrialEndsAt || user.pilotTrialEndsAt.getTime() > Date.now()) {
    return NextResponse.json(
      { error: 'This offer becomes available when your trial ends.' },
      { status: 403 },
    );
  }

  const origin =
    request.headers.get('origin') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  try {
    // Reuse Stripe customer if present; otherwise Stripe will create one
    // and the webhook will attach the id via handleCheckoutCompleted.
    let customerId: string | undefined = user.stripeCustomerId ?? undefined;
    if (!customerId && user.email) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { clerkId: userId, pilotUpgrade: 'true' },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: getPriceId('journeyFull'), quantity: 1 }],
      // Coupon is applied server-side — the user cannot swap it for
      // a different code at checkout, so allow_promotion_codes stays false.
      discounts: [{ coupon: couponId }],
      allow_promotion_codes: false,
      success_url: `${origin}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/journey`,
      billing_address_collection: 'required',
      automatic_tax: { enabled: false },
      metadata: {
        clerkId: userId,
        priceKey: 'journeyFull',
        pilotUpgrade: 'true',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[pilot/upgrade] checkout create failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to create checkout session', detail },
      { status: 500 },
    );
  }
}
