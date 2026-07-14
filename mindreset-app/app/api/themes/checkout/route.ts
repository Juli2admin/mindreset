// Theme-module checkout endpoint.
//
// PR χ1 (2026-07-13). POST { moduleId } — creates a Stripe checkout
// session for the given theme module. £59 flat, no subscriber discount.
// Unlike the State-module checkout, no coupon is applied — the Stripe
// product is priced directly at £59.
//
// Access-window semantics: on checkout.session.completed the Stripe
// webhook creates a Purchase row with productType='theme_module' and
// accessExpiresAt = now + 30 days. See lib/themes/access.ts for the
// gate that reads this.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe/client';
import { getPriceId, type StripePriceKey } from '@/lib/stripe/products';
import {
  getThemeModule,
  isValidThemeModuleId,
} from '@/lib/themes/modules';

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
  if (!moduleId || !isValidThemeModuleId(moduleId)) {
    return NextResponse.json({ error: 'Invalid moduleId' }, { status: 400 });
  }
  const mod = getThemeModule(moduleId);
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

  const priceKey = `theme_${moduleId}` as StripePriceKey;

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
      allow_promotion_codes: true,
      success_url: `${origin}/${locale}/themes/${moduleId}?checkout=success`,
      cancel_url: `${origin}/${locale}/themes`,
      billing_address_collection: 'required',
      automatic_tax: { enabled: false },
      metadata: {
        clerkId: userId,
        productType: 'theme_module',
        moduleId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[themes/checkout] create failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to create checkout session', detail },
      { status: 500 },
    );
  }
}
