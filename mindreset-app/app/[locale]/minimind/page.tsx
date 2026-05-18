import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import MiniMindClient from './MiniMindClient';

export const dynamic = 'force-dynamic';

const SNIPPET_MAX_CHARS = 80;
const SNIPPET_DAYS_THRESHOLD = 14;
const MESSAGE_HISTORY_LIMIT = 50;

export default async function MiniMindPage() {
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
      const collapsed = lastUserMessage.content.replace(/\s+/g, ' ').trim();
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
            content: m.content,
          })),
      };
    }
  }

  return <MiniMindClient lastConvo={lastConvo} />;
}
