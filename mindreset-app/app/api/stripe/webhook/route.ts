import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { waitUntil } from '@vercel/functions';
import { stripe } from '@/lib/stripe/client';
import prisma from '@/lib/prisma';
import { JOURNEY_INSTALLMENT_DURATION_SECONDS } from '@/lib/stripe/products';
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
//
// M22 (2026-07-11). If BOTH locations miss (Stripe adds a third
// API-version move, or an unexpected sub shape lands), we silently write
// cycleResetAt=null and the user's message-cap counter never resets.
// Log a hard console.error with the sub id + status so Vercel search
// surfaces it — Sentry captureMessage would be nicer but this webhook
// already relies on console.error for Vercel log-based alerting.
function getPeriodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items.data[0] as
    (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const fromItem = item?.current_period_end ?? null;
  const fromSub = sub.current_period_end ?? null;
  const value = fromItem ?? fromSub;
  if (value === null) {
    console.error('[stripe-webhook] getPeriodEnd returned null — Stripe schema drift?', {
      subId: sub.id,
      status: sub.status,
      hasItem: !!item,
      itemCount: sub.items.data.length,
    });
  }
  return value;
}

// Journey installment subscriptions run through the same subscription /
// invoice webhook events as MiniMind tier subscriptions but must NOT
// touch the User's MiniMind tier, cycleResetAt, messagesUsedThisCycle,
// or topUpMessagesRemaining. Detect Journey by priceKey metadata (set at
// checkout-create time on subscription_data.metadata) OR by matching the
// Journey installment price ID directly (belt-and-braces for events
// missing metadata, e.g. Stripe replay of pre-metadata subs).
function isJourneyInstallmentPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  const journeyIds = [
    process.env.STRIPE_PRICE_JOURNEY_INSTALLMENT,
    process.env.STRIPE_PRICE_JOURNEY_WEEKLY,
  ].filter(Boolean);
  return journeyIds.includes(priceId);
}

function isJourneyInstallmentSubscription(sub: Stripe.Subscription): boolean {
  const priceId = sub.items.data[0]?.price.id;
  const metaPriceKey = sub.metadata?.priceKey;
  return metaPriceKey === 'journeyInstallment' || isJourneyInstallmentPriceId(priceId);
}

