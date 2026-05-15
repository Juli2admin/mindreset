// SafetyEvent logger for the Phase 3c safety scanner.
//
// Writes to the SafetyEvent table via Prisma. Failures inside this function
// must NEVER throw to the caller — safety logging failing must not break
// user-facing chat. All errors are swallowed and console.error'd.
//
// Sev 5 events also emit a [SEV5 CRISIS] console.error with conversationId
// and userId (no excerpt — keeps log surfaces PII-light). When Resend ships,
// this signal is what trips the real-time email.

import prisma from '@/lib/prisma';

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
      // Real-time stopgap per Phase 3c Path A. When Resend ships, this is
      // the trigger point for the operational alert email. PII-light by
      // intent — no excerpt in this log surface.
      console.error('[SEV5 CRISIS]', {
        conversationId: params.conversationId,
        userId: params.userId,
        source: params.source,
        type: params.type,
      });
    }
  } catch (err) {
    // Safety logging failure must never break user-facing chat. Log and swallow.
    console.error('[logSafetyEvent] write failed:', err);
  }
}
