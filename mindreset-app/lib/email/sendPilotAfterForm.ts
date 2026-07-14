// Pilot After-form nudge sender.
//
// PR ω3b (2026-07-14). Fires from the daily cron
// (app/api/cron/pilot-after-nudge/route.ts) once per PilotInvitation
// when the tester's beforeFormFilledAt is > 30 days ago and they
// haven't submitted After yet. Idempotent via atomic updateMany on
// afterFormEmailSentAt. Manual re-send from the admin surface
// re-arms the guard.

import prisma from '@/lib/prisma';
import { getResend, FROM_ADDRESS } from './resend';
import {
  getPilotAfterFormSubject,
  getPilotAfterFormPlainText,
  getPilotAfterFormHtml,
  type PilotLocale,
} from './pilotAfterForm';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindreset.ai';

/**
 * Send the After-form nudge once per PilotInvitation. Guarded by
 * atomic updateMany({ afterFormEmailSentAt: null, afterFormFilled:
 * false, revokedAt: null }) — concurrent runs / retries end up with
 * only one send.
 */
export async function sendPilotAfterFormEmail({
  invitationId,
  email,
  locale,
}: {
  invitationId: string;
  email: string;
  locale: string;
}): Promise<void> {
  const claimed = await prisma.pilotInvitation.updateMany({
    where: {
      id: invitationId,
      afterFormEmailSentAt: null,
      afterFormFilled: false,
      revokedAt: null,
    },
    data: { afterFormEmailSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      '[pilot-after-form] RESEND_API_KEY not set — skipping nudge for',
      email,
    );
    return;
  }

  const templateLocale: PilotLocale = locale === 'ru' ? 'ru' : 'en';
  const formUrl =
    templateLocale === 'ru' ? `${APP_URL}/ru/pilot/after` : `${APP_URL}/pilot/after`;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: getPilotAfterFormSubject(templateLocale),
    text: getPilotAfterFormPlainText(templateLocale, formUrl),
    html: getPilotAfterFormHtml(templateLocale, formUrl),
  });

  if (error) {
    console.error('[pilot-after-form] send failed:', error);
  }
}
