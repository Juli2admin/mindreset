// Onboarding drip send wrappers. Mirrors sendMarketing.ts — these are
// marketing emails under PECR/GDPR (not transactional), so each send
// includes a per-recipient HMAC unsubscribe link in the footer AND the
// RFC 8058 List-Unsubscribe headers so Gmail/Apple Mail surface a
// native Unsubscribe button at the top of the message.
//
// Failures return discriminated { ok } / { ok: false, error } — the
// cron handler logs failures and continues to the next user without
// re-trying within the same run. The drip1SentAt / drip2SentAt stamps
// are written ONLY when send succeeds (handled by the cron handler),
// so a transient Resend outage just leaves the user eligible for the
// next day's cron run.

import { getResend } from './resend';
import { signUnsubscribeToken } from './unsubscribe';
import {
  resolveDripLocale,
  drip1Subject,
  drip1Body,
  drip2Subject,
  drip2Body,
} from './drip';

const FROM_ADDRESS_FALLBACK = 'MindReset.ai <hello@mindreset.ai>';

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? FROM_ADDRESS_FALLBACK;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindreset.ai';
}

function unsubFooter(userId: string): string {
  const token = signUnsubscribeToken(userId);
  const url = `${appUrl()}/unsubscribe/${encodeURIComponent(token)}`;
  return [
    '',
    '---',
    "You're receiving this because you opted in to MindReset updates.",
    `Unsubscribe: ${url}`,
  ].join('\n');
}

function unsubHeaders(userId: string): Record<string, string> {
  const token = signUnsubscribeToken(userId);
  const url = `${appUrl()}/unsubscribe/${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export type DripSendInput = {
  userId: string;
  email: string;
  userLocale: string | null;
};

export type DripSendResult =
  | { ok: true; resendId: string }
  | { ok: false; error: string };

async function sendDrip(
  input: DripSendInput,
  subject: string,
  body: string,
): Promise<DripSendResult> {
  try {
    const composedBody = `${body}\n${unsubFooter(input.userId)}`;
    const result = await getResend().emails.send({
      from: fromAddress(),
      to: input.email,
      subject,
      text: composedBody,
      headers: unsubHeaders(input.userId),
    });
    if (result.error) {
      return { ok: false, error: result.error.message ?? 'Resend send failed' };
    }
    if (!result.data?.id) {
      return { ok: false, error: 'Resend response missing id' };
    }
    return { ok: true, resendId: result.data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendDrip1(input: DripSendInput): Promise<DripSendResult> {
  const locale = resolveDripLocale(input.userLocale);
  return sendDrip(input, drip1Subject(locale), drip1Body(locale));
}

export async function sendDrip2(input: DripSendInput): Promise<DripSendResult> {
  const locale = resolveDripLocale(input.userLocale);
  return sendDrip(input, drip2Subject(locale), drip2Body(locale));
}
