// One turn of a State-module session.
//
// PR ψ2 (2026-07-13). Simpler than /api/journey/turn — no stage machine,
// no state-report parsing, no cooldown-lift logic. The State-module
// session is short (typical ~6–10 turns), single-topic, no long-term
// user-state to update.
//
// Flow:
//   1. Auth + deletion + access check.
//   2. Validate session ownership and that it's still active.
//   3. Synchronous safety keyword scan. Hit → persist message + canned
//      crisis response + mark session complete (red_flag), no LLM call.
//   4. Persist encrypted user message.
//   5. Load session history (encrypted at rest, decrypted here).
//   6. Stream Anthropic reply through a small hold-back filter that
//      strips the `[[SESSION_COMPLETE:<reason>]]` marker before the
//      last chars reach the reader.
//   7. On stream close (via waitUntil): persist encrypted assistant
//      message, increment turnCount, mark completedAt + completionReason
//      if the marker fired.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encrypt';
import { checkStateModuleAccess } from '@/lib/states/access';
import { isValidStateModuleId, type StateModuleId } from '@/lib/states/modules';
import {
  assembleAnxietySystemPrompt,
  SESSION_COMPLETE_MARKER_RE,
} from '@/lib/states/prompts/anxiety';
import { assembleApathySystemPrompt } from '@/lib/states/prompts/apathy';
import { assembleLossOfSelfSystemPrompt } from '@/lib/states/prompts/loss_of_self';
import { assembleInnerEmptinessSystemPrompt } from '@/lib/states/prompts/inner_emptiness';
import {
  loadStateModuleMemory,
  regenerateStateModuleMemory,
} from '@/lib/states/memory';
import {
  scanForStateRedFlag,
  getStateCrisisResponseForLocale,
} from '@/lib/states/safety/red-flag';
import { detectCompletion } from '@/lib/states/completion';
import { recordAiUsage } from '@/lib/ai-usage/record';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = 'claude-sonnet-4-6';
// Assistant turns in a state session are short (2–5 sentences unless
// delivering practice steps). 1500 tokens gives comfortable headroom
// including the closing marker.
const MAX_TOKENS = 1500;
const HISTORY_LIMIT = 30;
const MAX_USER_MESSAGE_CHARS = 4000;
// Hold back the last N chars of the stream until close so we can strip
// the completion marker without the reader seeing it flash. The marker
// is 30–36 chars long (e.g. "[[SESSION_COMPLETE:stabilised]]");
// 96 gives comfortable headroom to also catch the marker preceded by
// its own newline / whitespace.
const HOLDBACK_CHARS = 96;

function assembleSystemPromptForModule(
  moduleId: StateModuleId,
  memorySummary: string | null,
): string {
  switch (moduleId) {
    case 'anxiety':
      return assembleAnxietySystemPrompt(memorySummary);
    case 'apathy':
      return assembleApathySystemPrompt(memorySummary);
    case 'loss_of_self':
      return assembleLossOfSelfSystemPrompt(memorySummary);
    case 'inner_emptiness':
      return assembleInnerEmptinessSystemPrompt(memorySummary);
  }
}

function cannedStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

