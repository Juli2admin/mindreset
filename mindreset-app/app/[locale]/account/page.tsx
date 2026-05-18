import { cookies } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { UserButton } from '@clerk/nextjs';
import AccountClient from './AccountClient';
import Footer from '@/components/Footer';
import TopBar from '@/components/TopBar';
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
      await prisma.screeningResponse.updateMany({
        where: { id: screeningCookie, userId: null },
        data: { userId: user.id },
      });
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

  return (
    <AccountClient
      firstName={firstName}
      cookieToClear={cookieToClear}
      topBarSlot={<TopBar right={<UserButton />} />}
      footerSlot={<Footer />}
    />
  );
}
