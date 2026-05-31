import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email/sendWelcome';
import { TIER_CAPS } from '@/lib/billing/limits';
import HomeClient from './HomeClient';
import Footer from '@/components/Footer';
// Phase i18n.1a — locale-aware redirect: redirect('/sign-in') from a /ru/
// page produces /ru/sign-in, not /sign-in.
import { redirect } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

// Auth-gated: noindex so search engines don't burn crawl budget on a
// page they can never reach as anonymous visitors. Same for the other
// auth-gated surfaces.
export const metadata: Metadata = {
  title: 'Your space',
  robots: { index: false, follow: false },
};

// /home is the user's personal space — first landing post-sign-up, and
// the central surface where MiniMind state lives. Block C will add
// Journey and States & Themes cards beside the MiniMind card; the layout
// is designed so adding sections is composition, not a rewrite.
//
// Two pieces of post-sign-up bookkeeping live here (moved from the prior
// /account/page.tsx, which now redirects to /home):
//   - screening cookie linkage: backfills User.screeningResult from the
//     anonymous-screening cookie, with cookie preserved on failure so
//     /minimind can retry (see PR #51).
//   - welcome email: fires once via waitUntil on first visit.
export default async function HomePage({
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
      // there was no anonymous screening matching the cookie. Either way
      // the cookie is no longer useful. On failure (Clerk-webhook race)
      // we KEEP the cookie so /minimind/page.tsx can retry on the next
      // navigation, by which point the User row has propagated.
      cookieToClear = true;
    } catch (err) {
      console.error('[home] screening linkage failed', err);
    }
  }

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  const firstName = user.firstName ?? (primaryEmail ? primaryEmail.split('@')[0] : null);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      currentTier: true,
      messagesUsedThisCycle: true,
      topUpMessagesRemaining: true,
      lifetimeMessagesUsed: true,
      cycleResetAt: true,
      welcomeEmailSentAt: true,
      deletionScheduledAt: true,
      marketingConsent: true,
      marketingConsentPromptedAt: true,
    },
  });

  // Send welcome email once, after the page renders — locale-aware.
  // waitUntil keeps the serverless function alive until the Resend call
  // completes without delaying the page response to the user.
  if (!dbUser?.welcomeEmailSentAt && primaryEmail) {
    waitUntil(
      sendWelcomeEmail({ userId: user.id, email: primaryEmail, locale }).catch((err) =>
        console.error('[home] welcome email task failed:', err),
      ),
    );
  }

  // Compute remaining messages. For paid tiers it's the cycle counter;
  // for free it's the lifetime counter (free has no billing cycle).
  // Top-up is reported separately so the UI can render either combined
  // ("X this cycle + Y top-up") or single-pool ("X messages remaining").
  const tier = dbUser?.currentTier ?? 'free';
  const topUpRemaining = dbUser?.topUpMessagesRemaining ?? 0;
  let cycleRemaining: number;
  if (tier === 'extended') {
    cycleRemaining = Math.max(0, TIER_CAPS.extended.hardCap - (dbUser?.messagesUsedThisCycle ?? 0));
  } else if (tier === 'essential') {
    cycleRemaining = Math.max(0, TIER_CAPS.essential.perCycle - (dbUser?.messagesUsedThisCycle ?? 0));
  } else {
    cycleRemaining = Math.max(0, TIER_CAPS.free.lifetime - (dbUser?.lifetimeMessagesUsed ?? 0));
  }

  return (
    <HomeClient
      firstName={firstName}
      cookieToClear={cookieToClear}
      currentTier={tier}
      cycleRemaining={cycleRemaining}
      topUpRemaining={topUpRemaining}
      cycleResetAt={dbUser?.cycleResetAt?.toISOString() ?? null}
      deletionScheduledAt={dbUser?.deletionScheduledAt?.toISOString() ?? null}
      marketingConsent={dbUser?.marketingConsent ?? false}
      marketingPrompted={dbUser?.marketingConsentPromptedAt != null}
      footerSlot={<Footer />}
    />
  );
}
