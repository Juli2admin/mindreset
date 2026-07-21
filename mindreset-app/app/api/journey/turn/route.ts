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
import { appendEmissionReminder } from '@/lib/journey/prompts/emission-reminder';
import { getModelForStage } from '@/lib/journey/model';
import { splitReplyAndReport, parseStateReport } from '@/lib/journey/stateReport/parse';
import type { StateReport } from '@/lib/journey/stateReport/schema';
import { writeAuditTurn } from '@/lib/journey/audit/log';
import {
  scanForJourneyRedFlag,
  getCrisisResponseForLocale,
  getCooldownLiftMessageForLocale,
} from '@/lib/journey/safety/keywords';
import { runJourneyVerifier } from '@/lib/journey/safety/verifier';
import { freezeJourney, clearFreezeForReview } from '@/lib/journey/safety/freeze';
import { decideRoute, applyRouteDecision } from '@/lib/journey/router/router';
import { loadJourneyState as reloadJourneyState } from '@/lib/journey/state/load';
import { checkJourneyRateLimit } from '@/lib/rateLimit';
import { checkJourneyAccess, markFirstAccessAndIncrement } from '@/lib/journey/access';
import {
  createProcessorState,
  ingestChunk,
  finaliseStream,
} from '@/lib/journey/streaming/reply-processor';
import {
  detectLeak,
  LEAK_USER_PLACEHOLDER,
  LEAK_HISTORY_MASK,
} from '@/lib/journey/streaming/leak-detector';
import { recordAiUsage } from '@/lib/ai-usage/record';
import { checkJourneyMonthlyCap } from '@/lib/ai-usage/monthly-cap';
import { resolveThinkingConfig } from '@/lib/journey/experiments/thinking-config';

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

