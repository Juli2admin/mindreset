import { cookies } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email/sendWelcome';
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
      // Reached only when no exception — either linked successfully or
      // no anonymous screening matched the cookie. Either way the cookie
      // is no longer useful. On failure (Clerk-webhook race causing the
      // User row to not be visible to the transaction yet) we KEEP the
      // cookie so /minimind/page.tsx can retry the linkage on the next
      // navigation, by which point the User row has propagated.
      cookieToClear = true;
    } catch (err) {
      console.error('[account] screening linkage failed', err);
      // Intentionally do NOT clear the cookie — /minimind retries.
    }
  }

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  const firstName = user.firstName ?? (primaryEmail ? primaryEmail.split('@')[0] : null);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { currentTier: true, welcomeEmailSentAt: true },
  });

  // Send welcome email once, after the page renders — locale-aware.
  // waitUntil keeps the serverless function alive until the Resend call
  // completes without delaying the page response to the user.
  if (!dbUser?.welcomeEmailSentAt && primaryEmail) {
    waitUntil(
      sendWelcomeEmail({ userId: user.id, email: primaryEmail, locale }).catch((err) =>
        console.error('[account] welcome email task failed:', err),
      ),
    );
  }

  return (
    <AccountClient
      firstName={firstName}
      cookieToClear={cookieToClear}
      currentTier={dbUser?.currentTier ?? null}
      footerSlot={<Footer />}
    />
  );
}
