import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe/client';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { locale?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — locale defaults to 'en'
  }
  const { locale = 'en' } = body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No Stripe customer' }, { status: 404 });
  }

  const origin =
    request.headers.get('origin') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/${locale}/home`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[portal/create]', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to create portal session', detail },
      { status: 500 },
    );
  }
}
