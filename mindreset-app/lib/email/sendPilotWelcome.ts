// Pilot welcome email sender.
//
// PR ω2 (2026-07-14). Fires exactly once per PilotInvitation, at the
// moment the tester redeems. Contains the PILOT_BEFORE_FORM_URL (Julia's
// questionnaire) prominently so testers can find it in their inbox even
// if they never come back to the /redeem success page.
//
// Idempotency: atomic updateMany on welcomeEmailSentAt=null. Multiple
// concurrent redeem-page renders end up with only one send.

import prisma from '@/lib/prisma';
import { getResend, FROM_ADDRESS } from './resend';
import {
  getPilotWelcomeSubject,
  getPilotWelcomePlainText,
  getPilotWelcomeHtml,
  type PilotLocale,
} from './pilotWelcome';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindreset.ai';

/**
 * Send the pilot welcome email once per invitation. Safe to call from
 * every /redeem/[code] render — the updateMany guard ensures only the
 * first call wins.
 *
 * Silently returns without sending when:
 *   - The invitation has already been welcomed (idempotency guard fired).
 *   - PILOT_BEFORE_FORM_URL is not configured (nothing meaningful to send).
 *   - RESEND_API_KEY is not configured (transactional emails disabled).
 */
export async function sendPilotWelcomeEmail({
  invitationId,
  email,
  locale,
}: {
  invitationId: string;
  email: string;
  locale: string;
}): Promise<void> {
  const formUrl = process.env.PILOT_BEFORE_FORM_URL;
  if (!formUrl) {
    console.warn(
      '[pilot-welcome] PILOT_BEFORE_FORM_URL not set — cannot send welcome for',
      invitationId,
    );
    return;
  }

  // Atomically claim the send slot.
  const claimed = await prisma.pilotInvitation.updateMany({
    where: { id: invitationId, welcomeEmailSentAt: null },
    data: { welcomeEmailSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      '[pilot-welcome] RESEND_API_KEY not set — skipping pilot welcome for',
      email,
    );
    return;
  }

  const templateLocale: PilotLocale = locale === 'ru' ? 'ru' : 'en';
  const journeyUrl =
    templateLocale === 'ru' ? `${APP_URL}/ru/journey` : `${APP_URL}/journey`;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: getPilotWelcomeSubject(templateLocale),
    text: getPilotWelcomePlainText(templateLocale, formUrl, journeyUrl),
    html: getPilotWelcomeHtml(templateLocale, formUrl, journeyUrl),
  });

  if (error) {
    console.error('[pilot-welcome] send failed:', error);
    // welcomeEmailSentAt is already stamped — won't auto-retry.
    // Julia can null the field in Supabase if a retry is needed.
  }
}
