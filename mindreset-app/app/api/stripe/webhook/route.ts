import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { waitUntil } from '@vercel/functions';
import { stripe } from '@/lib/stripe/client';
import prisma from '@/lib/prisma';
import {
  sendSubscriptionConfirmed,
  sendSubscriptionCancelled,
  sendPaymentFailed,
} from '@/lib/email/sendSubscriptionLifecycle';

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

  // Journey installment subscriptions run through the same webhook events
  // as MiniMind tier subscriptions, but they must NOT touch the User's
  // MiniMind tier or cycleResetAt. Detect Journey by priceKey metadata
  // (set at checkout-create time) OR by matching the Journey installment
  // price ID directly (belt-and-braces for events without metadata).
  const metaPriceKey = sub.metadata?.priceKey;
  const journeyInstallmentPriceIds = [
    process.env.STRIPE_PRICE_JOURNEY_INSTALLMENT,
    process.env.STRIPE_PRICE_JOURNEY_WEEKLY,
  ].filter(Boolean);
  const isJourneySubscription =
    metaPriceKey === 'journeyInstallment' ||
    (priceId != null && journeyInstallmentPriceIds.includes(priceId));
  if (isJourneySubscription) {
    // No MiniMind tier / cycleResetAt / stripeSubscriptionId changes for
    // Journey. The recode Purchase row (created in handleCheckoutCompleted)
    // is what grants /journey access; nothing on the User row changes.
    return;
  }

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
  let isFirstActivation = false;
  if (willBePaid) {
    const existing = await prisma.user.findFirst({
      where: { stripeCustomerId: cid },
      select: { currentTier: true },
    });
    isFirstActivation = existing?.currentTier === 'free';
  }

  await prisma.user.updateMany({
    where: { stripeCustomerId: cid },
    data: {
      stripeSubscriptionId: sub.id,
      currentTier: willBePaid ? tier : 'free',
      cycleResetAt: willBePaid && periodEnd ? new Date(periodEnd * 1000) : null,
      ...(isFirstActivation ? { messagesUsedThisCycle: 0 } : {}),
    },
  });

  // Confirmation email — only on first activation from free → paid,
  // NOT on every subscription.updated event. Fire via waitUntil so the
  // webhook response isn't blocked on Resend latency.
  if (isFirstActivation && tier) {
    const u = await prisma.user.findFirst({
      where: { stripeCustomerId: cid },
      select: { email: true, locale: true },
    });
    if (u?.email) {
      waitUntil(
        sendSubscriptionConfirmed({
          to: u.email,
          userLocale: u.locale,
          tier,
        }),
      );
    }
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const cid = extractCustomerId(sub.customer);
  if (!cid) return;

  // Same Journey guard as handleSubscriptionUpsert: don't demote MiniMind
  // tier when a Journey installment subscription ends (12 cycles complete
  // or user cancelled early). Access to /journey is granted by the
  // Purchase row, not by the User row; we intentionally do NOT revoke
  // access on subscription end for launch (per owner spec: "access ends
  // at the last paid month"). Access revocation is a follow-up feature.
  const priceId = sub.items.data[0]?.price.id;
  const metaPriceKey = sub.metadata?.priceKey;
  const journeyInstallmentPriceIds = [
    process.env.STRIPE_PRICE_JOURNEY_INSTALLMENT,
    process.env.STRIPE_PRICE_JOURNEY_WEEKLY,
  ].filter(Boolean);
  const isJourneySubscription =
    metaPriceKey === 'journeyInstallment' ||
    (priceId != null && journeyInstallmentPriceIds.includes(priceId));
  if (isJourneySubscription) {
    return;
  }

  // Counter is intentionally NOT reset here. If the user later re-subscribes,
  // handleSubscriptionUpsert reads currentTier === 'free' (set below) and
  // performs the first-cycle reset at that point. Preserving the counter on
  // cancellation also avoids losing data if a deletion event arrives out of
  // order with a subscription.updated event.
  await prisma.user.updateMany({
    where: { stripeCustomerId: cid },
    data: { currentTier: 'free', cycleResetAt: null },
  });

  // Cancellation email — fire via waitUntil. Period-end timestamp comes
  // from the subscription object so we can tell the user the exact date
  // their access ends.
  const u = await prisma.user.findFirst({
    where: { stripeCustomerId: cid },
    select: { email: true, locale: true },
  });
  if (u?.email) {
    const periodEnd = getPeriodEnd(sub);
    waitUntil(
      sendSubscriptionCancelled({
        to: u.email,
        userLocale: u.locale,
        periodEndSeconds: periodEnd,
      }),
    );
  }
}

// Payment failure: immediately revoke paid access (locked decision —
// no free-grace-period). The user's currentTier is flipped to 'free'
// and cycleResetAt cleared; the existing billing-cap check in the
// chat route then blocks any further messages (former subscribers
// have lifetimeMessagesUsed > 50). If Stripe later retries the
// payment successfully, customer.subscription.updated fires and
// handleSubscriptionUpsert restores paid tier automatically.
//
// Top-up balance is preserved — those messages were paid for
// separately and stay available even during the pause.
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const cid = extractCustomerId(invoice.customer);
  if (!cid) return;

  await prisma.user.updateMany({
    where: { stripeCustomerId: cid, currentTier: { not: 'free' } },
    data: { currentTier: 'free', cycleResetAt: null },
  });

  const u = await prisma.user.findFirst({
    where: { stripeCustomerId: cid },
    select: { email: true, locale: true },
  });
  if (u?.email) {
    waitUntil(
      sendPaymentFailed({
        to: u.email,
        userLocale: u.locale,
      }),
    );
  }
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

