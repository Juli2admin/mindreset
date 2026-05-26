import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function priceToTier(priceId: string): 'essential' | 'extended' | null {
  if (
    priceId === process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_ESSENTIAL_ANNUAL
  ) return 'essential';
  if (
    priceId === process.env.STRIPE_PRICE_EXTENDED_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_EXTENDED_ANNUAL
  ) return 'extended';
  return null;
}

function extractCustomerId(
  src: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!src) return null;
  return typeof src === 'string' ? src : src.id;
}

// current_period_end moved from Subscription to SubscriptionItem in
// API version 2025-08-27.basil. Webhook endpoint may be on dahlia
// while the SDK types are acacia; read defensively from both.
function getPeriodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items.data[0] as
    (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  return item?.current_period_end ?? sub.current_period_end ?? null;
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const cid = extractCustomerId(sub.customer);
  if (!cid) return;
  const priceId = sub.items.data[0]?.price.id;
  const tier = priceId ? priceToTier(priceId) : null;
  const active = sub.status === 'active' || sub.status === 'trialing';
  const periodEnd = getPeriodEnd(sub);
  const willBePaid = active && tier;

  // First-cycle credit reset: when a free-tier user activates a paid
  // subscription, the prior messagesUsedThisCycle (which was the free
  // 50-message lifetime counter) must be zeroed so they get the full
  // cap they paid for. Detected by reading currentTier first; reset
  // only when transitioning from 'free' to a paid+active state.
  //
  // Mid-cycle Essential ↔ Extended preserves the counter per locked
  // decision #19 ("buying headroom, not a fresh allowance"). Top-up
  // balance is NOT touched here — top-ups are paid credits and they
  // expire only on cycle-renewal invoices per locked decision #31.
  //
  // Idempotent on Stripe retry: the second delivery reads currentTier
  // already set to the paid tier, so resetCycleCounter is false and
  // any messages the user sent between the two deliveries are not
  // wiped.
  let resetCycleCounter = false;
  if (willBePaid) {
    const existing = await prisma.user.findFirst({
      where: { stripeCustomerId: cid },
      select: { currentTier: true },
    });
    resetCycleCounter = existing?.currentTier === 'free';
  }

  await prisma.user.updateMany({
    where: { stripeCustomerId: cid },
    data: {
      stripeSubscriptionId: sub.id,
      currentTier: willBePaid ? tier : 'free',
      cycleResetAt: willBePaid && periodEnd ? new Date(periodEnd * 1000) : null,
      ...(resetCycleCounter ? { messagesUsedThisCycle: 0 } : {}),
    },
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const cid = extractCustomerId(sub.customer);
  if (!cid) return;
  // Counter is intentionally NOT reset here. If the user later re-subscribes,
  // handleSubscriptionUpsert reads currentTier === 'free' (set below) and
  // performs the first-cycle reset at that point. Preserving the counter on
  // cancellation also avoids losing data if a deletion event arrives out of
  // order with a subscription.updated event.
  await prisma.user.updateMany({
    where: { stripeCustomerId: cid },
    data: { currentTier: 'free', cycleResetAt: null },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== 'subscription_cycle') return;
  const cid = extractCustomerId(invoice.customer);
  if (!cid) return;
  // Top-ups expire at billing-period reset per spec.
  await prisma.user.updateMany({
    where: { stripeCustomerId: cid },
    data: { messagesUsedThisCycle: 0, topUpMessagesRemaining: 0 },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment') return;
  const cid = extractCustomerId(session.customer);
  if (!cid) return;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: cid },
    select: { id: true },
  });
  if (!user) {
    console.warn('[webhook] no user for customer:', cid);
    return;
  }

  // Idempotency gate: Purchase.stripeSessionId is unique. If Stripe
  // retries the event, the second create throws P2002 and we skip
  // the credit so the user does not get double-credited.
  try {
    await prisma.purchase.create({
      data: {
        userId: user.id,
        productType: 'topup',
        amount: session.amount_total ?? 499,
        currency: (session.currency ?? 'gbp').toUpperCase(),
        stripeSessionId: session.id,
        status: 'completed',
        completedAt: new Date(),
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      console.log('[webhook] already processed:', session.id);
      return;
    }
    throw err;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { topUpMessagesRemaining: { increment: 200 } },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        console.warn('[webhook] payment failed:', (event.data.object as Stripe.Invoice).id);
        break;
    }
  } catch (err) {
    console.error('[webhook] handler error:', err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
