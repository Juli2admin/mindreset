import { cookies } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import AccountClient from './AccountClient';
import Footer from '@/components/Footer';
// Phase i18n.1a — locale-aware redirect: redirect('/sign-in') from a /ru/
// page produces /ru/sign-in, not /sign-in.
import { redirect } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export default async function AccountPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;

  const user = await currentUser();
  if (!user) {
    redirect({ href: '/sign-in', locale });
  }

  const cookieStore = cookies();
  const screeningCookie = cookieStore.get('mr_screening')?.value;
  let cookieToClear = false;

  if (screeningCookie) {
    try {
      // Find the anonymous screening row (userId null = not yet linked).
      // findFirst + transaction so we can both link the row AND copy
      // result + createdAt into the User's denormalised fields — MiniMind
      // reads User.screeningResult to adapt care level per v2.3 prompt.
      const screening = await prisma.screeningResponse.findFirst({
        where: { id: screeningCookie, userId: null },
        select: { id: true, result: true, createdAt: true },
      });
      if (screening) {
        await prisma.$transaction([
          prisma.screeningResponse.update({
            where: { id: screening.id },
            data: { userId: user.id },
          }),
          prisma.user.update({
            where: { id: user.id },
            data: {
              screeningResult: screening.result,
              screeningResultAt: screening.createdAt,
            },
          }),
        ]);
      }
    } catch (err) {
      console.error('[account] screening linkage failed', err);
    }
    cookieToClear = true;
  }

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  const firstName = user.firstName ?? (primaryEmail ? primaryEmail.split('@')[0] : null);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { currentTier: true },
  });

  return (
    <AccountClient
      firstName={firstName}
      cookieToClear={cookieToClear}
      currentTier={dbUser?.currentTier ?? null}
      footerSlot={<Footer />}
    />
  );
}
