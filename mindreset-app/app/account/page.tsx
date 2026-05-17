import { cookies } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import AccountClient from './AccountClient';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) {
    redirect('/sign-in');
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
      footerSlot={<Footer />}
    />
  );
}
