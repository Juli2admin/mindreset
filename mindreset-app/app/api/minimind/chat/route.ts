import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { MINIMIND_PROMPT_V2_3 } from '@/lib/minimind/prompt';
import { scanForKeywords } from '@/lib/minimind/safety/keywords';
import { runVerifier } from '@/lib/minimind/safety/verifier';
import { logSafetyEvent } from '@/lib/minimind/safety/log';
import { loadUserMemoryContext } from '@/lib/minimind/memory/loader';
import { updateWellbeingSnapshot } from '@/lib/minimind/memory/updater';
import { encrypt, decrypt } from '@/lib/encrypt';
import { checkChatRateLimit } from '@/lib/rateLimit';
import { hasCapacity, consumeMessage } from '@/lib/billing/limits';
import { waitUntil } from '@vercel/functions';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;
const HISTORY_LIMIT = 20;
// Hard floor: cooldown cannot lift within this window of the triggering Sev 5
// safety event, regardless of verifier verdict on user replies during that
// window. Rationale: a "I'm safe" arriving 30 seconds after Sev 5 is more
// likely deflection than genuine safety; the verifier prompt's
// bias-toward-holding is policy, this gate is enforcement.
const COOLDOWN_MIN_WAIT_MS = 5 * 60 * 1000;

// Phase 3d: state-occurrence array cap (event-driven counter for the 7-day
// pattern threshold). Written here in runAsyncVerifier; consumed by the
// memory loader's countRecentStates window query.
const RECENT_STATE_OCCURRENCES_CAP = 50;

// Phase 3d: profile updater cadence. Fires when total user-message count for
// this user (across all conversations) hits a multiple of N.
const PROFILE_UPDATE_EVERY_N_MESSAGES = 20;

// ============================================================================
// Canned crisis copy (EN only for v1; i18n lift later moves to locales/)
// ============================================================================
const CRISIS_RESPONSE = `I hear how serious this is. What you're carrying right now is more than this conversation is built for, and I want you safe. Please reach out to a person who can be with you in this:

Samaritans — 116 123 (free, 24/7)
NHS 111, option 2 — for mental health crisis
Your GP if you have one
If you're in immediate physical danger, call 999 or go to A&E

I'll be here when you're ready to come back.`;

const COOLDOWN_HOLDING_MESSAGE = "I'm here. Are you somewhere safe right now?";

const COOLDOWN_LIFT_MESSAGE =
  "I'm glad you're letting me know. How are you doing right now?";

// ============================================================================
// Helpers
// ============================================================================

function cannedResponseStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function makeStreamResponse(
  body: ReadableStream<Uint8Array>,
  conversationId: string,
): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Conversation-Id': conversationId,
    },
  });
}

// ============================================================================
// POST handler
// ============================================================================
const MESSAGE_MAX_CHARS = 8_000;

