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
import { auth } from '@clerk/nextjs/server';
import { useTranslations } from 'next-intl';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import JourneyClient from './JourneyClient';

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

  // Access gate: must have a completed Journey purchase.
  const purchase = await prisma.purchase.findFirst({
    where: { userId, productType: 'recode', status: 'completed' },
    select: { id: true },
  });
  if (!purchase) {
    return <NoAccessView />;
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

function NoAccessView() {
  return <NoAccessClientShell />;
}

// Tiny server-rendered "no access" view. Kept in this file so we don't add
// another component file for a single-purpose surface.
function NoAccessClientShell() {
  return <NoAccessInner />;
}

function NoAccessInner() {
  // Locale-aware copy via next-intl.
  const t = useTranslations('Journey');
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
          {t('noAccessTitle')}
        </h1>
        <p className="mb-6 text-base leading-relaxed" style={{ color: '#6A6A6A' }}>
          {t('noAccessBody')}
        </p>
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

