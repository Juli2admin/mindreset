// One turn of The Journey.
//
// Flow:
//   1. Auth + access check.
//   2. Load Journey state for this user.
//   3. If frozen-for-review, return the holding crisis response (no LLM call).
//   4. Synchronous keyword scan on user message. Hit -> crisis response, freeze,
//      persist message, do not call LLM.
//   5. Persist the user's encrypted message.
//   6. Load recent message history (encrypted at rest, decrypted here).
//   7. Assemble system prompt (Shared Core + active stage spec + state + output
//      format instruction).
//   8. Call Claude (streaming).
//   9. Stream assistant's reply to client.
//  10. After stream completes (via waitUntil): split human reply from state
//      report, parse, persist assistant message, apply landscape additions,
//      update RecodeProgress, write audit log row.
//
// The user never sees the state report; it's stripped before streaming.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encrypt';
import { loadJourneyState } from '@/lib/journey/state/load';
import { applyStateReportToProgress } from '@/lib/journey/state/save';
import { assembleSystemPromptBlocks } from '@/lib/journey/prompts/assemble';
import { getModelForStage } from '@/lib/journey/model';
import { splitReplyAndReport, parseStateReport } from '@/lib/journey/stateReport/parse';
import { writeAuditTurn } from '@/lib/journey/audit/log';
import { scanForJourneyRedFlag, getCrisisResponseForLocale } from '@/lib/journey/safety/keywords';
import { runJourneyVerifier } from '@/lib/journey/safety/verifier';
import { freezeJourney } from '@/lib/journey/safety/freeze';
import { decideRoute, applyRouteDecision } from '@/lib/journey/router/router';
import { loadJourneyState as reloadJourneyState } from '@/lib/journey/state/load';
import { checkJourneyRateLimit } from '@/lib/rateLimit';
import { checkJourneyAccess, markFirstAccessAndIncrement } from '@/lib/journey/access';
import {
  createProcessorState,
  ingestChunk,
  finaliseStream,
} from '@/lib/journey/streaming/reply-processor';
import { recordAiUsage } from '@/lib/ai-usage/record';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const HISTORY_LIMIT = 30;
// Raised from 1500 to 2500 in PR β (2026-07-09) after live test showed the
// model was truncating optional state-report fields (moveJustPerformed,
// patternsTouched, clinicalRead) on rich turns — reply + full state report
// with the new Sensitivity Layer fields fits comfortably in 2500, and the
// model still stops on its own long before the ceiling on light turns.
const MAX_TOKENS = 2500;
// Max characters in a single user message. ~4000 chars ≈ 1000 tokens —
// keeps any one turn within reasonable bounds for cost AND for the
// 30-message history replay (no risk of one user blowing the prompt
// budget). MiniMind enforces a similar cap.
const MAX_USER_MESSAGE_CHARS = 4000;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit BEFORE auth-paid checks so a stolen token can't burn cost
  // by spamming /api/journey/turn. Per-user cap + per-IP cap, same posture
  // as MiniMind chat (10/min/user, 30/min/ip). Fails closed in prod on a
  // Redis blip to protect against cost vector.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimit = await checkJourneyRateLimit(userId, ip);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: 'Rate limited', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  let body: { message?: string; modelOverride?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const userMessage = (body.message ?? '').trim();
  if (!userMessage) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  // Cap message length to prevent token blow-out / cost DoS. A 200KB
  // paste would otherwise be encrypted, stored, replayed in history every
  // turn, and sent to Anthropic. 4000 chars is plenty for a single
  // honest message in this product context.
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

  // Localised crisis response. Default to EN if absent or unknown — never
  // silently fail to deliver SOME canned response in a Red Flag situation.
  const crisisResponse = getCrisisResponseForLocale(body.locale ?? null);

  // Access check — completed Purchase + within 1-year access window + under
  // anti-abuse ceiling. See lib/journey/access.ts.
  const access = await checkJourneyAccess(userId);
  if (access.allowed !== true) {
    return NextResponse.json(
      { error: 'No Journey access', reason: access.reason },
      { status: 403 },
    );
  }
  const purchase = access.purchase;

  const state = await loadJourneyState(userId);
  if (!state) return NextResponse.json({ error: 'Journey not started' }, { status: 409 });

  // Frozen-for-review: return the holding crisis response, no LLM call.
  // Item 4.6 fix: STILL run the synchronous keyword scan on the message so
  // an escalating self-harm utterance from a frozen user is logged as a
  // distinct audit row with the new flag. Without this, a frozen user
  // sending escalating content leaves no audit trace at all — owner
  // loses the signal they need to triage.
  if (state.frozenForReview) {
    await persistMessages(userId, state.currentStage, userMessage, crisisResponse);
    await markFirstAccessAndIncrement(purchase.id);
    const flag = scanForJourneyRedFlag(userMessage);
    if (flag.matched) {
      await writeAuditTurn({
        userId,
        stageAtTurn: state.currentStage,
        depthAtTurn: state.currentDepth,
        userMessage,
        report: {
          intensity: 10,
          safetyFlag: 'red_flag',
          recommendedAction: 'red_flag',
          redFlagType: flag.flagType,
        },
      });
    }
    return cannedResponse(crisisResponse);
  }

  // Synchronous safety check.
  const flag = scanForJourneyRedFlag(userMessage);
  if (flag.matched) {
    // Persist messages, freeze, audit, return canned crisis response — no LLM.
    await persistMessages(userId, state.currentStage, userMessage, crisisResponse);
    await markFirstAccessAndIncrement(purchase.id);
    await freezeJourney({
      userId,
      source: 'keyword_scan',
      redFlagType: flag.flagType,
      reasoning: `pattern: ${flag.matchedPattern}`,
    });
    await writeAuditTurn({
      userId,
      stageAtTurn: state.currentStage,
      depthAtTurn: state.currentDepth,
      userMessage,
      report: {
        intensity: 10,
        safetyFlag: 'red_flag',
        recommendedAction: 'red_flag',
        redFlagType: flag.flagType,
      },
    });
    return cannedResponse(crisisResponse);
  }

  // Persist the user's message before calling the LLM so we don't lose it on
  // an LLM error.
  await prisma.journeyMessage.create({
    data: {
      userId,
      role: 'user',
      contentEncrypted: encrypt(userMessage),
      stageAtTime: state.currentStage,
    },
  });

  // History — most recent N turns, oldest first for the Anthropic call.
  const recent = await prisma.journeyMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { role: true, contentEncrypted: true },
  });
  recent.reverse();

  // System prompt is assembled as a block array so Anthropic prompt
  // caching can cache the canon (Shared Core + active stage spec) +
  // master-before-state. Dynamic content (the state block + master tail)
  // sits in uncached blocks at the end. See lib/journey/prompts/assemble.ts.
  const systemBlocks = assembleSystemPromptBlocks(state);
  const model = getModelForStage(state.currentStage, body.modelOverride);

  const decryptedHistory: { role: 'user' | 'assistant'; content: string }[] = recent.map(
    (m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: decrypt(m.contentEncrypted),
    }),
  );

  const messages: Anthropic.MessageParam[] = decryptedHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const stream = anthropic.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    system: systemBlocks,
    messages,
  });

  // Streaming pipeline — PR α (2026-07-09) uses a dedicated state
  // machine at lib/journey/streaming/reply-processor.ts. Two tags are
  // stripped from what reaches the user:
  //   - <assessment>...</assessment> — retained as a defensive safety net.
  //     PR α asked the AI to emit this block; PR β (2026-07-09) revised the
  //     master prompt to drop the requirement because the buffering added
  //     20–30s of first-byte delay in practice — too slow for the product.
  //     Keeping the strip logic protects against any prompt-cache-serving
  //     lag where the older instruction is still in effect.
  //   - <state-report>...</state-report> — pre-existing hidden JSON.
  const processor = createProcessorState();

  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const visible = ingestChunk(processor, event.delta.text);
            if (visible.length > 0) {
              controller.enqueue(encoder.encode(visible));
            }
          }
        }
        const tail = finaliseStream(processor);
        if (tail.length > 0) {
          controller.enqueue(encoder.encode(tail));
        }
      } catch (err) {
        // Surface a soft error to the client; details go to Sentry/logs.
        console.error('[journey/turn] stream error', err);
        controller.enqueue(encoder.encode('\n\n[Connection interrupted. Please try again.]'));
      } finally {
        controller.close();
        // AI-cost telemetry (PR δ, 2026-07-10). finalMessage() resolves
        // once the SDK has seen message_stop; safe to await AFTER the
        // for-await loop. Failure is non-fatal — telemetry loss must not
        // break the user turn.
        waitUntil(
          stream
            .finalMessage()
            .then((msg) =>
              recordAiUsage({
                userId,
                callSite: 'journey_turn',
                model: msg.model ?? model,
                usage: msg.usage,
              }),
            )
            .catch((err) =>
              console.error('[journey/turn] failed to record AI usage:', err),
            ),
        );
        // Background: parse + persist state report and assistant message.
        // The verifier classifies the user's most recent message in the
        // context of the prior turns. `decryptedHistory` includes that most
        // recent message at the end (we persisted it before loading history),
        // so we strip it: `slice(0, -1)`.
        waitUntil(
          finaliseTurn({
            userId,
            stageAtTurn: state.currentStage,
            depthAtTurn: state.currentDepth,
            userMessage,
            fullText: processor.fullText,
            recentForVerifier: decryptedHistory.slice(0, -1),
          }),
        );
        // Bump the Journey access meter (firstAccessedAt on first turn,
        // journeyMessagesUsed +1 always). Runs in the background so it
        // doesn't add first-byte latency. Independent of finaliseTurn so
        // one failing doesn't block the other.
        waitUntil(
          markFirstAccessAndIncrement(purchase.id).catch((err) =>
            console.error('[journey/turn] failed to bump access meter:', err),
          ),
        );
      }
    },
  });

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function finaliseTurn(args: {
  userId: string;
  stageAtTurn: number;
  depthAtTurn: string;
  userMessage: string;
  fullText: string;
  recentForVerifier: { role: 'user' | 'assistant'; content: string }[];
}): Promise<void> {
  const split = splitReplyAndReport(args.fullText);
  const report = parseStateReport(split.rawStateReport);

  // Persist the assistant message (human reply only — the state report is
  // never stored on the message itself; it lives encrypted on the audit log).
  await prisma.journeyMessage.create({
    data: {
      userId: args.userId,
      role: 'assistant',
      contentEncrypted: encrypt(split.humanReply),
      stageAtTime: args.stageAtTurn,
    },
  });

  // Run the async safety verifier in parallel with state persistence + audit.
  // The verifier classifies the USER message in context. If it returns
  // clear_crisis, we freeze — the user's NEXT message will receive the canned
  // holding response. Their CURRENT reply has already gone out; that's the
  // trade-off documented in lib/journey/safety/verifier.ts.
  const [verifierResult] = await Promise.all([
    runJourneyVerifier(args.userMessage, args.recentForVerifier, {
      userId: args.userId,
    }),
    applyStateReportToProgress(args.userId, report),
  ]);

  // If the LLM's own state report flagged red_flag (subtler than keywords),
  // honour that too.
  if (report.safetyFlag === 'red_flag') {
    await freezeJourney({
      userId: args.userId,
      source: 'state_report',
      redFlagType: (report.redFlagType as any) ?? null,
      reasoning: 'AI state report safetyFlag=red_flag',
    });
  }

  // If the verifier caught crisis content the keyword scan missed, freeze.
  if (verifierResult.verdict === 'clear_crisis') {
    await freezeJourney({
      userId: args.userId,
      source: 'verifier',
      redFlagType: verifierResult.redFlagType,
      reasoning: verifierResult.reasoning,
    });
  }

  // Always write an audit row. If the verifier disagreed with the state
  // report (e.g. report said safe, verifier said crisis), the recorded
  // safetyFlag is the WORSE of the two so downstream review surfaces it.
  const finalReport = { ...report };
  if (verifierResult.verdict === 'clear_crisis') {
    finalReport.safetyFlag = 'red_flag';
    finalReport.recommendedAction = 'red_flag';
    finalReport.redFlagType = verifierResult.redFlagType ?? undefined;
  } else if (verifierResult.verdict === 'ambiguous' && finalReport.safetyFlag === 'none') {
    finalReport.safetyFlag = 'watch';
  }

  await writeAuditTurn({
    userId: args.userId,
    stageAtTurn: args.stageAtTurn,
    depthAtTurn: args.depthAtTurn,
    userMessage: args.userMessage,
    report: finalReport,
  });

  // Router — decide stage transition. Runs AFTER the audit row is written
  // so the gate functions can inspect the just-completed turn. Skipped if
  // the user was just frozen this turn (the frozen path is its own holding
  // pattern and shouldn't accidentally trigger advancement).
  if (finalReport.safetyFlag !== 'red_flag') {
    try {
      const freshState = await reloadJourneyState(args.userId);
      if (freshState) {
        const decision = await decideRoute(freshState);
        await applyRouteDecision(args.userId, decision);
      }
    } catch (err) {
      console.error('[journey/turn] router error:', err);
      // Non-fatal — the user's turn already streamed cleanly. Worst case
      // they stay in the current stage until the next turn re-evaluates.
    }
  }
}

function cannedResponse(text: string): NextResponse {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

async function persistMessages(
  userId: string,
  stageAtTime: number,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  await prisma.journeyMessage.create({
    data: {
      userId,
      role: 'user',
      contentEncrypted: encrypt(userMessage),
      stageAtTime,
    },
  });
  await prisma.journeyMessage.create({
    data: {
      userId,
      role: 'assistant',
      contentEncrypted: encrypt(assistantMessage),
      stageAtTime,
    },
  });
}
