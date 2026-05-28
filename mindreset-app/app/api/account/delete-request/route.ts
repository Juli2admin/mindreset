import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { createDeletionToken } from '@/lib/account/deletion';
import { sendDeletionConfirmEmail } from '@/lib/email/sendAccountDeletion';

export const dynamic = 'force-dynamic';

// Step 1 of the deletion flow: user clicks "Delete account" on /home.
// We generate a one-hour token, store its hash, and email the user a
// link that includes the raw token. The actual deletion is gated on
// the user clicking that link.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { locale?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body — locale defaults to 'en'
  }
  const locale = body.locale ?? 'en';

  const user = await currentUser();
  const email =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;
  if (!email) {
    return NextResponse.json({ error: 'No email on account' }, { status: 400 });
  }

  // Block if already scheduled — the user should use cancel-deletion first.
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletionScheduledAt: true },
  });
  if (dbUser?.deletionScheduledAt) {
    return NextResponse.json(
      { error: 'already_scheduled' },
      { status: 409 },
    );
  }

  // Use the request's actual origin so the email link returns the user to
  // the same deployment that initiated the request. Hardcoding mindreset.ai
  // sent users to whatever stale build that domain happens to be aliased to.
  const origin =
    request.headers.get('origin') ??
    request.nextUrl.origin;

  try {
    const rawToken = await createDeletionToken(userId);
    const confirmPath = `/account/confirm-delete?token=${rawToken}`;
    await sendDeletionConfirmEmail({ email, locale, confirmPath, origin });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[account/delete-request] failed', err);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
