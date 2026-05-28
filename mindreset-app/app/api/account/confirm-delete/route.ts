import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe/client';
import {
  consumeDeletionToken,
  computeScheduledDeletionDate,
} from '@/lib/account/deletion';
import { sendDeletionScheduledEmail } from '@/lib/email/sendAccountDeletion';

export const dynamic = 'force-dynamic';

// Step 2 of the deletion flow: user clicks the link in their email.
// Body: { token, locale? }
//
// We:
//   1. Validate + consume the token (single-use).
//   2. Compute the hard-deletion date = max(now + 30d, subscription period end).
//   3. Set User.deletedAt + User.deletionScheduledAt.
//   4. If subscribed, mark the Stripe subscription cancel_at_period_end
//      so the user isn't billed for the next cycle they can't access.
//   5. Send the scheduled-deletion confirmation email.
//
// Clerk sign-out is left to the client — this route only handles DB +
// Stripe + email. After this call returns ok, the confirm page calls
// signOut() and redirects to /.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { token?: string; locale?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { token, locale = 'en' } = body;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const tokenUserId = await consumeDeletionToken(token);
  if (!tokenUserId) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }
  // Defence-in-depth: token must belong to the signed-in user.
  if (tokenUserId !== userId) {
    return NextResponse.json({ error: 'token_mismatch' }, { status: 403 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeSubscriptionId: true,
      cycleResetAt: true,
      currentTier: true,
    },
  });

  // Use the cycle reset date for subscribers (that's the period the user
  // already paid for). Free users get 30 days flat.
  const isSubscriber =
    dbUser?.currentTier === 'essential' || dbUser?.currentTier === 'extended';
  const subscriptionEnd = isSubscriber ? dbUser?.cycleResetAt ?? null : null;
  const scheduledAt = computeScheduledDeletionDate(subscriptionEnd);

  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      deletionScheduledAt: scheduledAt,
    },
  });

  // Schedule Stripe cancellation at period end. Non-blocking: if Stripe
  // is down or the sub is already canceled, the deletion still proceeds.
  // The webhook handler will treat any later Stripe state changes as
  // normal because deletedAt being set doesn't affect that path.
  if (dbUser?.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(dbUser.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      console.error('[confirm-delete] stripe cancel_at_period_end failed', err);
    }
  }

  if (email) {
    try {
      await sendDeletionScheduledEmail({ email, locale, scheduledAt });
    } catch (err) {
      console.error('[confirm-delete] scheduled email failed', err);
    }
  }

  return NextResponse.json({
    ok: true,
    scheduledAt: scheduledAt.toISOString(),
  });
}
