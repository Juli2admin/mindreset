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
import { assembleSystemPrompt } from '@/lib/journey/prompts/assemble';
import { getModelForStage } from '@/lib/journey/model';
import { splitReplyAndReport, parseStateReport } from '@/lib/journey/stateReport/parse';
import { writeAuditTurn } from '@/lib/journey/audit/log';
import { scanForJourneyRedFlag, CRISIS_RESPONSE_EN } from '@/lib/journey/safety/keywords';
import { runJourneyVerifier } from '@/lib/journey/safety/verifier';
import { freezeJourney } from '@/lib/journey/safety/freeze';
import { decideRoute, applyRouteDecision } from '@/lib/journey/router/router';
import { loadJourneyState as reloadJourneyState } from '@/lib/journey/state/load';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const HISTORY_LIMIT = 30;
const MAX_TOKENS = 1500;
// Tag pair used by the assembler's output-format instruction; we strip
// everything from STATE_REPORT_OPEN onward before streaming to the client.
const STATE_REPORT_OPEN = '<state-report>';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { message?: string; modelOverride?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const userMessage = (body.message ?? '').trim();
  if (!userMessage) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  // Access check.
  const purchase = await prisma.purchase.findFirst({
    where: { userId, productType: 'recode', status: 'completed' },
    select: { id: true },
  });
  if (!purchase) return NextResponse.json({ error: 'No Journey access' }, { status: 403 });

  const state = await loadJourneyState(userId);
  if (!state) return NextResponse.json({ error: 'Journey not started' }, { status: 409 });

  // Frozen-for-review: return holding response, no LLM call.
  if (state.frozenForReview) {
    await persistMessages(userId, state.currentStage, userMessage, CRISIS_RESPONSE_EN);
    return cannedResponse(CRISIS_RESPONSE_EN);
  }

  // Synchronous safety check.
  const flag = scanForJourneyRedFlag(userMessage);
  if (flag.matched) {
    // Persist messages, freeze, audit, return canned crisis response — no LLM.
    await persistMessages(userId, state.currentStage, userMessage, CRISIS_RESPONSE_EN);
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
    return cannedResponse(CRISIS_RESPONSE_EN);
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

  const systemPrompt = assembleSystemPrompt(state);
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
    system: systemPrompt,
    messages,
  });

  // We stream the human-reply portion to the client; the state report stays
  // server-side. We strip everything from the first <state-report> tag onward.
  let buffer = '';
  let truncatedAtOpen = false;
  let displayedSoFar = 0;
  let fullText = '';

  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const delta = event.delta.text;
            fullText += delta;
            if (truncatedAtOpen) continue;
            buffer += delta;
            const idx = buffer.indexOf(STATE_REPORT_OPEN);
            if (idx >= 0) {
              // Stream up to the tag, then stop displaying.
              const beforeTag = buffer.slice(0, idx);
              const newDisplay = beforeTag.length - displayedSoFar;
              if (newDisplay > 0) {
                controller.enqueue(encoder.encode(beforeTag.slice(displayedSoFar)));
                displayedSoFar = beforeTag.length;
              }
              truncatedAtOpen = true;
            } else {
              // Safe to stream the new delta — but keep the last ~20 chars
              // buffered so we don't accidentally stream a partial open tag.
              const safeUpTo = Math.max(0, buffer.length - STATE_REPORT_OPEN.length);
              const toStream = buffer.slice(displayedSoFar, safeUpTo);
              if (toStream.length > 0) {
                controller.enqueue(encoder.encode(toStream));
                displayedSoFar = safeUpTo;
              }
            }
          }
        }
        // Stream is complete — if we never hit the open tag, flush the rest.
        if (!truncatedAtOpen && displayedSoFar < buffer.length) {
          controller.enqueue(encoder.encode(buffer.slice(displayedSoFar)));
        }
      } catch (err) {
        // Surface a soft error to the client; details go to Sentry/logs.
        console.error('[journey/turn] stream error', err);
        controller.enqueue(encoder.encode('\n\n[Connection interrupted. Please try again.]'));
      } finally {
        controller.close();
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
            fullText,
            recentForVerifier: decryptedHistory.slice(0, -1),
          }),
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
    runJourneyVerifier(args.userMessage, args.recentForVerifier),
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