export async function POST(req: NextRequest) {
  // 1. Auth
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate limiting — per-user + per-IP, both checked before billing/body parse
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const rateLimitResult = await checkChatRateLimit(userId, ip);
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before sending another message.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimitResult.retryAfter) },
      },
    );
  }

  // 3. Legal gates + billing cap. Fetched in one query.
  //
  // Legal gates (return 412 Precondition Failed):
  //   - screening-required: User.screeningResult is null. Page-level SSR
  //     redirects to /screening; this 412 catches direct API hits.
  //   - screening-red: User screened Red. Chat is not appropriate; the
  //     screening page surfaces crisis resources instead.
  //   - disclaimer-required: User.disclaimerAcknowledgedAt is null. The
  //     /minimind page-level DisclaimerGate modal forces acknowledgement
  //     before the textarea is interactive; this 412 catches users who
  //     bypassed the modal client-side or hit the API directly.
  //
  // Billing cap (return 402): defence-in-depth — the MiniMind page SSRs
  // an at-cap banner that hides the textarea, so the client should not be
  // calling this endpoint when at-cap. This catches stale UI, direct API
  // hits, and the race where the last available message was consumed by
  // a parallel request. Crisis/cooldown branches further down do NOT
  // consume from the pool (safety surfaces are free), but the gate sits
  // above them so an at-cap user can't dump messages into a Sev 5
  // cooldown to bypass the meter.
  const billingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentTier:              true,
      messagesUsedThisCycle:    true,
      topUpMessagesRemaining:   true,
      lifetimeMessagesUsed:     true,
      screeningResult:          true,
      disclaimerAcknowledgedAt: true,
    },
  });
  if (!billingUser) {
    // User row missing — Clerk webhook race or DB inconsistency. Treat as
    // unauthorised rather than letting the request through with no
    // billing/safety context.
    return NextResponse.json({ error: 'user-not-found' }, { status: 412 });
  }
  if (!billingUser.screeningResult) {
    return NextResponse.json({ error: 'screening-required' }, { status: 412 });
  }
  if (billingUser.screeningResult === 'red') {
    return NextResponse.json({ error: 'screening-red' }, { status: 412 });
  }
  if (!billingUser.disclaimerAcknowledgedAt) {
    const hasCookie = cookies().get('mr_disclaimer_acknowledged')?.value === 'true';
    if (!hasCookie) {
      return NextResponse.json({ error: 'disclaimer-required' }, { status: 412 });
    }
    // Cookie present but DB not yet written — backfill asynchronously so the
    // next request passes the DB check without adding latency to this one.
    prisma.user.updateMany({
      where: { id: userId, disclaimerAcknowledgedAt: null },
      data: { disclaimerAcknowledgedAt: new Date() },
    }).catch((err) => console.error('[chat] disclaimer backfill failed:', err));
  }
  if (!hasCapacity(billingUser)) {
    return NextResponse.json({ error: 'at-cap' }, { status: 402 });
  }

  // 4. Body parse + validate
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
    if (message.length > MESSAGE_MAX_CHARS) {
      return NextResponse.json(
        { error: `Message too long (max ${MESSAGE_MAX_CHARS} characters)` },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  // 4. Synchronous keyword scan (< 5 ms, no IO)
  const keywordMatch = scanForKeywords(message);

  // 3b. Phase 3d — fire memory loader. Independent of conversation IO; runs
  // in parallel and is awaited after the conversation lookup completes.
  // Loader itself swallows errors and returns { hasMemory: false,
  // formattedBlock: '' } on any failure, so awaiting it cannot throw.
  const memoryPromise = loadUserMemoryContext(userId);

  // 5. Get-or-create the Conversation (owner-scoped, kind-scoped)
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
      data: { userId, kind: 'minimind', depthLevel: 'surface' },
    });
    conversationCreatedThisRequest = true;
  }

  // Sync point for the parallel memory load.
  const memory = await memoryPromise;

  // 6. Load last HISTORY_LIMIT messages (chronological) and decrypt content.
  const recentReversed = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { timestamp: 'desc' },
    take: HISTORY_LIMIT,
  });
  const history = recentReversed.reverse().map((m) => {
    let content: string;
    try {
      content = decrypt(m.content);
    } catch (err) {
      console.error('[chat] decrypt failed for message', m.id, err);
      content = '';
    }
    return { ...m, content };
  });

  // 7. Server-side duplicate-request guard (belt-and-braces with UI debounce).
  const lastMessage = history[history.length - 1];
  if (lastMessage && lastMessage.role === 'user') {
    return NextResponse.json(
      { error: 'previous turn still in progress or did not complete' },
      { status: 409 },
    );
  }

  // ==========================================================================
  // BRANCH: Conversation is in crisis cooldown
  // Memory NOT injected — cooldown delivers canned text only.
  // ==========================================================================
  if (conversation.inCrisisCooldown) {
    // Time-floor gate. If the triggering Sev 5 was within COOLDOWN_MIN_WAIT_MS,
    // skip the verifier and hold quietly — no SafetyEvent log (avoid log spam
    // of rapid-retry attempts during the cooldown window).
    const lastSev5 = await prisma.safetyEvent.findFirst({
      where: { conversationId: conversation.id, severity: 5 },
      orderBy: { triggeredAt: 'desc' },
    });
    const withinFloor =
      lastSev5 !== null &&
      Date.now() - lastSev5.triggeredAt.getTime() < COOLDOWN_MIN_WAIT_MS;

    if (withinFloor) {
      await prisma.message.create({
        data: { conversationId: conversation.id, role: 'user', content: encrypt(message) },
      });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: encrypt(COOLDOWN_HOLDING_MESSAGE),
        },
      });
      return makeStreamResponse(
        cannedResponseStream(COOLDOWN_HOLDING_MESSAGE),
        conversation.id,
      );
    }

    // Past the floor — run the verifier to decide whether to lift.
    const verifier = await runVerifier(
      message,
      history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      true,
    );

    const userMessageRow = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: encrypt(message),
      },
    });

    if (verifier.verdict === 'safety_confirmation') {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { inCrisisCooldown: false, lastActivityAt: new Date() },
      });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: encrypt(COOLDOWN_LIFT_MESSAGE),
        },
      });
      return makeStreamResponse(
        cannedResponseStream(COOLDOWN_LIFT_MESSAGE),
        conversation.id,
      );
    }

    // Hold cooldown — deliver canned holding message.
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: encrypt(COOLDOWN_HOLDING_MESSAGE),
      },
    });

    // If the verifier detected NEW crisis content in the cooldown reply, log
    // a SafetyEvent at that severity.
    if (verifier.verdict === 'clear_crisis' && verifier.severity != null) {
      await logSafetyEvent({
        userId,
        conversationId: conversation.id,
        messageId: userMessageRow.id,
        type: verifier.type ?? 'other',
        severity: verifier.severity,
        triggerExcerpt: message,
        aiResponse: COOLDOWN_HOLDING_MESSAGE,
        reasoning: verifier.reasoning,
        source: 'verifier_sync',
      });
    }

    return makeStreamResponse(
      cannedResponseStream(COOLDOWN_HOLDING_MESSAGE),
      conversation.id,
    );
  }

  // ==========================================================================
  // BRANCH: Keyword scan fired Sev 4 or Sev 5 — SKIP MiniMind
  // Memory NOT injected — canned crisis response only.
  // ==========================================================================
  if (keywordMatch.matched && keywordMatch.severity >= 4) {
    const userMessageRow = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: encrypt(message),
      },
    });

    // SafetyEvent log FIRST, before delivering the canned crisis response or
    // updating the conversation state. Audit trail integrity for Sev 4/5
    // takes priority — a crisis must never be delivered without a logged
    // event. logSafetyEvent swallows errors internally (logs [SAFETY LOG
    // FAILED] with PII-free context) so a log failure does not block the
    // crisis response below, but the ordering ensures the audit row exists
    // before anything else commits.
    await logSafetyEvent({
      userId,
      conversationId: conversation.id,
      messageId: userMessageRow.id,
      type: keywordMatch.type,
      severity: keywordMatch.severity,
      triggerExcerpt: keywordMatch.triggerExcerpt,
      aiResponse: CRISIS_RESPONSE,
      source: 'keyword',
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: encrypt(CRISIS_RESPONSE),
      },
    });

    if (keywordMatch.severity === 5) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { inCrisisCooldown: true, redFlagged: true, lastActivityAt: new Date() },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { redFlagged: true, lastActivityAt: new Date() },
      });
    }

    return makeStreamResponse(
      cannedResponseStream(CRISIS_RESPONSE),
      conversation.id,
    );
  }

  // ==========================================================================
  // BRANCH: Normal MiniMind flow (no cooldown, no Sev 4/5 keyword hit)
  // Memory IS injected here — the only path that calls Anthropic.
  // ==========================================================================

  const userMessageRow = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: encrypt(message),
    },
  });

  // Slide the retention window on every user message.
  void prisma.conversation
    .update({ where: { id: conversation.id }, data: { lastActivityAt: new Date() } })
    .catch((err) => console.error('[minimind/chat] lastActivityAt update failed:', err));

  // Sev 2/3 keyword hits: silent SafetyEvent log, MiniMind responds normally.
  if (keywordMatch.matched && keywordMatch.severity <= 3) {
    await logSafetyEvent({
      userId,
      conversationId: conversation.id,
      messageId: userMessageRow.id,
      type: keywordMatch.type,
      severity: keywordMatch.severity,
      triggerExcerpt: keywordMatch.triggerExcerpt,
      aiResponse: '(MiniMind responded normally; keyword tier was Sev 2-3)',
      source: 'keyword',
    });
  }

  // Build messages for Anthropic
  const claudeMessages: Anthropic.MessageParam[] = [
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    { role: 'user' as const, content: message },
  ];

  // Phase 3d: append the user-context block to the system prompt when present.
  // Gate is formattedBlock.length > 0 (not memory.hasMemory) per architect
  // decision — the minimal new-user block (language + screening + "first
  // meeting" signal) is genuinely useful context and worth surfacing on turn
  // 1, not deferred until the first profile update at message 21.
  const systemWithMemory =
    memory.formattedBlock.length > 0
      ? `${MINIMIND_PROMPT_V2_3}\n\n${memory.formattedBlock}`
      : MINIMIND_PROMPT_V2_3;

  // Snapshot for the async verifier task. The closure-capture is deliberate —
  // see the runAsyncVerifier comment.
  const verifierInput: AsyncVerifierInput = {
    userId,
    conversationId: conversation.id,
    messageId: userMessageRow.id,
    message,
    history: history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    keywordMatched: keywordMatch.matched,
  };

  // Captured as a promise so waitUntil() can keep the function alive until
  // it completes. Vercel's serverless lifecycle can tear down the execution
  // context once the response stream closes — a bare .catch chain is not
  // enough to guarantee the verifier (and its SafetyEvent writes) finish.
  // The .catch swallows errors so a verifier failure never bubbles up.
  const verifierTask = runAsyncVerifier(verifierInput).catch((err) => {
    console.error('[minimind/chat] async verifier task failed:', err);
  });

  // Deferred trigger for post-stream background work. The profile-update
  // promise is only created inside the ReadableStream's async callback
  // (after we know the stream produced tokens), but waitUntil() must be
  // called synchronously at the handler level before makeStreamResponse
  // returns. We bridge with a resolver: the finally block calls
  // triggerBackground(task), backgroundDone resolves when that task
  // settles, and waitUntil holds the function open until then.
  let triggerBackground!: (task: Promise<void>) => void;
  const backgroundDone = new Promise<void>((resolve) => {
    triggerBackground = (task) => {
      task.then(resolve, resolve);
    };
  });

  // Stream the Anthropic response.
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let accumulated = '';
      let streamFailed = false;

      try {
        const anthropicStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemWithMemory,
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
        if (accumulated.length === 0) {
          console.error('[minimind/chat] stream produced zero tokens', {
            conversationId: conversation.id,
            userId,
            isNewConversation: conversationCreatedThisRequest,
          });
          try {
            await prisma.message.delete({ where: { id: userMessageRow.id } });
          } catch (cleanupErr) {
            console.error(
              '[minimind/chat] failed to clean orphan user message:',
              cleanupErr,
            );
          }
          // No background work in the zero-token branch — resolve the
          // deferred immediately so waitUntil() doesn't hold the function.
          triggerBackground(Promise.resolve());
        } else {
          try {
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: 'assistant',
                content: encrypt(accumulated),
                partial: streamFailed,
              },
            });
            // Billing meter. Increment AFTER the assistant message is
            // saved so a DB failure on the message write doesn't charge
            // for a turn the user can't see. Awaited (not fire-and-
            // forget) because Vercel's serverless lifecycle can tear
            // down the execution before a bare promise resolves; the
            // ~50ms wait happens after the last token reached the
            // client, so the user perceives no delay. The try/catch
            // preserves the original intent — a DB failure logs but
            // does not 500 a successfully-delivered turn.
            try {
              await consumeMessage(userId);
            } catch (err) {
              console.error('[minimind/chat] consumeMessage failed:', err);
            }
            // Phase 3d: fire profile-update threshold check ONLY after the
            // assistant message has been persisted. Handed to
            // triggerBackground so waitUntil() keeps the function alive
            // while it runs (up to ~12s on the every-20th-message Haiku
            // call). The .catch keeps the promise chain from rejecting.
            triggerBackground(
              maybeFireProfileUpdate(userId).catch((err) =>
                console.error('[memory] profile update failed:', err),
              ),
            );
          } catch (saveErr) {
            console.error(
              '[minimind/chat] failed to save assistant message:',
              saveErr,
            );
            // Resolve the deferred so waitUntil() doesn't hold the function
            // open after a message-save failure (no background work to do).
            triggerBackground(Promise.resolve());
          }
        }

        controller.close();
      }
    },
  });

  // Register both background tasks with waitUntil so Vercel keeps the
  // function execution context alive until they settle. Promise.allSettled
  // (not Promise.all) so one task's rejection doesn't suppress the other,
  // and an unhandled rejection doesn't terminate the wait early.
  waitUntil(Promise.allSettled([verifierTask, backgroundDone]));

  return makeStreamResponse(stream, conversation.id);
}

