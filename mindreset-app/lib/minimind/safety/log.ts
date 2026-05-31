// SafetyEvent logger for the Phase 3c safety scanner.
//
// Writes to the SafetyEvent table via Prisma. Failures inside this function
// must NEVER throw to the caller — safety logging failing must not break
// user-facing chat. All errors are swallowed and console.error'd.
//
// Sev 5 events also (a) emit a [SEV5 CRISIS] console.error with
// conversationId and userId (no excerpt — keeps log surfaces PII-light),
// and (b) trigger a Resend email to the operator via sendSev5Alert.
// The email send is fire-and-forget via waitUntil so Resend latency
// doesn't block the chat response; failures are caught and logged.

import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { sendSev5Alert } from '@/lib/email/sendSev5Alert';

const TRIGGER_EXCERPT_MAX_CHARS = 500;

export type SafetyEventLogParams = {
  userId: string;
  conversationId: string;
  messageId?: string;
  type: string; // matches SafetyEvent.type field (free-form string in schema)
  severity: 1 | 2 | 3 | 4 | 5;
  triggerExcerpt: string;
  aiResponse: string;
  reasoning?: string; // from verifier, included in reviewNotes
  source: 'keyword' | 'verifier_sync' | 'verifier_async';
};

export async function logSafetyEvent(params: SafetyEventLogParams): Promise<void> {
  // Entry signal — distinguishes "never called" from "called but failed"
  // in Vercel logs. No PII; just routing metadata. Cheap (a handful per day
  // at our scale) and saves real time on future investigations.
  console.log('[safety] event log starting', {
    conversationId: params.conversationId,
    severity: params.severity,
    source: params.source,
  });

  try {
    const truncated = (params.triggerExcerpt ?? '').slice(
      0,
      TRIGGER_EXCERPT_MAX_CHARS,
    );

    const reviewNotes = [
      `source: ${params.source}`,
      params.reasoning ? `reasoning: ${params.reasoning}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    await prisma.safetyEvent.create({
      data: {
        userId: params.userId,
        conversationId: params.conversationId,
        messageId: params.messageId ?? null,
        type: params.type,
        severity: params.severity,
        triggerExcerpt: truncated,
        aiResponse: params.aiResponse,
        reviewNotes: reviewNotes || null,
      },
    });

    if (params.severity === 5) {
      // Real-time signal — kept as belt-and-braces alongside the email.
      // PII-light by intent — no excerpt in this log surface.
      console.error('[SEV5 CRISIS]', {
        conversationId: params.conversationId,
        userId: params.userId,
        source: params.source,
        type: params.type,
      });

      // Look up the user's email for the alert and fire the send
      // asynchronously via waitUntil. The caller (chat route) has
      // already returned its response by the time this completes —
      // waitUntil keeps the function alive long enough for Resend to
      // accept the request. Failures are caught and logged; we never
      // throw back to the caller.
      const userEmailPromise = prisma.user
        .findUnique({
          where: { id: params.userId },
          select: { email: true },
        })
        .then((u) => u?.email ?? null)
        .catch(() => null);

      waitUntil(
        (async () => {
          const userEmail = await userEmailPromise;
          const result = await sendSev5Alert({
            conversationId: params.conversationId,
            userId: params.userId,
            userEmail,
            type: params.type,
            source: params.source,
            triggerExcerpt: params.triggerExcerpt,
            aiResponse: params.aiResponse,
            reasoning: params.reasoning,
          });
          if (result.ok === false) {
            console.error('[SEV5 ALERT EMAIL FAILED]', {
              error: result.error,
              conversationId: params.conversationId,
              userId: params.userId,
            });
          }
        })(),
      );
    }
  } catch (err) {
    // Safety logging failure must never break user-facing chat. Loud +
    // filterable tag so Vercel log search surfaces these immediately —
    // silent audit-logger failure is itself a Sev-class incident. Diagnostic
    // context is PII-free (field lengths and structural metadata, not
    // contents) so the log surface stays safe to retain.
    console.error('[SAFETY LOG FAILED]', {
      error: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : undefined,
      userId: params.userId,
      conversationId: params.conversationId,
      hasMessageId: !!params.messageId,
      type: params.type,
      severity: params.severity,
      source: params.source,
      triggerExcerptLength: (params.triggerExcerpt ?? '').length,
      aiResponseLength: (params.aiResponse ?? '').length,
      hasReasoning: !!params.reasoning,
    });
  }
}
