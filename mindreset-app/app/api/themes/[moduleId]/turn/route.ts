// One turn of a Theme-module session.
//
// PR χ1 (2026-07-13). Multi-session shape: one ThemeSession row per
// (userId, moduleId), the reader picks up where they left off across
// visits. Unlike /api/states/[moduleId]/turn (which locks after a
// SESSION_COMPLETE marker), Themes stay open — the reader can type
// again and the arc continues; `completedAt` records the last
// natural pause but doesn't gate the next turn.
//
// Flow:
//   1. Auth + deletion + access check.
//   2. Find-or-create the ThemeSession for (userId, moduleId).
//   3. Synchronous safety keyword scan. Hit → persist + canned crisis
//      response + stamp completedAt='red_flag' + no LLM call. User can
//      still type again later; the response is now part of history and
//      the AI reads it on next turn.
//   4. Persist encrypted user message.
//   5. Load full session history (encrypted at rest, decrypted here).
//   6. Stream Anthropic reply through the shared holdback filter that
//      strips both markers.
//   7. On stream close (via waitUntil): persist encrypted assistant
//      message, increment turnCount, update lastActiveAt, stamp
//      completedAt if the marker fired, emit STATE_META sentinel.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encrypt';
import { checkThemeModuleAccess } from '@/lib/themes/access';
import {
  isValidThemeModuleId,
  type ThemeModuleId,
} from '@/lib/themes/modules';
import { assembleShameSystemPrompt } from '@/lib/themes/prompts/shame';
import { assembleMoneySystemPrompt } from '@/lib/themes/prompts/money';
import { assembleBodySystemPrompt } from '@/lib/themes/prompts/body';
import { assembleFamilySystemPrompt } from '@/lib/themes/prompts/family';
import { assembleSelfRealisationSystemPrompt } from '@/lib/themes/prompts/self_realisation';
import { SESSION_COMPLETE_MARKER_RE } from '@/lib/states/prompts/anxiety';
import {
  scanForStateRedFlag,
  getStateCrisisResponseForLocale,
} from '@/lib/states/safety/red-flag';
import { detectCompletion } from '@/lib/states/completion';
import { recordAiUsage } from '@/lib/ai-usage/record';
import {
  loadThemeMemorySummary,
  regenerateThemeMemorySummary,
  shouldRegenerateSummary,
} from '@/lib/themes/memory';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = 'claude-sonnet-4-6';
// Themes carry deeper multi-session context — grant more headroom
// than States (1500) so the model can hold a long arc without truncating
// closes and markers. Still within reasonable per-turn cost.
const MAX_TOKENS = 2500;
// Load N most recent turns. Themes are multi-session; older material
// beyond this window is represented via the rolling memory summary
// (see lib/themes/memory.ts). 40 keeps recent detail sharp without
// blowing the context on a long arc.
const HISTORY_LIMIT = 40;
const MAX_USER_MESSAGE_CHARS = 4000;
const HOLDBACK_CHARS = 96;