// ============================================================================
// Phase 3d helpers
// ============================================================================

// Threshold check + fire-and-forget profile updater. Runs in the stream's
// finally block AFTER the assistant message is saved so the count reflects
// the just-completed turn. Wrapped in try/catch — failure must not affect
// chat completion.
async function maybeFireProfileUpdate(userId: string): Promise<void> {
  try {
    const totalUserMessages = await prisma.message.count({
      where: { role: 'user', conversation: { userId } },
    });
    if (
      totalUserMessages > 0 &&
      totalUserMessages % PROFILE_UPDATE_EVERY_N_MESSAGES === 0
    ) {
      updateWellbeingSnapshot(userId).catch((err) => {
        console.error('[memory] profile update task failed:', err);
      });
    }
  } catch (err) {
    console.error('[memory] profile update threshold check failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Append one { state, detectedAt } entry to the user's
// WellbeingSnapshot.recentStateOccurrences JSON array. Upsert pattern:
// creates the row if missing.
//
// Read-modify-write — concurrent calls for the same user race; last
// writer wins on the JSON array. Acceptable v1: the race window is
// ~20ms and worst case loses one entry from an array sized for cap-50.
// The 7-day pattern threshold (3+ in 7 days) is resilient to occasional
// dropped entries.
async function appendStateOccurrence(
  userId: string,
  state: string,
): Promise<void> {
  const existing = await prisma.wellbeingSnapshot.findUnique({
    where: { userId },
    select: { recentStateOccurrences: true },
  });
  const prior: { state: string; detectedAt: string }[] = Array.isArray(
    existing?.recentStateOccurrences,
  )
    ? (existing!.recentStateOccurrences as { state: string; detectedAt: string }[])
    : [];
  const appended = [
    ...prior,
    { state, detectedAt: new Date().toISOString() },
  ].slice(-RECENT_STATE_OCCURRENCES_CAP);

  await prisma.wellbeingSnapshot.upsert({
    where: { userId },
    create: { userId, recentStateOccurrences: appended },
    update: { recentStateOccurrences: appended },
  });
}

// ============================================================================
// Async verifier task — runs after the response stream is in flight
// ============================================================================

type AsyncVerifierInput = {
  userId: string;
  conversationId: string;
  messageId: string;
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  keywordMatched: boolean;
};

async function runAsyncVerifier(input: AsyncVerifierInput): Promise<void> {
  // Staleness note: `history` and `message` were closure-captured at the
  // moment the POST request was handled. If subsequent messages arrived
  // while this verifier ran, they are not visible here. This is deliberate
  // — each verifier checks the message it was given against the context
  // available at that time. Concurrent requests get their own verifier
  // tasks with their own snapshots.

  const result = await runVerifier(input.message, input.history, false);

  // Phase 3d: write state occurrence if the verifier detected a tracked
  // state. Event-driven counter for the 7-day pattern threshold; the batch
  // updater does NOT touch this field (see updater.ts header). Wrapped in
  // .catch — state-writer failure must not abort the safety-disagreement
  // logging below.
  if (result.detectedState !== 'none') {
    await appendStateOccurrence(input.userId, result.detectedState).catch(
      (err) => {
        console.error('[memory] state occurrence write failed', {
          userId: input.userId,
          state: result.detectedState,
          error: err instanceof Error ? err.message : String(err),
        });
      },
    );
  }

  // Disagreement A: keyword fired but verifier says clear_safe.
  // Log as Sev 1 — "verifier-downgraded keyword hit" (false-positive signal).
  if (input.keywordMatched && result.verdict === 'clear_safe') {
    await logSafetyEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      type: 'other',
      severity: 1,
      triggerExcerpt: input.message,
      aiResponse: '(verifier downgraded keyword match; no user-facing change)',
      reasoning: result.reasoning,
      source: 'verifier_async',
    });
    return;
  }

  // Disagreement B: keyword missed but verifier says clear_crisis (Sev 4-5).
  // The user already received MiniMind's normal reply (no retroactive UI
  // change in v1). Log + console alert for review.
  if (
    !input.keywordMatched &&
    result.verdict === 'clear_crisis' &&
    result.severity != null
  ) {
    console.error(
      '[ASYNC SAFETY FLAG] verifier flagged crisis where keyword missed',
      {
        conversationId: input.conversationId,
        userId: input.userId,
        severity: result.severity,
        type: result.type,
      },
    );
    await logSafetyEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      type: result.type ?? 'other',
      severity: result.severity,
      triggerExcerpt: input.message,
      aiResponse: '(verifier flagged after MiniMind already responded; review)',
      reasoning: result.reasoning,
      source: 'verifier_async',
    });
    return;
  }

  // Disagreement C: keyword missed, verifier says ambiguous (Sev 3).
  // Silent log for trend tracking.
  if (
    !input.keywordMatched &&
    result.verdict === 'ambiguous' &&
    result.severity != null
  ) {
    await logSafetyEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      type: result.type ?? 'other',
      severity: result.severity,
      triggerExcerpt: input.message,
      aiResponse: '(MiniMind responded normally; verifier flagged Sev 3)',
      reasoning: result.reasoning,
      source: 'verifier_async',
    });
    return;
  }

  // All other combinations: nothing additional to log. Either the sync path
  // already wrote a SafetyEvent (keyword Sev 2/3, normal flow), or the
  // verifier agreed there's nothing concerning.
}
