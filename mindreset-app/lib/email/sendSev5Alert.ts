// Sev-5 alert email. Fired by lib/minimind/safety/log.ts when a user
// hits the highest-severity safety event (suicidal ideation with intent
// + specificity / imminence, etc.). Goes to the operator (Julia) in
// real time so a human can see the in-app crisis routing happened AND
// follow up if needed.
//
// Recipient: SEV5_ALERT_EMAIL env var first, falling back to the first
// address in ADMIN_EMAILS, falling back to a hard-coded safety net.
// Multiple comma-separated addresses are supported.
//
// FROM: shared RESEND_FROM_EMAIL (hello@mindreset.ai). Replies aren't
// meaningful — this is a one-way operational notification.
//
// Failure mode: caller is expected to wrap this in .catch() and a
// waitUntil() so Resend latency doesn't block the chat response and a
// Resend outage doesn't crash safety logging.

import { getResend } from './resend';

const FROM_ADDRESS_FALLBACK = 'MindReset.ai <hello@mindreset.ai>';
const HARD_CODED_FALLBACK_RECIPIENT = 'jloya4436@gmail.com';

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? FROM_ADDRESS_FALLBACK;
}

function recipients(): string[] {
  const explicit = process.env.SEV5_ALERT_EMAIL?.trim();
  if (explicit) {
    return explicit.split(',').map((e) => e.trim()).filter(Boolean);
  }
  const admins = process.env.ADMIN_EMAILS?.trim();
  if (admins) {
    return admins.split(',').map((e) => e.trim()).filter(Boolean);
  }
  return [HARD_CODED_FALLBACK_RECIPIENT];
}

export type Sev5AlertInput = {
  conversationId: string;
  userId: string;
  userEmail: string | null;
  type: string;
  source: 'keyword' | 'verifier_sync' | 'verifier_async';
  triggerExcerpt: string;
  aiResponse: string;
  reasoning?: string;
};

export type Sev5AlertResult =
  | { ok: true; resendId: string }
  | { ok: false; error: string };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindreset.ai';
}

function composeBody(input: Sev5AlertInput): string {
  // Plain text, easy to read on a phone screen. Includes the full
  // excerpt and AI response because this is admin-only operational
  // mail — the operator needs to see what happened to decide whether
  // to follow up. Same data already lives in the SafetyEvent table.
  return [
    'A Sev-5 safety event was logged in MiniMind.',
    '',
    `When: ${new Date().toISOString()}`,
    `User: ${input.userEmail ?? '(no email available)'}`,
    `User ID: ${input.userId}`,
    `Conversation ID: ${input.conversationId}`,
    `Type: ${input.type}`,
    `Detection source: ${input.source}`,
    '',
    '--- Trigger excerpt ---',
    input.triggerExcerpt || '(empty)',
    '',
    '--- AI response shown to user ---',
    input.aiResponse || '(empty)',
    '',
    input.reasoning ? `--- Verifier reasoning ---\n${input.reasoning}\n` : '',
    `Review queue: ${appUrl()}/admin/support`,
    '',
    "This is an automated alert — the in-app crisis-routing has already shown the user the appropriate resources. Follow up only if your judgment says it's warranted.",
  ].join('\n');
}

export async function sendSev5Alert(input: Sev5AlertInput): Promise<Sev5AlertResult> {
  try {
    const to = recipients();
    if (to.length === 0) {
      return { ok: false, error: 'No recipient configured' };
    }

    const result = await getResend().emails.send({
      from: fromAddress(),
      to,
      subject: `[Sev-5] MiniMind — ${input.type} (${input.source})`,
      text: composeBody(input),
    });

    if (result.error) {
      return { ok: false, error: result.error.message ?? 'Resend send failed' };
    }
    if (!result.data?.id) {
      return { ok: false, error: 'Resend response missing id' };
    }
    return { ok: true, resendId: result.data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
