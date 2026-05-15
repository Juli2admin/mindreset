import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { MINIMIND_PROMPT_V2_1 } from '@/lib/minimind/prompt';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;
const HISTORY_LIMIT = 20;

export async function POST(req: NextRequest) {
  // 1. Auth (handler-level — matches Phase 3a + /api/disclaimer/acknowledge pattern)
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Body parse + validate
  let message: string;
  let conversationId: string | undefined;
  try {
    const body = await req.json();
    message = body.message;
    conversationId =
      typeof body.conversationId === 'string' ? body.conversationId : undefined;
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message required (string)' },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  // 3. Get-or-create the Conversation (owner-scoped, kind-scoped)
  let conversation;
  let conversationCreatedThisRequest = false;
  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId, kind: 'minimind' },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'conversation not found' }, { status: 404 });
    }
  } else {
    conversation = await prisma.conversation.create({
      data: {
        userId,
        kind: 'minimind',
        depthLevel: 'surface',
      },
    });
    conversationCreatedThisRequest = true;
  }

  // 4. Load last HISTORY_LIMIT messages (chronological) as context for Claude.
  // Prisma's `take: -N` doesn't do "last N"; the idiom is desc + take N + reverse.
  const recentReversed = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { timestamp: 'desc' },
    take: HISTORY_LIMIT,
  });
  const history = recentReversed.reverse();

  // 4b. Server-side duplicate-request guard. Primary defence is UI debounce in
  // Piece 3; this is belt-and-braces. If the most recent message is from the
  // user, a previous turn is either in-flight or failed before producing any
  // assistant text. Reject rather than create consecutive user rows (which
  // Anthropic's messages API rejects on the next turn).
  const lastMessage = history[history.length - 1];
  if (lastMessage && lastMessage.role === 'user') {
    return NextResponse.json(
      { error: 'previous turn still in progress or did not complete' },
      { status: 409 },
    );
  }

  // 5. Save the user message to DB BEFORE calling Anthropic. Capture the row
  // so we can clean it up cleanly on zero-token failure (Adjustment 3).
  const userMessageRow = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    },
  });

  // 6. Build messages array for Anthropic — history + the current user message.
  const claudeMessages: Anthropic.MessageParam[] = [
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    { role: 'user' as const, content: message },
  ];

  // 7. Stream the Anthropic response, accumulate text, save on completion.
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let accumulated = '';
      let streamFailed = false;

      try {
        const anthropicStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: MINIMIND_PROMPT_V2_1,
          messages: claudeMessages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            accumulated += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        console.error('[minimind/chat] stream error:', err);
        streamFailed = true;
      } finally {
        // Zero-token outcomes always logged (regardless of new vs returning
        // conversation). A returning user hitting a silent failure matters
        // more than a first-visit failure.
        if (accumulated.length === 0) {
          console.error('[minimind/chat] stream produced zero tokens', {
            conversationId: conversation.id,
            userId,
            isNewConversation: conversationCreatedThisRequest,
          });

          // Delete the orphan user message we saved in step 5. Leaving it
          // would create two consecutive user rows on the next turn, which
          // Anthropic's messages API rejects. The Conversation row itself
          // persists — option (i) from the architect's decision: trauma-
          // informed respect for the user's record of "I tried to send".
          try {
            await prisma.message.delete({
              where: { id: userMessageRow.id },
            });
          } catch (cleanupErr) {
            console.error(
              '[minimind/chat] failed to clean orphan user message:',
              cleanupErr,
            );
          }
        } else {
          // Normal or partial-success path: save whatever the assistant produced.
          try {
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: 'assistant',
                content: accumulated,
                partial: streamFailed,
              },
            });
          } catch (saveErr) {
            console.error(
              '[minimind/chat] failed to save assistant message:',
              saveErr,
            );
          }
        }

        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Conversation-Id': conversation.id,
    },
  });
}