// Invoices carry a `subscription` reference and line items whose `price.id`
// matches the subscription's active price. Metadata is not always present on
// the invoice itself; check both the invoice-line price id and (if we can
// see it cheaply) the subscription's metadata via the line's parent details.
function isJourneyInstallmentInvoice(invoice: Stripe.Invoice): boolean {
  // API 2024-06-20+ shape: invoice.lines.data[i].price.id
  const linePriceId = invoice.lines?.data?.[0]?.price?.id ?? null;
  if (isJourneyInstallmentPriceId(linePriceId)) return true;
  // Newer API also exposes subscription_details.metadata on invoice lines.
  const line = invoice.lines?.data?.[0] as
    | (Stripe.InvoiceLineItem & { subscription_details?: { metadata?: Record<string, string> } })
    | undefined;
  const lineMetaPriceKey = line?.subscription_details?.metadata?.priceKey;
  if (lineMetaPriceKey === 'journeyInstallment') return true;
  return false;
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const cid = extractCustomerId(sub.customer);
  if (!cid) return;
  const priceId = sub.items.data[0]?.price.id;

  if (isJourneyInstallmentSubscription(sub)) {
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
  // Pre-launch audit fix H4 (2026-07-11). Read the user's current
  // stripeSubscriptionId + currentTier BEFORE the write so we can
  // detect a race where a different active sub would be silently
  // overwritten. The scalar `stripeSubscriptionId` column can only hold
  // one value — if two MiniMind subs somehow exist for the same
  // customer (stale-client double-click, portal-upgrade race), the
  // second overwrite orphans the first sub and Stripe bills the user
  // indefinitely for a sub with no code-side tracking.
  //
  // Behaviour:
  //   - If current == null or current == sub.id: proceed normally.
  //   - If current is set to a DIFFERENT id AND the incoming sub is
  //     active AND the current tier is already a paid tier: log a hard
  //     error (Sentry surfaces this), then compare-and-set. The write
  //     still happens (this is the state we can observe now), but the
  //     alert lets Julia investigate + reconcile the orphan.
  const existing = await prisma.user.findFirst({
    where: { stripeCustomerId: cid },
    select: { currentTier: true, stripeSubscriptionId: true },
  });
  if (willBePaid) {
    isFirstActivation = existing?.currentTier === 'free';
  }
  if (
    existing?.stripeSubscriptionId &&
    existing.stripeSubscriptionId !== sub.id &&
    active
  ) {
    console.error(
      '[webhook] stripeSubscriptionId overwrite detected — orphaning risk. Investigate both subs in Stripe.',
      {
        cid,
        currentSubId: existing.stripeSubscriptionId,
        incomingSubId: sub.id,
        incomingStatus: sub.status,
      },
    );
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
  if (isJourneyInstallmentSubscription(sub)) {
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

  // Cross-contamination guard (audit finding A, 2026-07-03): the earlier
  // version filtered on stripeCustomerId only, so a failed £55 Journey
  // installment charge on a user who ALSO had MiniMind Essential/Extended
  // flipped their MiniMind tier to 'free' and sent a MiniMind-flavoured
  // "payment failed" email — even though the MiniMind card charged fine.
  // Same class of bug that #214 fixed for handleSubscriptionDeleted; the
  // invoice handlers were missed.
  //
  // For Journey installment invoices we intentionally do NOTHING here.
  // Journey access is granted by the Purchase row and (per owner spec)
  // is not revoked on payment failure — access ends at the last paid
  // month, which naturally follows when Stripe eventually cancels the
  // subscription. When a proper revocation flow lands (PR 3), it will
  // read the Purchase row's firstAccessedAt + duration, not the User row.
  if (isJourneyInstallmentInvoice(invoice)) return;

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
  // Cross-contamination guard (audit finding A, 2026-07-03): the earlier
  // version filtered on stripeCustomerId only, so every Journey installment
  // £55 subscription_cycle invoice ZEROED messagesUsedThisCycle AND
  // destroyed unused topUpMessagesRemaining on a user who ALSO had a
  // MiniMind subscription. A user with both was getting their MiniMind
  // cycle counter reset mid-cycle 12 extra times a year and losing paid
  // top-up credits.
  //
  // MiniMind cycle reset must only fire on MiniMind subscription_cycle
  // invoices. For Journey installment invoices this handler is a no-op.
  if (isJourneyInstallmentInvoice(invoice)) return;
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

  // Pre-launch audit fix H1 (2026-07-11). Race condition: if the Clerk
  // `user.created` webhook hasn't landed by the time this fires,
  // findUnique(stripeCustomerId) returns null and the old code returned
  // silently — Stripe marked the event as processed, no Purchase row
  // written, paid user hits /journey with "no access", Julia has to
  // reconcile manually.
  //
  // Fallback path: checkout metadata carries clerkId (see
  // /api/checkout/create). Look up by that. If found, backfill the
  // User's stripeCustomerId so subsequent events resolve fast. If STILL
  // not found (Clerk truly hasn't run yet), throw so Stripe retries the
  // whole event — the /home defensive upsert or the retried Clerk
  // webhook will win eventually. Idempotency on stripeSessionId
  // protects against double-processing.
  let user = await prisma.user.findUnique({
    where: { stripeCustomerId: cid },
    select: { id: true },
  });
  if (!user) {
    const clerkId = session.metadata?.clerkId;
    if (clerkId) {
      user = await prisma.user.findUnique({
        where: { id: clerkId },
        select: { id: true },
      });
      if (user) {
        // Backfill so future Stripe events on this customer are fast.
        await prisma.user
          .update({
            where: { id: user.id },
            data: { stripeCustomerId: cid },
          })
          .catch((err) =>
            console.warn(
              '[webhook] stripeCustomerId backfill failed (non-fatal):',
              err,
            ),
          );
      }
    }
    if (!user) {
      console.error(
        '[webhook] no user found by stripeCustomerId OR metadata.clerkId — Clerk webhook likely delayed. Throwing so Stripe retries.',
        { cid, clerkId, sessionId: session.id },
      );
      throw new Error(
        `Checkout completed but no matching User (cid=${cid}, clerkId=${clerkId ?? 'none'}). Retryable.`,
      );
    }
  }

  // Subscription mode covers two products distinguished by priceKey:
  //   - MiniMind Essential/Extended: audit-trail Purchase row (tier is
  //     owned by handleSubscriptionUpsert, not this record)
  //   - Journey installment: 12 × £55/month. Creates the recode Purchase
  //     row that gates access at /journey. No MiniMind tier changes.
  //     Auto-cancel at 12 months is applied here via
  //     stripe.subscriptions.update({cancel_at}) — subscription_data
  //     .cancel_at is NOT a valid checkout.sessions.create parameter
  //     (returned 500 on 2026-07-03; verified against SDK types).
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

    // Journey installment only: schedule Stripe to auto-cancel the
    // subscription after 12 monthly cycles. session.subscription is the
    // subscription ID Stripe just created for this checkout. Wrap in
    // try/catch so a failure here doesn't reject the whole webhook
    // (Purchase row is already committed → access is granted → worst
    // case owner cancels manually via Stripe dashboard).
    if (isJourneyInstallment && session.subscription) {
      const subId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
      try {
        await stripe.subscriptions.update(subId, {
          cancel_at:
            Math.floor(Date.now() / 1000) +
            JOURNEY_INSTALLMENT_DURATION_SECONDS,
        });
      } catch (err) {
        console.error(
          '[webhook] failed to set cancel_at on journey installment sub:',
          subId,
          err,
        );
      }
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

    // State module purchase (PR ψ1). Metadata carries productType='state_module'
    // and moduleId. Grants 30-day access via Purchase.accessExpiresAt.
    // Idempotent on stripeSessionId. Non-refundable after 14 days or first
    // open, whichever comes first (docs/implementation/block-b-stripe-plan.md).
    if (session.metadata?.productType === 'state_module') {
      const moduleId = session.metadata?.moduleId;
      if (!moduleId) {
        console.error(
          '[webhook] state_module purchase without moduleId in metadata',
          { sessionId: session.id },
        );
        throw new Error(`state_module purchase missing moduleId on session ${session.id}`);
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      try {
        await prisma.purchase.create({
          data: {
            userId: user.id,
            productType: 'state_module',
            productId: moduleId,
            amount: session.amount_total ?? 0,
            currency: (session.currency ?? 'gbp').toUpperCase(),
            stripeSessionId: session.id,
            status: 'completed',
            completedAt: now,
            accessExpiresAt: expiresAt,
          },
        });
      } catch (err) {
        if (isP2002(err)) {
          console.log('[webhook] state_module purchase already recorded:', session.id);
          return;
        }
        throw err;
      }
      return;
    }

    // Theme module purchase (PR χ1, 2026-07-13). Same shape as
    // state_module — 30-day access, idempotent on stripeSessionId.
    // Non-refundable after 14 days or first open.
    if (session.metadata?.productType === 'theme_module') {
      const moduleId = session.metadata?.moduleId;
      if (!moduleId) {
        console.error(
          '[webhook] theme_module purchase without moduleId in metadata',
          { sessionId: session.id },
        );
        throw new Error(`theme_module purchase missing moduleId on session ${session.id}`);
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      try {
        await prisma.purchase.create({
          data: {
            userId: user.id,
            productType: 'theme_module',
            productId: moduleId,
            amount: session.amount_total ?? 0,
            currency: (session.currency ?? 'gbp').toUpperCase(),
            stripeSessionId: session.id,
            status: 'completed',
            completedAt: now,
            accessExpiresAt: expiresAt,
          },
        });
      } catch (err) {
        if (isP2002(err)) {
          console.log('[webhook] theme_module purchase already recorded:', session.id);
          return;
        }
        throw err;
      }
      return;
    }

    if (priceKey !== 'topUp') {
      // Pre-launch audit fix H9 (2026-07-11). Old behaviour fell back
      // to topUp on unknown priceKey — silently granting +200 credits
      // and booking £4.99 revenue for a product we don't know we sold.
      // Now: refuse to guess. Throw so Stripe retries and Julia sees
      // the error in Sentry; she can look at the session and configure
      // the priceKey mapping before Stripe stops retrying (72h window).
      console.error(
        '[webhook] unknown payment-mode priceKey — refusing to grant. Investigate the Stripe session in the dashboard.',
        { priceKey, sessionId: session.id },
      );
      throw new Error(
        `Unknown payment-mode priceKey "${priceKey}" on session ${session.id}. Refusing to grant. Configure the priceKey mapping or refund the session.`,
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
