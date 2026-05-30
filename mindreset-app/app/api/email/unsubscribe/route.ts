import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';

// One-click unsubscribe endpoint. Verifies the HMAC token, flips
// marketingConsent=false, stamps marketingUnsubAt. No-op if the user
// no longer exists (deleted accounts) — still returns 200 to avoid
// leaking account existence.
//
// Idempotent: a second click does nothing extra. The unsubscribe page
// (app/unsubscribe/[token]/page.tsx) renders the same confirmation
// regardless of whether the flip was newly applied or already done.
//
// CSRF: this endpoint is intentionally usable via GET as well as POST
// because some email clients pre-fetch links before the user clicks.
// The action is non-destructive and the token itself is the authentication
// (HMAC tied to user ID), so CSRF protection is unnecessary.

export const dynamic = 'force-dynamic';

async function handle(token: string): Promise<NextResponse> {
  const verified = verifyUnsubscribeToken(token);
  if (!verified) {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 400 });
  }

  // updateMany returns count, doesn't throw if userId doesn't exist —
  // exactly what we want for the deleted-account case.
  await prisma.user.updateMany({
    where: { id: verified.userId },
    data: {
      marketingConsent: false,
      marketingUnsubAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { token?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Tolerate empty body — handle() will reject as Invalid token.
  }
  return handle(body.token ?? '');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  return handle(token);
}
