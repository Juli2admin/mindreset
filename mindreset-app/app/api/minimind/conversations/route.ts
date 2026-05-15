import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SNIPPET_MAX_CHARS = 80;
const SNIPPET_DAYS_THRESHOLD = 14;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find the user's most recent MiniMind Conversation that has at least one
  // user Message. Conversations with only an assistant opener (or with no
  // messages at all) don't count — they're treated as "first-ever visit"
  // by the client per the locked rule.
  const recentConvo = await prisma.conversation.findFirst({
    where: {
      userId,
      kind: 'minimind',
      messages: {
        some: { role: 'user' },
      },
    },
    // NOTE: ordering by startedAt is a v1 simplification. Proper "most
    // recently used" semantics requires endedAt-based active marker.
    // See docs/carry-forward.md "Conversations endpoint orders by startedAt".
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      messages: {
        where: { role: 'user' },
        orderBy: { timestamp: 'desc' },
        take: 1,
        select: { content: true, timestamp: true },
      },
    },
  });

  if (!recentConvo || recentConvo.messages.length === 0) {
    return NextResponse.json({ hasLast: false });
  }

  const lastUserMessage = recentConvo.messages[0];
  const lastMessageAt = lastUserMessage.timestamp;
  const daysAgo = Math.floor(
    (Date.now() - lastMessageAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const showSnippet = daysAgo <= SNIPPET_DAYS_THRESHOLD;

  // Sanitise the snippet: collapse whitespace, truncate to SNIPPET_MAX_CHARS.
  // No HTML escaping needed — this is JSON for a React client which escapes
  // text content on render.
  const rawText = lastUserMessage.content;
  const collapsed = rawText.replace(/\s+/g, ' ').trim();
  const snippet =
    collapsed.length > SNIPPET_MAX_CHARS
      ? collapsed.slice(0, SNIPPET_MAX_CHARS).trimEnd() + '…'
      : collapsed;

  return NextResponse.json({
    hasLast: true,
    conversationId: recentConvo.id,
    lastMessageAt: lastMessageAt.toISOString(),
    daysAgo,
    showSnippet,
    snippet: showSnippet ? snippet : undefined,
  });
}
