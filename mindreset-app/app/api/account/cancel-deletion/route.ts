import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

// Undoes a scheduled deletion any time during the grace window.
// Clears deletedAt + deletionScheduledAt, and reverses the Stripe
// cancel_at_period_end flag so the subscription continues to renew.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletionScheduledAt: true, stripeSubscriptionId: true },
  });
  if (!user?.deletionScheduledAt) {
    return NextResponse.json({ error: 'not_scheduled' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: null, deletionScheduledAt: null },
  });

  if (user.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (err) {
      console.error('[cancel-deletion] stripe reactivate failed', err);
    }
  }

  return NextResponse.json({ ok: true });
}
