import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import SignUpClient from './SignUpClient';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

const SCREENING_COOKIE = 'mr_screening';

export default async function SignUpPage() {
  // 1. Already-signed-in users go to /account, not back through sign-up.
  const { userId } = await auth();
  if (userId) {
    redirect('/account');
  }

  // 2. No screening cookie → user hasn't completed screening yet.
  const screeningCookie = cookies().get(SCREENING_COOKIE)?.value;
  if (!screeningCookie) {
    redirect('/screening');
  }

  // 3. Validate the cookie value against the DB. A tampered or stale cookie
  // shouldn't be enough to reach sign-up — the screening must actually exist.
  // This is the legal/safety gate, not just hygiene.
  try {
    const row = await prisma.screeningResponse.findFirst({
      where: { id: screeningCookie },
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

  return <SignUpClient footerSlot={<Footer />} />;
}
