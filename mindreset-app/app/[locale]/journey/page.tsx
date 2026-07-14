// /journey — the entry surface for The Journey product.
//
// Server component. Auth-gated by middleware.ts (/(.*)?/journey(.*) is in
// the protected matcher). This file enforces the SECOND gate: the user must
// have a completed Journey purchase. If not, we render a soft "not open yet"
// view that links to /pricing.
//
// The user NEVER sees:
//   - stage names ("Stage 1", "Block 1", "Stop", etc.)
//   - depth labels ("Surface", "Middle", "Deep")
//   - a progress bar
//   - completion criteria
//   - any clinical scaffolding
//
// The UI is deliberately quiet — slow tempo matches the method.

import type { Metadata } from 'next';
import { auth, currentUser } from '@clerk/nextjs/server';
import { useTranslations } from 'next-intl';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { checkJourneyAccess } from '@/lib/journey/access';
import { ensurePilotGrants } from '@/lib/pilot/grants';
import { sendPilotBeforeFormEmail } from '@/lib/email/sendPilotBeforeForm';
import JourneyClient from './JourneyClient';
import PilotUpgradeButton from './PilotUpgradeButton';

export const dynamic = 'force-dynamic';
// Neutralises Next.js fetch cache and intermediate edge caches for this
// page. Combined with `dynamic = 'force-dynamic'` above, this stops a user
// from seeing a stale empty conversation on return after a session (a
// "where did my chat go?" UX issue observed in live test — DB was intact;
// only the page render was stale).
export const fetchCache = 'force-no-store';

// Auth-gated chat surface. noindex so search engines don't try to crawl it —
// signed-out crawlers would be redirected to /sign-in by middleware anyway.
export const metadata: Metadata = {
  title: 'The Journey',
  robots: { index: false, follow: false },
};

const MESSAGE_HISTORY_LIMIT = 50;

export default async function JourneyPage() {
  const { userId } = await auth();
  if (!userId) {
    // Middleware should redirect signed-out users to /sign-in before this
    // page renders. Reaching this branch means the matcher in middleware.ts
    // regressed — fail loud rather than silently passing null userId
    // downstream.
    throw new Error(
      'Unauthenticated request reached /journey page — middleware matcher likely misconfigured',
    );
  }

  // Pilot-tester defensive grant. ensurePilotGrants normally runs on
  // /home. A tester who lands on /journey directly (from a signup email
  // link or a bookmark) would otherwise hit NoAccessView until they
  // visited /home. Idempotent + fast-exits for non-testers, so cheap to
  // run defensively here.
  try {
    const user = await currentUser();
    const primaryEmail =
      user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress ??
      null;
    if (primaryEmail) {
      await ensurePilotGrants(userId, primaryEmail);
    }
  } catch (err) {
    console.error('[journey] pilot grants failed (continuing):', err);
  }

  // Pilot Before-form nudge (PR ω3a, 2026-07-14). Fires once per
  // pilot invitation from the tester's first Journey visit when they
  // haven't filled the Before questionnaire yet. Idempotent via
  // atomic updateMany({ beforeFormEmailSentAt: null, beforeFormFilled: false })
  // — safe to run every visit; only the first eligible one sends.
  // Fire-and-forget via waitUntil so the page render is never blocked
  // by the email dispatch.
  try {
    const pilotUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pilotInvitationId: true,
        locale: true,
      },
    });
    if (pilotUser?.pilotInvitationId) {
      const invitation = await prisma.pilotInvitation.findUnique({
        where: { id: pilotUser.pilotInvitationId },
        select: { beforeFormFilled: true, beforeFormEmailSentAt: true },
      });
      if (
        invitation &&
        !invitation.beforeFormFilled &&
        !invitation.beforeFormEmailSentAt
      ) {
        const clerkUser = await currentUser();
        const email =
          clerkUser?.emailAddresses.find(
            (e) => e.id === clerkUser.primaryEmailAddressId,
          )?.emailAddress ??
          clerkUser?.emailAddresses[0]?.emailAddress ??
          null;
        if (email) {
          waitUntil(
            sendPilotBeforeFormEmail({
              invitationId: pilotUser.pilotInvitationId,
              email,
              locale: pilotUser.locale ?? 'en',
            }).catch((err) => {
              console.error('[journey] before-form nudge failed:', err);
            }),
          );
        }
      }
    }
  } catch (err) {
    console.error('[journey] before-form nudge dispatch failed:', err);
  }

  // Access gate: completed Journey purchase + within 1-year window + under
  // the anti-abuse ceiling. See lib/journey/access.ts.
  const access = await checkJourneyAccess(userId);
  if (access.allowed !== true) {
    return <NoAccessView reason={access.reason} />;
  }

  // Auto-start the Journey on first visit. upsert is race-safe for the
  // dual-tab case where two server renders fire near-simultaneously.
  const progress = await prisma.recodeProgress.upsert({
    where: { userId },
    create: {
      userId,
      currentStage: 1,
      currentDepth: 'surface',
      mii: {},
    },
    update: {}, // no-op on existing row
    select: {
      frozenForReview: true,
      dischargedAt: true,
    },
  });

  // Load recent messages for the client. Decrypted server-side so the client
  // never sees ciphertext.
  const recentRows = await prisma.journeyMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: MESSAGE_HISTORY_LIMIT,
    select: { id: true, role: true, contentEncrypted: true },
  });
  const messages = recentRows
    .slice()
    .reverse()
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: decrypt(m.contentEncrypted),
    }));

  return (
    <JourneyClient
      initialMessages={messages}
      frozen={progress.frozenForReview}
    />
  );
}