function assembleSystemPromptForTheme(
  moduleId: ThemeModuleId,
  memorySummary: string | null,
): string | null {
  switch (moduleId) {
    case 'shame':
      return assembleShameSystemPrompt(memorySummary);
    case 'money':
      return assembleMoneySystemPrompt(memorySummary);
    case 'body':
      return assembleBodySystemPrompt(memorySummary);
    case 'family':
      return assembleFamilySystemPrompt(memorySummary);
    case 'self_realisation':
      return assembleSelfRealisationSystemPrompt(memorySummary);
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
  if (!isValidThemeModuleId(moduleId)) {
    return NextResponse.json({ error: 'Invalid moduleId' }, { status: 400 });
  }
  // Sentinel: any module we don't have a prompt for yet returns 501.
  // The catalogue tile carries a ROADMAP badge for those. Actual prompt
  // assembly (with the memory summary injected) happens later, once
  // we've located the session.
  if (assembleSystemPromptForTheme(moduleId, null) === null) {
    return NextResponse.json(
      { error: 'Theme not yet available' },
      { status: 501 },
    );
  }

  let body: { message?: string; locale?: string };
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
  const locale = body.locale === 'ru' ? 'ru' : 'en';
  const crisisResponse = getStateCrisisResponseForLocale(locale);

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

  const access = await checkThemeModuleAccess(userId, moduleId);
  if (access.allowed !== true) {
    return NextResponse.json(
      { error: 'No theme access', reason: access.reason },
      { status: 403 },
    );
  }

  // Find-or-create the ThemeSession. Unique on (userId, moduleId) —
  // one row spans the whole 30-day arc (and any re-purchase after
  // expiry: the reader continues where they left off).
  const session = await prisma.themeSession.upsert({
    where: {
      userId_moduleId: { userId, moduleId },
    },
    update: {}, // no-op — we just want the existing row
    create: { userId, moduleId },
    select: { id: true },
  });
  const sessionId = session.id;

  // Safety scan on user message — before any LLM cost.
  const flag = scanForStateRedFlag(userMessage);
  if (flag.matched) {
    await prisma.themeMessage.create({
      data: {
        sessionId,
        role: 'user',
        contentEncrypted: encrypt(userMessage),
      },
    });
    await prisma.themeMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        contentEncrypted: encrypt(crisisResponse),
      },
    });
    await prisma.themeSession.update({
      where: { id: sessionId },
      data: {
        lastActiveAt: new Date(),
        completedAt: new Date(),
        completionReason: 'red_flag',
        turnCount: { increment: 1 },
      },
    });
    console.warn('[themes/turn] red flag', {
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

  await prisma.themeMessage.create({
    data: {
      sessionId,
      role: 'user',
      contentEncrypted: encrypt(userMessage),
    },
  });

  const recent = await prisma.themeMessage.findMany({
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

  // Load the rolling arc-summary (if any) and inject it into the system
  // prompt as PRIOR ARC NOTES. On the first ~15 turns this is null and
  // the base prompt is used unchanged.
  const memorySummary = await loadThemeMemorySummary(sessionId);
  const systemPrompt = assembleSystemPromptForTheme(moduleId, memorySummary);
  if (!systemPrompt) {
    // Should be unreachable — we sentinel-checked earlier — but if a
    // subsequent moduleId slips through, refuse rather than crash.
    return NextResponse.json(
      { error: 'Theme not yet available' },
      { status: 501 },
    );
  }

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
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
        const cleanedTail = buffer
          .replace(SESSION_COMPLETE_MARKER_RE, '')
          .replace(/\[\[SUGGEST:[a-z_]+\]\]/gi, '')
          .trimEnd();
        if (cleanedTail.length > 0) {
          controller.enqueue(encoder.encode(cleanedTail));
        }
        // Same STATE_META sentinel format as States so the shared
        // client parser works — includes completion flag + reason +
        // any valid State-module suggestion.
        const streamCompletion = detectCompletion(fullText);
        if (
          streamCompletion.completed ||
          streamCompletion.suggestedModule
        ) {
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
        console.error('[themes/turn] stream error', err);
        controller.enqueue(
          encoder.encode('\n\n[Connection interrupted. Please try again.]'),
        );
      } finally {
        controller.close();
        const finalMessagePromise = stream.finalMessage().catch((err) => {
          console.error('[themes/turn] finalMessage() failed:', err);
          return null;
        });
        waitUntil(
          finalMessagePromise.then(async (msg) => {
            const completion = detectCompletion(fullText);
            const persistText = completion.completed
              ? completion.visibleText
              : fullText;
            try {
              await prisma.themeMessage.create({
                data: {
                  sessionId,
                  role: 'assistant',
                  contentEncrypted: encrypt(persistText),
                },
              });
              // Themes NEVER lock — completion is a bookmark, not a
              // terminal state. Clearing completedAt when a completed
              // session receives a fresh assistant turn keeps the
              // "last natural pause" semantic accurate; if the AI
              // closes again the marker will re-fire.
              const updated = await prisma.themeSession.update({
                where: { id: sessionId },
                data: completion.completed
                  ? {
                      turnCount: { increment: 1 },
                      lastActiveAt: new Date(),
                      completedAt: new Date(),
                      completionReason: completion.reason,
                    }
                  : {
                      turnCount: { increment: 1 },
                      lastActiveAt: new Date(),
                      completedAt: null,
                      completionReason: null,
                    },
                select: {
                  turnCount: true,
                  memorySummaryTurnCount: true,
                },
              });

              // Rolling arc-summary: regenerate every ~15 turns via a
              // Haiku call. Fire-and-forget — awaited only inside
              // waitUntil so the reader never blocks on it.
              if (
                shouldRegenerateSummary(
                  updated.turnCount,
                  updated.memorySummaryTurnCount,
                )
              ) {
                try {
                  await regenerateThemeMemorySummary(
                    sessionId,
                    userId,
                    moduleId,
                  );
                } catch (err) {
                  console.error(
                    '[themes/turn] summary regeneration failed:',
                    err,
                  );
                }
              }
            } catch (err) {
              console.error(
                '[themes/turn] persist assistant failed:',
                err,
              );
            }
            if (msg) {
              try {
                await recordAiUsage({
                  userId,
                  callSite: 'themes_turn',
                  model: MODEL,
                  usage: msg.usage,
                });
              } catch (err) {
                console.error('[themes/turn] recordAiUsage failed:', err);
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
