import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

// POST /api/account/marketing-consent
//
// Body: { consent: boolean, dismissBanner?: boolean }
//
// - consent=true: opt the user in. Stamps marketingConsentPromptedAt so
//   the /home banner stops appearing. If the user previously unsubscribed
//   (marketingUnsubAt is set), this re-subscribes them but leaves the
//   prior unsubscribe timestamp in place for audit.
// - consent=false: opt the user out OR dismiss the banner. Updates
//   marketingConsent → false (no-op if already false) + stamps
//   marketingUnsubAt only when the request is actually flipping from
//   true → false. Stamps marketingConsentPromptedAt either way.
// - dismissBanner=true with consent=false: same effect as above. The
//   parameter is here for caller-side clarity — "Not now" on the banner
//   sends { consent: false, dismissBanner: true }; the toggle in
//   Settings sends { consent: false } when turning off.
//
// Auth: Clerk session required. The user can only modify their own
// consent — there's no user-ID parameter.

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { consent?: unknown; dismissBanner?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  if (typeof body.consent !== 'boolean') {
    return NextResponse.json({ error: 'consent must be boolean' }, { status: 400 });
  }

  const now = new Date();

  // Read current state to decide whether to stamp marketingUnsubAt
  // (only stamp when actually transitioning true → false).
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { marketingConsent: true },
  });
  if (!current) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const transitioningToFalse = current.marketingConsent === true && body.consent === false;

  await prisma.user.update({
    where: { id: userId },
    data: {
      marketingConsent: body.consent,
      marketingConsentPromptedAt: now,
      ...(transitioningToFalse ? { marketingUnsubAt: now } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
