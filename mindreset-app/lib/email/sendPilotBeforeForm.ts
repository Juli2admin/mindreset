// Pilot Before-form nudge sender.
//
// PR ω3a (2026-07-14). Fires exactly once per pilot invitation, from the
// Journey page's server component on the tester's first Journey visit
// (see /app/[locale]/journey/page.tsx). Idempotent via atomic
// updateMany on beforeFormEmailSentAt.

import prisma from '@/lib/prisma';
import { getResend, FROM_ADDRESS } from './resend';
import {
  getPilotBeforeFormSubject,
  getPilotBeforeFormPlainText,
  getPilotBeforeFormHtml,
  type PilotLocale,
} from './pilotBeforeForm';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindreset.ai';

/**
 * Send the Before-form nudge email once per PilotInvitation. Safe to
 * call from every /journey page render — the updateMany guard ensures
 * only the first call wins.
 *
 * Returns without sending when:
 *   - beforeFormEmailSentAt is already set (idempotency guard fired).
 *   - beforeFormFilled is already true (tester filled it via another
 *     path — no point nudging).
 *   - RESEND_API_KEY not configured.
 */
export async function sendPilotBeforeFormEmail({
  invitationId,
  email,
  locale,
}: {
  invitationId: string;
  email: string;
  locale: string;
}): Promise<void> {
  // Atomically claim the send slot. Also guard on beforeFormFilled so a
  // tester who submitted before this ever fires (via a direct visit to
  // /pilot/before) doesn't get a nudge for something they've already
  // done.
  const claimed = await prisma.pilotInvitation.updateMany({
    where: {
      id: invitationId,
      beforeFormEmailSentAt: null,
      beforeFormFilled: false,
    },
    data: { beforeFormEmailSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      '[pilot-before-form] RESEND_API_KEY not set — skipping nudge for',
      email,
    );
    return;
  }

  const templateLocale: PilotLocale = locale === 'ru' ? 'ru' : 'en';
  const formUrl =
    templateLocale === 'ru' ? `${APP_URL}/ru/pilot/before` : `${APP_URL}/pilot/before`;
  const journeyUrl =
    templateLocale === 'ru' ? `${APP_URL}/ru/journey` : `${APP_URL}/journey`;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: getPilotBeforeFormSubject(templateLocale),
    text: getPilotBeforeFormPlainText(templateLocale, formUrl, journeyUrl),
    html: getPilotBeforeFormHtml(templateLocale, formUrl, journeyUrl),
  });

  if (error) {
    console.error('[pilot-before-form] send failed:', error);
    // beforeFormEmailSentAt is already stamped — won't auto-retry.
    // Julia can null the field in Supabase if a retry is needed.
  }
}
