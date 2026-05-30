// Marketing send wrapper. One Resend call per recipient — Resend has a
// batch endpoint but per-recipient calls keep the unsubscribe link
// personalised (each email carries the recipient's HMAC token, not a
// shared placeholder). For launch volume (low hundreds) this is fine.
//
// Body composition: admin's plain-text body + a fixed footer with the
// recipient's unsubscribe link. Footer is hard-coded English; PR 3c
// can localise per recipient.locale once Resend Audiences are in.

import { getResend } from './resend';
import { signUnsubscribeToken } from './unsubscribe';

const FROM_ADDRESS_FALLBACK = 'MindReset.ai <hello@mindreset.ai>';

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? FROM_ADDRESS_FALLBACK;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindreset.ai';
}

export type SendMarketingInput = {
  toEmail: string;
  userId: string;        // for the unsubscribe HMAC token
  subject: string;
  body: string;
};

export type SendMarketingResult =
  | { ok: true; resendId: string }
  | { ok: false; error: string };

function composeFooter(userId: string): string {
  const token = signUnsubscribeToken(userId);
  const unsubUrl = `${appUrl()}/unsubscribe/${encodeURIComponent(token)}`;
  return [
    '',
    '---',
    "You're receiving this because you opted in to MindReset updates.",
    `Unsubscribe: ${unsubUrl}`,
  ].join('\n');
}

export async function sendMarketing(
  input: SendMarketingInput,
): Promise<SendMarketingResult> {
  const composedBody = `${input.body.trim()}\n${composeFooter(input.userId)}`;

  try {
    const result = await getResend().emails.send({
      from: fromAddress(),
      to: input.toEmail,
      subject: input.subject,
      text: composedBody,
      // RFC 8058 one-click unsubscribe header. Gmail/Apple Mail/Outlook
      // surface this as a built-in "Unsubscribe" button — better than
      // expecting users to find the footer link.
      headers: {
        'List-Unsubscribe': `<${appUrl()}/unsubscribe/${encodeURIComponent(signUnsubscribeToken(input.userId))}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
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