// PR ξ (2026-07-11) — Journey cooldown-lift floor. When a user is frozen,
// their first message-after-freeze is held for 20 seconds before the
// cooldown-lift verifier runs. This prevents:
//   (a) Instant retry loops where a user (or bot) taps "send" repeatedly
//       hoping to auto-lift on the next Haiku call
//   (b) The lift firing while the user is still in the moment that
//       triggered the freeze — silence is often what they need first
// 20s is much shorter than MiniMind's Sev5 cooldown (which is a
// deliberate longer pause after a crisis event); Journey freezes
// disproportionately catch false positives during deep clinical work
// so the responsive-lift bias is warranted.
const JOURNEY_COOLDOWN_MIN_WAIT_MS = 20 * 1000;

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

  // Pre-launch audit fixes B2 + B5 (2026-07-11): fetch deletedAt +
  // screeningResult before any expensive work. Blocks (a) users who have
  // asked for account deletion from continuing to spend money during
  // the 30-day grace window, and (b) users who screened Red from
  // starting Journey turns (MiniMind already blocks Red; Journey did
  // not, letting the exact population the screening exists to protect
  // from paid trauma work through).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true, screeningResult: true },
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
  if (user.screeningResult === 'red') {
    return NextResponse.json({ error: 'screening-red' }, { status: 412 });
  }

  // PR ε (2026-07-11) — per-user monthly $ cap. Julia's principle:
  // "protect app from abusive bots, or overspending users outside of paid
  // plan/subscriptions." Runs before the LLM call; refuses turns for
  // users past the monthly cap; logs a warning at 80%. Fail-open on
  // aggregate errors — the 5,000-msg + rate-limit are the real guards.
  const capCheck = await checkJourneyMonthlyCap(userId);
  if (capCheck.verdict === 'over_cap') {
    console.error('[journey/turn] per-user monthly cap reached', {
      userId,
      spentUsd: capCheck.spentUsd,
      capUsd: capCheck.capUsd,
    });
    return NextResponse.json(
      {
        error: 'monthly_spend_cap_reached',
        capUsd: capCheck.capUsd,
        spentUsd: capCheck.spentUsd,
      },
      { status: 429 },
    );
  }
  if (capCheck.verdict === 'warn') {
    console.warn('[journey/turn] per-user monthly cap approaching', {
      userId,
      spentUsd: capCheck.spentUsd,
      warnUsd: capCheck.warnUsd,
      capUsd: capCheck.capUsd,
    });
  }

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

  // Frozen-for-review: run the cooldown-lift verifier to decide whether
  // to auto-unfreeze this user based on their message.
  //
  // PR ξ (2026-07-11): Journey now auto-unfreezes on safety_confirmation,
  // matching the MiniMind cooldown-lift pattern. Rationale: the safety
  // layer is calibrated conservative — many freezes catch normal deep
  // clinical work (post-release phenomenology, body-report during
  // guided somatic work). Requiring the owner to run SQL to unfreeze
  // every false positive is UX friction that interrupts paid trauma
  // work. The verifier's cooldown-lift mode is trained to distinguish
  // "no I'm fine, describing" (lift) from genuine crisis (hold).
  //
  // Ordering:
  //   1. Below the min-wait floor → always hold (prevent instant retry).
  //   2. Keyword scan → if hit, this is fresh crisis material; hold and
  //      log the escalation.
  //   3. Cooldown-lift verifier → safety_confirmation lifts; anything
  //      else holds.
  //
  // Pre-launch audit fix B1 (2026-07-11): do NOT call
  // markFirstAccessAndIncrement on the frozen path. Frozen turns cost
  // nothing (canned response, no LLM) and shouldn't stamp the 365-day
  // access clock or count against the 5,000 abuse cap.
  if (state.frozenForReview) {
    await persistMessages(userId, state.currentStage, userMessage, crisisResponse);

    // Floor: silence-time after the freeze. Not conditional on Redis or
    // anything external — just a wall-clock check on frozenAt.
    const withinFloor =
      state.frozenAt !== null &&
      Date.now() - state.frozenAt.getTime() < JOURNEY_COOLDOWN_MIN_WAIT_MS;

    if (withinFloor) {
      return cannedResponse(crisisResponse);
    }

    // Fresh keyword-scan hit inside a frozen session → new crisis material,
    // never lift, log the escalation.
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
      return cannedResponse(crisisResponse);
    }

    // Past the floor, no fresh keyword hit → run the cooldown-lift
    // verifier. Recent history is intentionally NOT passed — the lift
    // decision is about THIS reply as a safety confirmation, not about
    // the earlier flow that triggered the freeze.
    const liftVerdict = await runJourneyVerifier(userMessage, [], {
      userId,
      isCheckingCooldownLift: true,
    });

    if (liftVerdict.verdict === 'safety_confirmation') {
      const cleared = await clearFreezeForReview(userId);
      console.info('[journey/turn] cooldown lifted', {
        userId,
        cleared,
        reasoning: liftVerdict.reasoning,
      });
      const liftMessage = getCooldownLiftMessageForLocale(body.locale ?? null);
      // Overwrite the just-persisted canned response with the lift
      // message so the user's next page load shows the correct history.
      // Small extra write, but the accurate transcript matters
      // clinically.
      await prisma.journeyMessage.create({
        data: {
          userId,
          role: 'assistant',
          contentEncrypted: encrypt(liftMessage),
          stageAtTime: state.currentStage,
        },
      });
      return cannedResponse(liftMessage);
    }

    if (liftVerdict.verdict === 'clear_crisis') {
      // The verifier detected NEW crisis content in the lift reply. Log
      // the escalation like a fresh keyword-scan freeze would.
      await writeAuditTurn({
        userId,
        stageAtTurn: state.currentStage,
        depthAtTurn: state.currentDepth,
        userMessage,
        report: {
          intensity: 10,
          safetyFlag: 'red_flag',
          recommendedAction: 'red_flag',
          redFlagType: liftVerdict.redFlagType ?? undefined,
        },
      });
    }

    // Any non-lift verdict (ambiguous, clear_safe, clear_crisis) → hold
    // the freeze. Canned response goes out.
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

  // Leak-mask gate on history load. Any pre-existing assistant message
  // that matches a leak signature (from before PR ω1 shipped, or a shape
  // the detector at persist time missed) is replaced with a terse
  // internal marker before feeding the model. Prevents legacy DB rows
  // from priming the current turn into repeating the same failure.
  // User messages are never inspected — they are the user's own words.
  const maskedHistory: { role: 'user' | 'assistant'; content: string }[] =
    decryptedHistory.map((m) => {
      if (m.role === 'assistant') {
        const check = detectLeak(m.content);
        if (check.leaked) {
          console.warn('[journey/turn] history mask — leaked assistant row', {
            userId,
            pattern: check.pattern,
          });
          return { role: 'assistant', content: LEAK_HISTORY_MASK };
        }
      }
      return { role: m.role, content: m.content };
    });

  // State-report emission reminder (2026-07-19). Appended to the final
  // user message of the OUTBOUND call only — the user's message was
  // persisted before history assembly, so the note is never stored and
  // never compounds across turns. See lib/journey/prompts/emission-
  // reminder.ts for the AiUsage-backed diagnosis (mid-session turns
  // dropping to reply-only output, 18 consecutive report-less turns).
  const messages: Anthropic.MessageParam[] = appendEmissionReminder(maskedHistory);

  // EXPERIMENT (flag-gated, off in production) — extended thinking.
  // resolveThinkingConfig reads JOURNEY_THINKING from the env. When unset it
  // returns mode 'off' with NO thinking params and maxTokens === MAX_TOKENS,
  // so the request below is byte-identical to production. The thinking /
  // output_config fields are cast onto the request because the installed SDK
  // (0.30.1) predates those params. See lib/journey/experiments/thinking-
  // config.ts. Owner note: budget is env-driven, not assumed at 1500.
  const thinkingCfg = resolveThinkingConfig(MAX_TOKENS);
  if (thinkingCfg.mode !== 'off') {
    console.info(
      '[journey/turn] EXPERIMENT thinking on',
      JSON.stringify({ mode: thinkingCfg.mode, maxTokens: thinkingCfg.maxTokens, ...thinkingCfg.detail }),
    );
  }
  const streamParams = {
    model,
    max_tokens: thinkingCfg.maxTokens,
    system: systemBlocks,
    messages,
    ...(thinkingCfg.thinking ? { thinking: thinkingCfg.thinking } : {}),
    ...(thinkingCfg.output_config ? { output_config: thinkingCfg.output_config } : {}),
  };
  const stream = anthropic.messages.stream(
    streamParams as unknown as Anthropic.MessageStreamParams,
  );

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
          // EXPERIMENT guard: when extended thinking is on, the model streams
          // hidden thinking_delta / signature_delta events. These are private
          // reasoning and must NEVER reach the visible stream or the state-
          // report parser (processor.fullText). The text_delta branch below
          // already excludes them, but we skip explicitly so the invariant
          // survives future refactors. Typed loosely because SDK 0.30.1's
          // delta union predates the thinking deltas.
          if (event.type === 'content_block_delta') {
            const deltaType = (event.delta as { type?: string }).type;
            if (deltaType === 'thinking_delta' || deltaType === 'signature_delta') {
              continue;
            }
          }
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
        // Single finalMessage() await — its result is passed to BOTH the
        // AI-usage telemetry (PR δ) and the finaliseTurn state-report
        // diagnostic (PR κ, 2026-07-11). finalMessage() resolves once the
        // SDK has seen message_stop; safe to await AFTER the for-await
        // loop. Failure is non-fatal — telemetry / diagnostic loss must
        // not break the user turn.
        const finalMessagePromise = stream.finalMessage().catch((err) => {
          console.error('[journey/turn] finalMessage() failed:', err);
          return null;
        });
        waitUntil(
          finalMessagePromise.then((msg) => {
            if (!msg) return;
            return recordAiUsage({
              userId,
              callSite: 'journey_turn',
              model: msg.model ?? model,
              usage: msg.usage,
            }).catch((err) =>
              console.error('[journey/turn] failed to record AI usage:', err),
            );
          }),
        );
        // Background: parse + persist state report and assistant message.
        // The verifier classifies the user's most recent message in the
        // context of the prior turns. `decryptedHistory` includes that most
        // recent message at the end (we persisted it before loading history),
        // so we strip it: `slice(0, -1)`.
        waitUntil(
          finalMessagePromise.then((msg) =>
            finaliseTurn({
              userId,
              stageAtTurn: state.currentStage,
              depthAtTurn: state.currentDepth,
              userMessage,
              fullText: processor.fullText,
              recentForVerifier: decryptedHistory.slice(0, -1),
              stopReason: msg?.stop_reason ?? null,
              outputTokens: msg?.usage?.output_tokens ?? null,
            }),
          ),
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
  // PR κ (2026-07-11) — per-turn state-report emission diagnostics. Both
  // are nullable because finalMessage() can fail; the diagnostic still
  // logs whatever it has.
  stopReason: string | null;
  outputTokens: number | null;
}): Promise<void> {
  const split = splitReplyAndReport(args.fullText);
  const report = parseStateReport(split.rawStateReport);

  // ------------------------------------------------------------------
  // PR κ (2026-07-11) — state-report emission diagnostics.
  //
  // Across five test sessions the same pattern keeps appearing: mid-
  // session turns emit the required-3 fields only, close turns emit
  // full state reports. The parser can't distinguish these three cases
  // in the current audit row:
  //   (A) model emitted no <state-report> at all
  //   (B) model emitted <state-report> but truncated at max_tokens
  //       (open tag present, close tag absent → parser sees null)
  //   (C) model emitted a well-formed <state-report> but chose to skip
  //       optional fields
  // The fix depends on which is happening. This log line emits enough
  // per-turn signal to disambiguate in the Vercel logs. Structured
  // JSON so it's greppable / parseable.
  // ------------------------------------------------------------------
  const hadStateReportOpen = args.fullText.includes('<state-report>');
  const hadStateReportClose = args.fullText.includes('</state-report>');
  const rawJsonLength = split.rawStateReport?.length ?? 0;
  const REQUIRED_3 = new Set(['intensity', 'safetyFlag', 'recommendedAction']);
  const filledOptionalFieldNames = Object.keys(report).filter(
    (k) => !REQUIRED_3.has(k) && (report as Record<string, unknown>)[k] !== undefined,
  );
  const failureModeGuess = !hadStateReportOpen
    ? 'A_no_state_report_tag'
    : !hadStateReportClose
      ? 'B_truncated_at_max_tokens'
      : filledOptionalFieldNames.length === 0
        ? 'C_model_skipped_all_optional_fields'
        : 'D_ok';

  console.info(
    '[journey/state-report-diag]',
    JSON.stringify({
      userId: args.userId,
      stageAtTurn: args.stageAtTurn,
      stopReason: args.stopReason,
      outputTokens: args.outputTokens,
      fullTextLength: args.fullText.length,
      humanReplyLength: split.humanReply.length,
      hadStateReportOpen,
      hadStateReportClose,
      rawJsonLength,
      filledOptionalFieldCount: filledOptionalFieldNames.length,
      filledOptionalFieldNames,
      failureModeGuess,
    }),
  );
  // ------------------------------------------------------------------

  // Persist the assistant message (human reply only — the state report is
  // never stored on the message itself; it lives encrypted on the audit log).
  // Pre-launch audit fix H5 (2026-07-11). If the stream fell over inside
  // a private-tag (`<thinking>` / `<assessment>`) block, finaliseStream
  // returns "" and split.humanReply is empty. Persisting an empty
  // assistant message shows the user a blank bubble on page reload with
  // no signal that something failed. Persist a visible "connection
  // interrupted" placeholder instead so page-load transcript is honest
  // about the failure.
  // Leak-detection gate on persistence (PR ω1). If the model produced
  // instruction-leak output instead of a warm reply — a real incident on
  // 2026-07-13, see lib/journey/streaming/leak-detector.ts docstring —
  // we refuse to persist the leaked text. Storing it would (a) show it
  // to the user on their next /journey visit, and (b) prime the next
  // Anthropic call by feeding the leak back as canonical assistant
  // history. Replace with the H5 placeholder so the persisted transcript
  // stays honest about the failure. Log the pattern name for
  // /admin diagnosis; do NOT log the raw leaked content (privacy).
  const leakCheck = detectLeak(split.humanReply);
  if (leakCheck.leaked) {
    console.warn('[journey/turn] persistence gate — leak detected, substituted placeholder', {
      userId: args.userId,
      pattern: leakCheck.pattern,
      leakedLength: split.humanReply.length,
      stageAtTurn: args.stageAtTurn,
    });
  }
  const persistedReply =
    leakCheck.leaked || split.humanReply.length === 0
      ? LEAK_USER_PLACEHOLDER
      : split.humanReply;
  await prisma.journeyMessage.create({
    data: {
      userId: args.userId,
      role: 'assistant',
      contentEncrypted: encrypt(persistedReply),
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
  //
  // M20 (2026-07-11). Both the model's own red_flag and a verifier
  // escalation happen AFTER the reply has already streamed to the user —
  // unlike the keyword-scan sync path where the canned crisis response
  // is delivered instead. Tag those cases with _deliveredBeforeFreeze so a
  // reviewer skimming the audit can tell "the user saw the AI reply and
  // was frozen only on their NEXT turn" apart from "the user was frozen
  // pre-reply and saw the canned crisis text". Underscore-prefixed to
  // signal it's a diagnostic annotation, not part of the model's schema.
  const finalReport = { ...report } as StateReport & {
    _deliveredBeforeFreeze?: boolean;
    _verifierEscalation?: boolean;
  };
  if (verifierResult.verdict === 'clear_crisis') {
    finalReport._verifierEscalation = finalReport.safetyFlag !== 'red_flag';
    finalReport.safetyFlag = 'red_flag';
    finalReport.recommendedAction = 'red_flag';
    finalReport.redFlagType = verifierResult.redFlagType ?? undefined;
  } else if (verifierResult.verdict === 'ambiguous' && finalReport.safetyFlag === 'none') {
    finalReport.safetyFlag = 'watch';
  }
  if (finalReport.safetyFlag === 'red_flag') {
    finalReport._deliveredBeforeFreeze = true;
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
