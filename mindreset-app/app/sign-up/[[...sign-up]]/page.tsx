import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import SignUpClient from './SignUpClient';

export const dynamic = 'force-dynamic';

const SCREENING_COOKIE = 'mr_screening';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: { screening?: string };
}) {
  // 1. Already-signed-in users go to /account, not back through sign-up.
  const { userId } = await auth();
  if (userId) {
    redirect('/account');
  }

  // 2. Resolve screeningId — URL param wins (supports cross-device flow:
  // user screens on phone, signs up on laptop via shareable URL with
  // ?screening=<id>), cookie is fallback for same-device. Both paths
  // validate against the DB below — the screening must actually exist
  // either way, so neither path can be used to bypass the screening gate.
  const urlScreeningId = searchParams.screening?.trim() || null;
  const screeningCookie = cookies().get(SCREENING_COOKIE)?.value ?? null;
  const screeningId = urlScreeningId || screeningCookie;
  if (!screeningId) {
    redirect('/screening');
  }

  // 3. Validate against the DB. A tampered or stale value shouldn't reach
  // sign-up — the screening must actually exist. This is the legal/safety
  // gate, not just hygiene.
  try {
    const row = await prisma.screeningResponse.findFirst({
      where: { id: screeningId },
      select: { id: true },
    });
    if (!row) {
      redirect('/screening');
    }
  } catch (err) {
    // Note: redirect() throws a special Next.js error that does NOT match this
    // catch (it propagates up to be handled by the framework). This catch only
    // fires on actual Prisma/DB errors — fail-safe to /screening rather than
    // letting the user past the gate.
    console.error('[sign-up] screening cookie validation failed:', err);
    redirect('/screening');
  }

  return <SignUpClient screeningId={screeningId} />;
}