function isP2002(err: unknown): boolean {
  return !!(err && typeof err === 'object' && 'code' in err && err.code === 'P2002');
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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

  // Subscription mode covers two products distinguished by priceKey:
  //   - MiniMind Essential/Extended: audit-trail Purchase row (tier is
  //     owned by handleSubscriptionUpsert, not this record)
  //   - Journey installment: 12 × £55/month, auto-cancels at 12 months
  //     via subscription_data.cancel_at. Creates the recode Purchase row
  //     that gates access at /journey. No MiniMind tier changes.
  // Idempotent on stripeSessionId.
  if (session.mode === 'subscription') {
    const subPriceKey = (session.metadata?.priceKey ?? 'minimind_sub') as string;
    const isJourneyInstallment = subPriceKey === 'journeyInstallment';

    try {
      await prisma.purchase.create({
        data: {
          userId: user.id,
          productType: isJourneyInstallment ? 'recode' : 'minimind_sub',
          amount: session.amount_total ?? 0,
          currency: (session.currency ?? 'gbp').toUpperCase(),
          stripeSessionId: session.id,
          status: 'completed',
          completedAt: new Date(),
        },
      });
    } catch (err) {
      if (isP2002(err)) {
        console.log(
          isJourneyInstallment
            ? '[webhook] journey installment purchase already recorded:'
            : '[webhook] subscription purchase already recorded:',
          session.id,
        );
        return;
      }
      throw err;
    }
    return;
  }

  // Payment mode covers two products distinguished by session.metadata.priceKey:
  //   - 'topUp': +200 message credits (£4.99)
  //   - 'journeyFull': The Journey one-off (£599). Grants access to /journey
  //     by creating a Purchase row with productType 'recode' — the
  //     /journey page and /api/journey/* routes gate on
  //     (productType: 'recode', status: 'completed').
  //
  // Default (no priceKey / unknown priceKey): treat as topUp to preserve
  // pre-Journey behaviour and never silently drop a paid checkout. Logs a
  // warning so real misconfiguration is visible in Sentry.
  if (session.mode === 'payment') {
    const priceKey = (session.metadata?.priceKey ?? 'topUp') as string;

    if (priceKey === 'journeyFull') {
      // The Journey one-off. Non-refundable per T&Cs; access begins when
      // the user opens the first block (tracked separately). This row is
      // the access-gate check the /journey page reads. Idempotent on
      // stripeSessionId.
      try {
        await prisma.purchase.create({
          data: {
            userId: user.id,
            productType: 'recode',
            amount: session.amount_total ?? 59900,
            currency: (session.currency ?? 'gbp').toUpperCase(),
            stripeSessionId: session.id,
            status: 'completed',
            completedAt: new Date(),
          },
        });
      } catch (err) {
        if (isP2002(err)) {
          console.log('[webhook] journey one-off already recorded:', session.id);
          return;
        }
        throw err;
      }
      return;
    }

    if (priceKey !== 'topUp') {
      // Unknown payment-mode priceKey — treat defensively as topUp so the
      // paid checkout isn't silently dropped, but log so it's visible in
      // Sentry telemetry. This branch should never fire in prod.
      console.warn(
        '[webhook] unknown payment-mode priceKey, falling back to topUp:',
        priceKey,
        session.id,
      );
    }

    // Payment mode = topup. Atomic Purchase row + credit grant. The two
    // writes used to run sequentially — a crash between them left a
    // Purchase row with no granted credit, and Stripe retry would dedupe
    // the Purchase write and never reach the credit grant. $transaction
    // ensures both succeed or both roll back.
    try {
      await prisma.$transaction([
        prisma.purchase.create({
          data: {
            userId: user.id,
            productType: 'topup',
            amount: session.amount_total ?? 499,
            currency: (session.currency ?? 'gbp').toUpperCase(),
            stripeSessionId: session.id,
            status: 'completed',
            completedAt: new Date(),
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { topUpMessagesRemaining: { increment: 200 } },
        }),
      ]);
    } catch (err) {
      if (isP2002(err)) {
        console.log('[webhook] topup already processed:', session.id);
        return;
      }
      throw err;
    }
  }
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

  // Event-level idempotency claim. StripeEvent.id is the Stripe event ID;
  // the insert fails with P2002 on retry deliveries of the same event so
  // we short-circuit with `deduped: true`. CRITICAL — if any handler
  // below throws, the claim is rolled back so Stripe's retry can succeed.
  // Without that rollback (the bug fixed here), a handler failure left
  // the claim committed, the work undone, and Stripe's retry got
  // silently deduped — the event was lost.
  try {
    await prisma.stripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (err) {
    if (isP2002(err)) {
      console.log('[webhook] event already processed:', event.id);
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error('[webhook] event dedup write failed:', err);
    return NextResponse.json({ error: 'Dedup write failed' }, { status: 500 });
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
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  } catch (err) {
    console.error('[webhook] handler error:', err);
    // Roll back the dedup claim so Stripe's retry isn't silently deduped.
    // If THIS delete also fails (very rare — DB blip), we still return 500
    // so Stripe retries; on retry the next StripeEvent.create may succeed
    // because the row exists (from this side) and we'll skip — accepting
    // that edge case rather than risking double-processing.
    await prisma.stripeEvent
      .delete({ where: { id: event.id } })
      .catch((delErr) => {
        console.error('[webhook] dedup rollback failed:', delErr);
      });
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
