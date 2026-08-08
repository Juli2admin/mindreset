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
  applyClosureGate,
  claimsClosure,
  failSafeClosureGate,
  type ClosureGateResult,
} from '@/lib/journey/closure/guard';
// Activated Closure Phase 1 — server-owned process orchestration. Separate
// concern from the guard above: the guard validates a closure CLAIM after the
// reply has streamed; this owns the closure PROCESS before the model runs.
import { runClosureOrchestration } from '@/lib/journey/closure/orchestrator';
import { appendClosureNote } from '@/lib/journey/closure/state-notes';
import { stabilisationDelivered } from '@/lib/journey/closure/stabilisation-evidence';
import { persistClosureProcess } from '@/lib/journey/closure/persist';
import { closeCorrectionFor } from '@/lib/journey/closure/close-guard';
import { resolveConversationLocale } from '@/lib/journey/safety/conversation-locale';
import {
  transitionClosureProcess,
  type ClosureProcess,
} from '@/lib/journey/closure/process';
import { loadRecentTurns } from '@/lib/journey/router/history';
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
import {
  checkJourneyMonthlyCap,
  journeyMonthlyCapRejectionPayload,
} from '@/lib/ai-usage/monthly-cap';

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

  // The language for every code-authored conversational message this turn.
  //
  // NOT the URL locale on its own. On 2026-08-08 a Russian session received the
  // code-authored stability question in English because the user was on an
  // English-locale URL while writing Russian — the Clinician follows the
  // language the user actually writes in, and platform strings did not.
  // resolveConversationLocale reads this turn's own message and falls back to
  // the URL locale when the text carries no script signal, so it can only ever
  // correct a wrong locale, never introduce one.
  const conversationLocale = resolveConversationLocale(userMessage, body.locale ?? null);

  // Localised crisis response. Default to EN if absent or unknown — never
  // silently fail to deliver SOME canned response in a Red Flag situation.
  const crisisResponse = getCrisisResponseForLocale(conversationLocale);

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
      resetAtUtc: capCheck.resetAtUtc,
    });
    // Structured 429 (PR — 2026-07-24): distinct machine-readable `reason`,
    // remaining/percent, and explicit UTC reset metadata. Distinguishable from
    // the rate-limit 429 above (which uses error: 'Rate limited'). This return
    // is BEFORE message persistence and the Anthropic call — a hard cap costs
    // nothing.
    return NextResponse.json(journeyMonthlyCapRejectionPayload(capCheck), {
      status: 429,
    });
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
      const liftMessage = getCooldownLiftMessageForLocale(conversationLocale);
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

  // ------------------------------------------------------------------
  // Activated Closure orchestration hook — Phase 1 (2026-08-05).
  //
  // Structural only. Sits AFTER crisis handling (so a red-flag turn never
  // reaches it) and BEFORE prompt assembly (so later phases can decide what
  // this turn must be while the reply is still ours to shape).
  //
  // Phase 1 reads the server-owned process state, applies the two automatic
  // non-clinical transitions (4-hour interrupted-process expiry, CLOSED
  // re-arm) and returns a typed decision. It does not enter Activated
  // Closure, detect exit intent, alter the prompt, or emit any response —
  // and on production data every process is NONE, so it is a no-op.
  //
  // Existing pre-LLM control pattern it deliberately mirrors: the
  // frozenForReview branch above (persisted flag → read before the model
  // call → typed outcome).
  // ------------------------------------------------------------------
  const closureOrchestration = await runClosureOrchestration(userId, {
    current: state.closureProcess,
    userMessage,
    locale: conversationLocale,
    // Lazy: only loaded when an explicit session exit was detected on an idle
    // process, so ordinary turns pay for no extra query.
    loadSessionTurns: () =>
      loadRecentTurns(userId, 30).then((turns) =>
        turns.map((t) => ({
          n: 0,
          createdAt: t.createdAt,
          intensity: t.intensityReported,
          safetyFlag: t.safetyFlag,
          cycleStatus: t.report?.cycleStatus ?? null,
        })),
      ),
    // Lazy: called only while a required score is outstanding. One indexed
    // count; it is how "first non-answer" is told from "second" without a new
    // persisted counter or a schema change.
    countUserMessagesSince: (since: Date) =>
      prisma.journeyMessage.count({
        where: { userId, role: 'user', createdAt: { gt: since } },
      }),
    now: new Date(),
  });
  // The hook's record is authoritative for the rest of this turn.
  state.closureProcess = closureOrchestration.process;

  // Phase 2 short-circuit. When the closure process requires a code-authored
  // step, the model is NOT called this turn.
  //
  // This is the only control point that can work. The reply streams at
  // controller.enqueue below, which is the irreversibility point — no guard,
  // router or audit check downstream of it can prevent a user-visible goodbye.
  // On 2026-08-08 the clinician ended a session in which intensity reached 6 on
  // eleven turns without ever asking for a stability reading; every enforcement
  // layer in the system ran after the words had already gone.
  //
  // Mirrors the two established pre-LLM short-circuits above: the crisis
  // keyword scan and the frozen-for-review branch.
  if (closureOrchestration.kind === 'deliver') {
    await persistMessages(
      userId,
      state.currentStage,
      userMessage,
      closureOrchestration.text,
    );
    await markFirstAccessAndIncrement(purchase.id);
    console.info('[journey/closure-process] delivered code-authored step', {
      userId,
      step: closureOrchestration.step,
      processState: closureOrchestration.process.state,
    });
    return cannedResponse(closureOrchestration.text);
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
  // Closure state note (Phase 2). When the server-owned process is in a state
  // whose action is CLINICAL and cannot be code-authored, the turn still runs
  // the model — but carrying a platform note naming the required step, so a
  // blocking state is never invisible to the clinician. Same mechanism and same
  // non-persisted, outbound-only contract as the emission reminder, which is
  // appended after it so the output-format reminder stays last.
  const withClosureNote =
    closureOrchestration.kind === 'constrain'
      ? appendClosureNote(maskedHistory, closureOrchestration.note)
      : maskedHistory;
  const messages: Anthropic.MessageParam[] = appendEmissionReminder(withClosureNote);

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

        // Closing invariant, user-visible half (owner-approved 2026-08-08).
        //
        // While the closure process is in DELIVERING_STABILISATION its platform
        // note says "Do not close the session on this turn." On 2026-08-08, at a
        // user-reported stability of 5 — below the threshold of 6 — the Clinician
        // delivered the practice AND said goodbye. The record stayed honest
        // (cycleCanClose false) but the user was told the session was finished.
        //
        // This is the last point at which anything can still reach the user:
        // after controller.close() the reply is gone. The Clinician's prose is
        // delivered untouched above; code appends ONE approved sentence that
        // corrects only the forbidden implication. The trigger is the model's own
        // structured `universal.session_close` claim — no wording is inspected —
        // and only in the one state whose note forbids closing, so legitimate
        // CLOSED and INCOMPLETE turns are never touched.
        try {
          const closureNote =
            closureOrchestration.kind === 'constrain' ? closureOrchestration.note : null;
          if (closureNote === 'stabilisation') {
            const split = splitReplyAndReport(processor.fullText);
            const report = parseStateReport(split.rawStateReport, {
              observedAt: new Date(),
            });
            const correction = closeCorrectionFor({
              note: closureNote,
              report,
              locale: conversationLocale,
            });
            if (correction) {
              controller.enqueue(encoder.encode(`\n\n${correction}`));
              console.info('[journey/closure-process] close claim corrected', {
                userId,
                processState: closureOrchestration.process.state,
              });
            }
          }
        } catch (err) {
          // Never cost the user their reply over this — the stabilisation text
          // has already streamed and is the clinically important part.
          console.error('[journey/closure-process] close-guard failed', {
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
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
          finalMessagePromise
            .then((msg) =>
              finaliseTurn({
                userId,
                stageAtTurn: state.currentStage,
                depthAtTurn: state.currentDepth,
                userMessage,
                fullText: processor.fullText,
                recentForVerifier: decryptedHistory.slice(0, -1),
                stopReason: msg?.stop_reason ?? null,
                outputTokens: msg?.usage?.output_tokens ?? null,
                closureProcess: state.closureProcess,
              }),
            )
            // The reply has already streamed by this point; a background
            // failure must be logged, never left as an unhandled rejection.
            .catch((err) =>
              console.error('[journey/turn] finaliseTurn failed:', err),
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

/** Short, log-safe rendering of an unknown thrown value. */
function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  /** Authoritative closure record as the pre-LLM hook left it this turn. */
  closureProcess: ClosureProcess;
}): Promise<void> {
  const split = splitReplyAndReport(args.fullText);
  // ONE trusted server clock reading governs this whole turn: it is stamped
  // onto every measurement as `observedAt` AND handed to the closure guard,
  // so ordering is exact rather than a race between parse time and guard
  // time (review finding B2, 2026-07-28).
  const observedAt = new Date();
  const parsedReport = parseStateReport(split.rawStateReport, { observedAt });

  // ------------------------------------------------------------------
  // Closure guard (repair 2026-07-28 — scale semantics + closure gating).
  //
  // Runs BEFORE persistence, save and the audit write, so the corrected
  // report is what reaches the DB, the next turn's state block and the
  // router. When the model claims a cycle is closed/closable after the
  // session destabilised, the guard requires a valid post-destabilisation
  // stability measurement on the STABILITY scale at or above threshold.
  // It never blocks the user's exit — the reply has already streamed —
  // it only refuses to RECORD an unearned "safely closed".
  //
  // Repair A2 (2026-07-28) — FAIL-SAFE, not fail-open. If history cannot be
  // loaded or the guard itself throws, the model's closure claim is NOT
  // trusted: the cycle is preserved as open with an observable reason
  // ('history_unavailable' / 'guard_error' / 'closure_unverified'). This
  // runs after the reply has already streamed, so it can never delay or
  // block the user's turn, their exit, or the HTTP response.
  let report = parsedReport;
  let closureGate: ClosureGateResult | null = null;
  if (claimsClosure(parsedReport)) {
    let failure: { reason: 'history_unavailable' | 'guard_error'; detail: string } | null = null;
    let priorTurns: Awaited<ReturnType<typeof loadRecentTurns>> | null = null;
    try {
      priorTurns = await loadRecentTurns(args.userId, 30);
    } catch (err) {
      failure = { reason: 'history_unavailable', detail: errText(err) };
    }
    if (!failure) {
      try {
        const gated = applyClosureGate(
          parsedReport,
          (priorTurns ?? []).map((t) => ({
            n: 0,
            createdAt: t.createdAt,
            intensity: t.intensityReported,
            safetyFlag: t.safetyFlag,
            cycleStatus: t.report?.cycleStatus ?? null,
          })),
          // loadRecentTurns has no session filter; the guard narrows the
          // window to this session relative to this timestamp (B1).
          observedAt,
          // Single measurement authority: when Phase 2 asked the approved
          // question and parsed the user's own answer, THAT is the reading the
          // guard validates against. Most recent slot wins. Without this the
          // guard would look only at `report.stabilityCheck` and record a real
          // user-reported score as `no_stability_measurement`.
          args.closureProcess.postScore !== null
            ? { score: args.closureProcess.postScore, at: args.closureProcess.postScoreAt }
            : args.closureProcess.initialScore !== null
              ? {
                  score: args.closureProcess.initialScore,
                  at: args.closureProcess.initialScoreAt,
                }
              : null,
        );
        report = gated.report;
        closureGate = gated.gate;
      } catch (err) {
        failure = { reason: 'guard_error', detail: errText(err) };
      }
    }
    if (failure) {
      const safe = failSafeClosureGate(parsedReport, failure.reason, failure.detail);
      report = safe.report;
      closureGate = safe.gate;
      console.error(
        `[journey:closure-guard] ${failure.reason} for user=${args.userId}; closure NOT recorded as resolved: ${failure.detail}`,
      );
    } else if (closureGate?.outcome === 'blocked') {
      console.warn(
        `[journey:closure-guard] blocked resolved-closure for user=${args.userId}: ${closureGate.detail}`,
      );
    }
  }
  void closureGate;

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

  // Closure Phase 2 — the VERIFY half of constrain-then-verify.
  //
  // DELIVERING_STABILISATION is the one live closure state whose action is
  // clinical and cannot be code-authored, so the pre-LLM note asks for it. The
  // process advances only on structured evidence that a stabilising practice
  // actually completed — never on the clinician's say-so. No evidence means the
  // state holds and the note is delivered again next turn, which is the safe
  // direction: the user is not moved on from a stabilisation that never ran.
  if (args.closureProcess.state === 'DELIVERING_STABILISATION') {
    await advanceAfterStabilisation(args.userId, args.closureProcess, finalReport);
  }

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

/**
 * Advance DELIVERING_STABILISATION -> AWAITING_POST_SCORE, but only when this
 * turn's report proves a stabilising practice completed. Never throws — this
 * runs after the reply has streamed and must not cost the user anything.
 */
async function advanceAfterStabilisation(
  userId: string,
  current: ClosureProcess,
  report: StateReport,
): Promise<void> {
  const evidence = stabilisationDelivered(report);
  if (evidence.delivered !== true) {
    console.info('[journey/closure-process] stabilisation not evidenced; holding', {
      userId,
      evidence,
    });
    return;
  }
  const moved = transitionClosureProcess(current, 'AWAITING_POST_SCORE', {
    now: new Date(),
  });
  if (!moved.ok) return;
  // One canonical writer (persist.ts) — it owns the column payload and the
  // fail-safe on write error, and never throws.
  const written = await persistClosureProcess(
    userId,
    current,
    moved.process,
    'stabilisation_evidenced',
  );
  if (written.persisted) {
    console.info('[journey/closure-process] stabilisation evidenced; awaiting post score', {
      userId,
      family: evidence.family,
      name: evidence.name,
    });
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