export async function POST(
  request: NextRequest,
  ctx: { params: { moduleId: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const moduleId = ctx.params.moduleId;
  if (!isValidStateModuleId(moduleId)) {
    return NextResponse.json({ error: 'Invalid moduleId' }, { status: 400 });
  }
  // System prompt is assembled AFTER auth (below), because it depends
  // on the cross-session memory summary keyed to (userId, moduleId).
  // Sentinel: every valid moduleId has an assembler; unknown moduleIds
  // are rejected by isValidStateModuleId above.

  let body: { message?: string; sessionId?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const userMessage = (body.message ?? '').trim();
  if (!userMessage) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }
  if (userMessage.length > MAX_USER_MESSAGE_CHARS) {
    return NextResponse.json(
      {
        error: 'Message too long',
        maxChars: MAX_USER_MESSAGE_CHARS,
        gotChars: userMessage.length,
      },
      { status: 413 },
    );
  }
  const sessionId = body.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }
  const locale = body.locale === 'ru' ? 'ru' : 'en';
  const crisisResponse = getStateCrisisResponseForLocale(locale);

  // Deletion gate — mirrors Journey B2 fix. A user in the 30-day grace
  // window must not spend LLM cycles.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'user-not-found' }, { status: 412 });
  }
  if (user.deletedAt) {
    return NextResponse.json(
      { error: 'account_scheduled_for_deletion' },
      { status: 403 },
    );
  }

  const access = await checkStateModuleAccess(userId, moduleId);
  if (access.allowed !== true) {
    return NextResponse.json(
      { error: 'No module access', reason: access.reason },
      { status: 403 },
    );
  }

  // Session ownership + active-status check. Sessions are created by the
  // server page component so we can trust they exist for the correct
  // user + module — this defends against a client-side attempt to
  // resume someone else's session or re-use a closed one.
  const session = await prisma.stateSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      moduleId: true,
      completedAt: true,
      turnCount: true,
    },
  });
  if (
    !session ||
    session.userId !== userId ||
    session.moduleId !== moduleId
  ) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.completedAt) {
    return NextResponse.json(
      { error: 'Session already completed. Start a new one.' },
      { status: 409 },
    );
  }

  // Safety scan on user message — before any LLM cost.
  const flag = scanForStateRedFlag(userMessage);
  if (flag.matched) {
    await prisma.stateMessage.create({
      data: {
        sessionId,
        role: 'user',
        contentEncrypted: encrypt(userMessage),
      },
    });
    await prisma.stateMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        contentEncrypted: encrypt(crisisResponse),
      },
    });
    await prisma.stateSession.update({
      where: { id: sessionId },
      data: {
        completedAt: new Date(),
        completionReason: 'red_flag',
        turnCount: { increment: 1 },
      },
    });
    console.warn('[states/turn] red flag — session ended', {
      userId,
      moduleId,
      flagType: flag.flagType,
    });
    return new NextResponse(cannedStream(crisisResponse), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Session-Complete': 'red_flag',
      },
    });
  }

  // Persist the user message BEFORE the LLM call so we don't lose it on
  // an LLM error.
  await prisma.stateMessage.create({
    data: {
      sessionId,
      role: 'user',
      contentEncrypted: encrypt(userMessage),
    },
  });

  const recent = await prisma.stateMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { role: true, contentEncrypted: true },
  });
  recent.reverse();

  const messages: Anthropic.MessageParam[] = recent.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: decrypt(m.contentEncrypted),
  }));

  // Cross-session memory summary (PR ψ5, 2026-07-14). Loaded per turn;
  // null on the reader's first-ever session on this module. The
  // assembler prepends it as PRIOR ARC NOTES so the AI knows what
  // landed in earlier sessions.
  const memorySummary = await loadStateModuleMemory(userId, moduleId);
  const systemPrompt = assembleSystemPromptForModule(moduleId, memorySummary);

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  // Sliding-window hold-back so the completion marker never streams to
  // the reader. On close we run the marker regex on whatever is still
  // in the buffer, strip it, and emit the cleaned tail.
  let buffer = '';
  let fullText = '';

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text;
            fullText += chunk;
            buffer += chunk;
            const emitLen = buffer.length - HOLDBACK_CHARS;
            if (emitLen > 0) {
              const toEmit = buffer.slice(0, emitLen);
              buffer = buffer.slice(emitLen);
              controller.enqueue(encoder.encode(toEmit));
            }
          }
        }
        // Strip BOTH the completion marker and the (optional)
        // navigation-advisor suggestion marker from what the reader
        // sees. detectCompletion runs on `fullText` so it decides
        // completion + suggestion; here we just make sure neither
        // marker's raw text reaches the visible tail.
        const cleanedTail = buffer
          .replace(SESSION_COMPLETE_MARKER_RE, '')
          .replace(/\[\[SUGGEST:[a-z_]+\]\]/gi, '')
          .trimEnd();
        if (cleanedTail.length > 0) {
          controller.enqueue(encoder.encode(cleanedTail));
        }

        // PR ψ4 (2026-07-13). If the AI closed the session — with or
        // without a sibling-State suggestion — emit a client-parseable
        // meta sentinel as the LAST chunk. The client extracts the
        // JSON, strips this control sequence from the visible message,
        // and flips into the session-complete UI (with a "Related
        // module" card when `suggested` is set). Format is intentionally
        // distinct from the AI's own [[…]] markers so a stray
        // hallucination can't emit one.
        const streamCompletion = detectCompletion(fullText);
        if (
          streamCompletion.completed ||
          streamCompletion.suggestedModule
        ) {
          // Sentinel payload. PR χ3 (2026-07-14) — the reader can now
          // be sent to either a sibling State (`/states/<slug>`) or
          // a Theme (`/themes/<slug>`). The kind is authoritative;
          // the client reads it to build the correct href.
          const meta = JSON.stringify({
            completed: streamCompletion.completed,
            ...(streamCompletion.completed && {
              reason: streamCompletion.reason,
            }),
            ...(streamCompletion.suggestedModule && {
              suggested: streamCompletion.suggestedModule.moduleId,
              suggestedKind: streamCompletion.suggestedModule.kind,
            }),
          });
          controller.enqueue(encoder.encode(`\n\n<<<STATE_META:${meta}>>>`));
        }
      } catch (err) {
        console.error('[states/turn] stream error', err);
        controller.enqueue(
          encoder.encode('\n\n[Connection interrupted. Please try again.]'),
        );
      } finally {
        controller.close();
        const finalMessagePromise = stream.finalMessage().catch((err) => {
          console.error('[states/turn] finalMessage() failed:', err);
          return null;
        });
        waitUntil(
          finalMessagePromise.then(async (msg) => {
            const completion = detectCompletion(fullText);
            const persistText = completion.completed
              ? completion.visibleText
              : fullText;
            try {
              await prisma.stateMessage.create({
                data: {
                  sessionId,
                  role: 'assistant',
                  contentEncrypted: encrypt(persistText),
                },
              });
              await prisma.stateSession.update({
                where: { id: sessionId },
                data: completion.completed
                  ? {
                      turnCount: { increment: 1 },
                      completedAt: new Date(),
                      completionReason: completion.reason,
                    }
                  : { turnCount: { increment: 1 } },
              });

              // Cross-session memory regen (PR ψ5, 2026-07-14). Fire
              // when the session closed naturally — stabilised or
              // not_settled_close. Skip red_flag: safety events are
              // not clinical progress; the last stabilised memory
              // stays authoritative across a crisis session.
              if (
                completion.completed &&
                (completion.reason === 'stabilised' ||
                  completion.reason === 'not_settled_close')
              ) {
                try {
                  await regenerateStateModuleMemory(userId, moduleId);
                } catch (err) {
                  console.error(
                    '[states/turn] memory regen failed:',
                    err,
                  );
                }
              }
            } catch (err) {
              console.error('[states/turn] persist assistant failed:', err);
            }
            if (msg) {
              try {
                await recordAiUsage({
                  userId,
                  callSite: 'states_turn',
                  model: MODEL,
                  usage: msg.usage,
                });
              } catch (err) {
                console.error('[states/turn] recordAiUsage failed:', err);
              }
            }
          }),
        );
      }
    },
  });

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Session-Id': sessionId,
    },
  });
}
