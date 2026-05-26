import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { hasCapacity } from '@/lib/billing/limits';
import { decrypt } from '@/lib/encrypt';
import { redirect } from '@/i18n/navigation';
import DisclaimerGate from '@/components/DisclaimerGate';
import MiniMindClient from './MiniMindClient';

export const dynamic = 'force-dynamic';

const SNIPPET_MAX_CHARS = 80;
const SNIPPET_DAYS_THRESHOLD = 14;
const MESSAGE_HISTORY_LIMIT = 50;

const DISCLAIMER_COOKIE_NAME = 'mr_disclaimer_acknowledged';

export default async function MiniMindPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;

  const { userId } = await auth();
  if (!userId) {
    // Middleware's auth().protect() catches signed-out requests to
    // /(.*)?/minimind(.*) and emits a locale-aware redirect to
    // /<locale>/sign-in before this page renders. Reaching this branch
    // means the matcher in middleware.ts has regressed — fail loud so
    // it surfaces in dev/logs immediately, rather than passing null
    // userId to Prisma and silently rendering an unauthenticated session.
    throw new Error(
      'Unauthenticated request reached /minimind page — middleware matcher likely misconfigured',
    );
  }

  // Legal gate — server-side screening enforcement.
  const screeningGate = await prisma.user.findUnique({
    where: { id: userId },
    select: { screeningResult: true },
  });

  let resolvedScreeningResult = screeningGate?.screeningResult ?? null;

  // Cookie-based screening linkage — mirrors /home page logic.
  // Handles new users who reach /minimind before /home has fired the
  // primary linkage, and the Clerk webhook race where User.screeningResult
  // is still null even though the user just completed screening. If the
  // anonymous ScreeningResponse exists (userId=null, id matches cookie),
  // we promote it and write User.screeningResult so the gate passes
  // immediately.
  if (!resolvedScreeningResult) {
    const cookieStore = cookies();
    const screeningCookie = cookieStore.get('mr_screening')?.value;
    if (screeningCookie) {
      try {
        const anonScreening = await prisma.screeningResponse.findFirst({
          where: { id: screeningCookie, userId: null },
          select: { id: true, result: true, createdAt: true },
        });
        if (anonScreening) {
          await prisma.$transaction([
            prisma.screeningResponse.update({
              where: { id: anonScreening.id },
              data: { userId },
            }),
            prisma.user.update({
              where: { id: userId },
              data: {
                screeningResult: anonScreening.result,
                screeningResultAt: anonScreening.createdAt,
              },
            }),
          ]);
          resolvedScreeningResult = anonScreening.result;
        }
      } catch (err) {
        console.error('[minimind] screening cookie linkage failed:', err);
      }
    }
  }

  if (!resolvedScreeningResult || resolvedScreeningResult === 'red') {
    redirect({ href: '/screening', locale });
  }

  // Same query as /api/minimind/conversations, plus the last N messages so
  // Continue can render immediately with no extra fetch. Duplication is
  // intentional — see carry-forward.md.
  const recentConvo = await prisma.conversation.findFirst({
    where: {
      userId,
      kind: 'minimind',
      messages: { some: { role: 'user' } },
    },
    // NOTE: ordering by startedAt is a v1 simplification. See
    // docs/carry-forward.md "Conversations endpoint orders by startedAt".
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      messages: {
        orderBy: { timestamp: 'desc' },
        take: MESSAGE_HISTORY_LIMIT,
        select: { id: true, role: true, content: true, timestamp: true },
      },
    },
  });

  let lastConvo:
    | { hasLast: false }
    | {
        hasLast: true;
        conversationId: string;
        lastMessageAt: string;
        daysAgo: number;
        showSnippet: boolean;
        snippet?: string;
        messages: Array<{
          id: string;
          role: 'user' | 'assistant';
          content: string;
        }>;
      } = { hasLast: false };

  if (recentConvo && recentConvo.messages.length > 0) {
    // recentConvo.messages is desc-ordered. Find the most-recent user message
    // for snippet/timestamp, then reverse for chronological display.
    const lastUserMessage = recentConvo.messages.find((m) => m.role === 'user');
    if (lastUserMessage) {
      const lastMessageAt = lastUserMessage.timestamp;
      const daysAgo = Math.floor(
        (Date.now() - lastMessageAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const showSnippet = daysAgo <= SNIPPET_DAYS_THRESHOLD;
      const collapsed = decrypt(lastUserMessage.content).replace(/\s+/g, ' ').trim();
      const snippet =
        collapsed.length > SNIPPET_MAX_CHARS
          ? collapsed.slice(0, SNIPPET_MAX_CHARS).trimEnd() + '…'
          : collapsed;

      lastConvo = {
        hasLast: true,
        conversationId: recentConvo.id,
        lastMessageAt: lastMessageAt.toISOString(),
        daysAgo,
        showSnippet,
        snippet: showSnippet ? snippet : undefined,
        messages: recentConvo.messages
          .slice()
          .reverse()
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: decrypt(m.content),
          })),
      };
    }
  }

  const billingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentTier: true,
      messagesUsedThisCycle: true,
      topUpMessagesRemaining: true,
      lifetimeMessagesUsed: true,
      cycleResetAt: true,
      disclaimerAcknowledgedAt: true,
    },
  });

  // Disclaimer modal state — lives on /minimind only. The modal gates the
  // chat surface specifically (acknowledging not-therapy / not-medical
  // stance). Moved out of the root layout in this PR to remove the
  // URL-detection problem the layout-level approach had: pages that don't
  // render the component cannot show the modal.
  //
  // The chat API at /api/minimind/chat independently enforces
  // disclaimerAcknowledgedAt via a DB check on every request, so the
  // modal here is purely the UX surface that obtains that ack.
  const disclaimerCookie = cookies().get(DISCLAIMER_COOKIE_NAME)?.value === 'true';
  const disclaimerAcknowledgedInDB = billingUser?.disclaimerAcknowledgedAt != null;

  // Backfill: signed-in user has the cookie but DB record is missing.
  // Happens when the disclaimer was acknowledged while anonymous (pre-
  // sign-up) — the cookie persists across sign-up but the DB write was
  // skipped because there was no Clerk session at the time. Write
  // server-side so the chat API's DB-only gate passes immediately
  // without waiting for the user to acknowledge again.
  if (disclaimerCookie && !disclaimerAcknowledgedInDB) {
    try {
      await prisma.user.updateMany({
        where: { id: userId, disclaimerAcknowledgedAt: null },
        data: { disclaimerAcknowledgedAt: new Date() },
      });
    } catch (err) {
      console.error('[minimind] disclaimer cookie backfill failed:', err);
    }
  }

  const initialShow = !disclaimerCookie && !disclaimerAcknowledgedInDB;
  const needsCookieBackfill = !disclaimerCookie && disclaimerAcknowledgedInDB;

  const atCap = billingUser ? !hasCapacity(billingUser) : false;

  return (
    <>
      <MiniMindClient
        lastConvo={lastConvo}
        atCap={atCap}
        currentTier={billingUser?.currentTier ?? null}
        cycleResetAt={billingUser?.cycleResetAt?.toISOString() ?? null}
      />
      <DisclaimerGate
        initialShow={initialShow}
        needsCookieBackfill={needsCookieBackfill}
      />
    </>
  );
}
