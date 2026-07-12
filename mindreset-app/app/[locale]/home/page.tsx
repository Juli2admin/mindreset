import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { linkScreeningToUser } from '@/lib/screening/linkScreeningToUser';
import { sendWelcomeEmail } from '@/lib/email/sendWelcome';
import { TIER_CAPS } from '@/lib/billing/limits';
import { ensurePilotGrants } from '@/lib/pilot/grants';
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

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

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
        await linkScreeningToUser({
          userId: user.id,
          primaryEmail,
          locale,
          screening,
        });
      }
      // Reached only when no exception — either linked successfully or
      // there was no anonymous screening matching the cookie. Either way
      // the cookie is no longer useful.
      cookieToClear = true;
    } catch (err) {
      console.error('[home] screening linkage failed', err);
    }
  }

  const firstName = user.firstName ?? (primaryEmail ? primaryEmail.split('@')[0] : null);

  // Defensive User row upsert (2026-07-03). The Clerk webhook at
  // /api/webhooks/clerk is the canonical path that creates the User
  // row on user.created. But that webhook can fail silently for
  // reasons outside the app code — Vercel Deployment Protection
  // rejecting Clerk with 401, signing-secret mismatch, network hiccups
  // — and when it does, the downstream flow breaks in confusing ways:
  // no welcome email, tier defaults to free even for subscribers on
  // page reload, purchase-gate checks fail. Owner reported exactly
  // this failure mode 2026-07-03 with test user yulia12022@gmail.com.
  //
  // This upsert makes /home the fallback creation path (matches the
  // pattern already used by linkScreeningToUser.ts). Idempotent —
  // when the webhook succeeds, this is a no-op. When it doesn't,
  // this creates the row on first /home visit.
  //
  // Failure modes wrapped in try/catch so /home never crashes even
  // if the upsert fails:
  //   - P2002 on (email): a User row with this email exists but
  //     under a different id (Clerk-deleted-then-recreated flow, or
  //     the row was created earlier with a stale id). We try to
  //     recover by finding-by-email and updating that row's id to
  //     match the current Clerk session — this stitches the auth
  //     identity back to the existing row, preserving purchases and
  //     other relations tied by userId.
  //   - Anything else: log and continue with dbUser possibly null.
  //     The page renders with defaults; user still sees /home.
  if (primaryEmail) {
    try {
      // Sync locale from the URL prefix. The Clerk webhook always creates
      // the User row with locale='en' (it has no browser context). Without
      // this sync, a Russian-speaking user's DB locale stays 'en' forever
      // — which means MiniMind's memory context reports "Preferred
      // language: en" to the AI, and the AI answers in English even when
      // the user writes in Russian. LanguagePicker only changes the URL
      // prefix (never touches the DB), so treating the URL locale as
      // authoritative on every /home visit is safe and eventually
      // consistent with what the user is browsing in.
      const dbLocale: 'ru' | 'en' = locale === 'ru' ? 'ru' : 'en';
      await prisma.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: primaryEmail,
          locale: dbLocale,
          themePref: 'system',
          // Sign-up UI already required T&C + Privacy consent; timestamps
          // reflect that consent implicitly happened by the time the user
          // reaches an authenticated surface.
          tcAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
        },
        // Clerk owns email; the URL owns locale (LanguagePicker updates
        // it, no separate DB write). Everything else stays under Stripe /
        // downstream ownership.
        update: { email: primaryEmail, locale: dbLocale },
      });
    } catch (err) {
      // Log and continue. The most common failure is P2002 (email
      // unique constraint) — a User row exists under a different Clerk
      // id (Clerk-deleted-then-recreated or webhook re-issued id). We
      // deliberately do NOT try to relink the row's id here: Postgres
      // FK constraints from RecodeProgress / JourneyTurn / Purchase
      // etc. don't cascade on UPDATE, so an id change would fail. The
      // downstream findUnique below will not find a row for this Clerk
      // id, so the page renders with free-tier defaults — not ideal but
      // safe. If this fires, owner should reconcile manually in
      // Supabase (either delete the orphan row or update it via a
      // scripted DB migration that also updates all dependent rows).
      console.error('[home] user upsert failed (continuing):', err);
    }

    // Journey pilot allowlist grants (2026-07-04). If the tester's email
    // is in lib/pilot/testers.ts, they get Journey Purchase + MiniMind
    // Extended tier idempotently. Awaited so the same-render dbUser
    // findUnique below sees the granted state — otherwise the first
    // /home visit would render with free-tier defaults and the tester
    // would think the pilot didn't work.
    try {
      await ensurePilotGrants(user.id, primaryEmail);
    } catch (err) {
      console.error('[home] pilot grants failed (continuing):', err);
    }
  }

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
      stripeCustomerId: true,
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

  // Slice 3 — flag whether the user has bought The Journey, so HomeClient
  // can flip the Journey card from "Available soon" to a "Continue →" link
  // into /journey. Cheap query: one indexed row by userId.
  const journeyPurchase = await prisma.purchase.findFirst({
    where: { userId: user.id, productType: 'recode', status: 'completed' },
    select: { id: true },
  });
  const journeyPurchased = journeyPurchase != null;

  // Feeds the "Manage subscription" button in SettingsSection. The
  // previous version of this check (PR #215) queried Stripe for active
  // subscriptions specifically. That was too fragile — a subscription
  // in transitional state (past_due, incomplete, trialing) wouldn't
  // match, and any Stripe API hiccup would silently hide the button.
  // Owner reported 2026-07-03: had an active Journey subscription,
  // button still didn't show.
  //
  // Simpler rule: anyone with a Stripe customer ID has SOMETHING at
  // Stripe worth seeing — a subscription, a payment method, receipts.
  // The Stripe hosted Customer Portal handles the empty case
  // gracefully. Zero API calls at page-load time; zero silent failure
  // modes.
  const hasStripeCustomer = dbUser?.stripeCustomerId != null;

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
      journeyPurchased={journeyPurchased}
      hasActiveSubscription={hasStripeCustomer}
      footerSlot={<Footer />}
    />
  );
}
