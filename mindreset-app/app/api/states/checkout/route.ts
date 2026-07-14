// State-module checkout endpoint.
//
// POST { moduleId } — creates a Stripe checkout session for the given
// state module.
//
// PR χ0 (2026-07-13). Flat £29 for all readers, no subscriber gate.
// Stripe products stay at £59 (unchanged in the dashboard);
// STRIPE_COUPON_MODULE is applied to every checkout to bring the
// total to £29. When Julia has time to reprice the Stripe products
// to £29 directly, the coupon call becomes a no-op and can be
// removed; nothing else changes.
//
// Access-window semantics: on checkout.session.completed the Stripe
// webhook creates a Purchase row with accessExpiresAt = now + 30 days.
// See lib/states/access.ts for the gate that reads this.
//
// Refund policy — non-refundable after 14 days OR after the module is
// first opened, whichever comes first. Docs: block-b-stripe-plan.md.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe/client';
import { getPriceId } from '@/lib/stripe/products';
import {
  getStateModule,
  isValidStateModuleId,
  STATE_MODULE_COUPON_ENV,
} from '@/lib/states/modules';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { moduleId?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const moduleId = body.moduleId;
  if (!moduleId || !isValidStateModuleId(moduleId)) {
    return NextResponse.json({ error: 'Invalid moduleId' }, { status: 400 });
  }
  const mod = getStateModule(moduleId);
  if (!mod) {
    return NextResponse.json({ error: 'Invalid moduleId' }, { status: 400 });
  }
  const locale = body.locale === 'ru' ? 'ru' : 'en';

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      stripeCustomerId: true,
      deletedAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (user.deletedAt) {
    return NextResponse.json(
      { error: 'account_scheduled_for_deletion' },
      { status: 403 },
    );
  }

  const priceKey = `state_${moduleId}` as const;

  // The module coupon is applied to every buyer (£30 off → £29). Fails
  // closed if the env var is missing so we never silently charge the
  // £59 face price. Stripe rejects `allow_promotion_codes: true`
  // together with `discounts`, so we lose manual promo-code entry —
  // fine given £29 is already the intended price.
  const moduleCoupon = process.env[STATE_MODULE_COUPON_ENV];
  if (!moduleCoupon) {
    console.error(
      `[states/checkout] ${STATE_MODULE_COUPON_ENV} not set — buyer ` +
        'would be charged the full £59. Refusing to proceed.',
    );
    return NextResponse.json(
      { error: 'Module discount coupon not configured' },
      { status: 500 },
    );
  }

  const origin =
    request.headers.get('origin') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  try {
    let customerId: string | undefined = user.stripeCustomerId ?? undefined;
    if (!customerId && user.email) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { clerkId: userId },
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
      line_items: [{ price: getPriceId(priceKey), quantity: 1 }],
      discounts: [{ coupon: moduleCoupon }],
      success_url: `${origin}/${locale}/states/${moduleId}?checkout=success`,
      cancel_url: `${origin}/${locale}/states`,
      billing_address_collection: 'required',
      automatic_tax: { enabled: false },
      metadata: {
        clerkId: userId,
        productType: 'state_module',
        moduleId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[states/checkout] create failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to create checkout session', detail },
      { status: 500 },
    );
  }
}