type NoAccessReason =
  | 'no_purchase'
  | 'expired'
  | 'cap_reached'
  | 'pilot_expired'
  | 'pilot_revoked';

function NoAccessView({ reason }: { reason: NoAccessReason }) {
  return <NoAccessInner reason={reason} />;
}

// Tiny server-rendered "no access" view. Kept in this file so we don't add
// another component file for a single-purpose surface.
function NoAccessInner({ reason }: { reason: NoAccessReason }) {
  // Locale-aware copy via next-intl. Multiple distinct reasons, distinct
  // messages — a user whose year has ended shouldn't be told "not open for
  // you yet"; a pilot tester whose trial ended sees a different message
  // pointing to the 50%-off continuation offer. Falls back to the general
  // "no purchase" copy.
  const t = useTranslations('Journey');
  const titleKey =
    reason === 'expired' ? 'expiredTitle' :
    reason === 'cap_reached' ? 'capReachedTitle' :
    reason === 'pilot_expired' ? 'pilotExpiredTitle' :
    reason === 'pilot_revoked' ? 'pilotRevokedTitle' :
    'noAccessTitle';
  const bodyKey =
    reason === 'expired' ? 'expiredBody' :
    reason === 'cap_reached' ? 'capReachedBody' :
    reason === 'pilot_expired' ? 'pilotExpiredBody' :
    reason === 'pilot_revoked' ? 'pilotRevokedBody' :
    'noAccessBody';
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#F4F1EA', color: '#393939' }}
    >
      <div className="max-w-md text-center">
        <h1
          className="mb-4 text-2xl"
          style={{ fontFamily: TOKENS.serif }}
        >
          {t(titleKey)}
        </h1>
        <p className="mb-6 text-base leading-relaxed" style={{ color: '#6A6A6A' }}>
          {t(bodyKey)}
        </p>
        {reason === 'pilot_expired' && (
          <div className="mb-6 flex flex-col items-center gap-3">
            <PilotUpgradeButton
              label={t('pilotUpgradeCta')}
              errorLabel={t('pilotUpgradeError')}
            />
            {process.env.PILOT_AFTER_FORM_URL && (
              <a
                href={process.env.PILOT_AFTER_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-4 hover:no-underline"
                style={{ color: '#2D7A85' }}
              >
                {t('pilotAfterFormCta')}
              </a>
            )}
          </div>
        )}
        <Link
          href="/pricing"
          className="inline-block underline underline-offset-4 hover:no-underline"
          style={{ color: '#2D7A85' }}
        >
          {t('seePricing')}
        </Link>
      </div>
    </div>
  );
}

