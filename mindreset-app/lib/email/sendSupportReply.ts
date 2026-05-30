// Resend send wrapper for outbound support replies. Sends via the existing
// Resend client; FROM defaults to RESEND_FROM_SUPPORT_EMAIL (which itself
// defaults to RESEND_FROM_EMAIL when not set, so the helper works today
// while DNS for support@mindreset.ai is still pending — flip the env var
// to "MindReset Support <support@mindreset.ai>" once the mailbox is live).

import { getResend } from './resend';

const FROM_ADDRESS_FALLBACK = 'MindReset.ai <hello@mindreset.ai>';

function fromAddress(): string {
  return (
    process.env.RESEND_FROM_SUPPORT_EMAIL ??
    process.env.RESEND_FROM_EMAIL ??
    FROM_ADDRESS_FALLBACK
  );
}

export type SendSupportReplyInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  body: string;
  // The inbound subject if any — we prefix with "Re: " when present so
  // the outgoing email threads cleanly in the recipient's client.
  inboundSubject?: string | null;
};

export type SendSupportReplyResult =
  | { ok: true; resendId: string }
  | { ok: false; error: string };

function threadedSubject(input: SendSupportReplyInput): string {
  if (input.inboundSubject && !/^re:\s/i.test(input.inboundSubject)) {
    return `Re: ${input.inboundSubject}`;
  }
  return input.inboundSubject ?? input.subject;
}

export async function sendSupportReply(
  input: SendSupportReplyInput,
): Promise<SendSupportReplyResult> {
  try {
    const to = input.toName ? `${input.toName} <${input.toEmail}>` : input.toEmail;

    const result = await getResend().emails.send({
      from: fromAddress(),
      to,
      subject: threadedSubject(input),
      text: input.body,
    });

    if (result.error) {
      console.error('[sendSupportReply] Resend error:', result.error);
      return { ok: false, error: result.error.message ?? 'Resend send failed' };
    }
    if (!result.data?.id) {
      return { ok: false, error: 'Resend response missing id' };
    }

    return { ok: true, resendId: result.data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sendSupportReply] threw:', msg);
    return { ok: false, error: msg };
  }
}
