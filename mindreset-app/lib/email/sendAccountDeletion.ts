import { getResend, FROM_ADDRESS } from './resend';
import {
  EmailLocale,
  getDeletionConfirmSubject,
  getDeletionConfirmPlainText,
  getDeletionConfirmHtml,
  getDeletionScheduledSubject,
  getDeletionScheduledPlainText,
  getDeletionScheduledHtml,
} from './accountDeletion';

// Fallback only — callers pass the request's actual origin so the
// confirm link goes back to the same deployment that initiated the
// request (preview URLs included). Hardcoding mindreset.ai sent users
// to an outdated production deployment that didn't have the route yet.
const FALLBACK_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindreset.ai';

function resolveLocale(locale: string): EmailLocale {
  return locale === 'ru' ? 'ru' : 'en';
}

export async function sendDeletionConfirmEmail({
  email,
  locale,
  confirmPath,
  origin,
}: {
  email: string;
  locale: string;
  confirmPath: string; // e.g. "/account/confirm-delete?token=..."
  origin: string;      // e.g. "https://mindreset-git-….vercel.app"
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping deletion confirm for', email);
    return;
  }
  const t = resolveLocale(locale);
  const base = origin || FALLBACK_APP_URL;
  const confirmUrl = `${base}${locale === 'en' ? '' : '/' + locale}${confirmPath}`;
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: getDeletionConfirmSubject(t),
    text: getDeletionConfirmPlainText(t, confirmUrl),
    html: getDeletionConfirmHtml(t, confirmUrl),
  });
  if (error) {
    console.error('[email] deletion confirm failed to send:', error);
    throw new Error('Failed to send confirmation email');
  }
}

export async function sendDeletionScheduledEmail({
  email,
  locale,
  scheduledAt,
  origin,
}: {
  email: string;
  locale: string;
  scheduledAt: Date;
  origin: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping deletion scheduled for', email);
    return;
  }
  const t = resolveLocale(locale);
  const dateFmtLocale = locale === 'en' ? 'en-GB' : locale;
  const scheduledDateStr = new Intl.DateTimeFormat(dateFmtLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(scheduledAt);
  const base = origin || FALLBACK_APP_URL;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: getDeletionScheduledSubject(t),
    text: getDeletionScheduledPlainText(t, scheduledDateStr, base),
    html: getDeletionScheduledHtml(t, scheduledDateStr, base),
  });
  if (error) {
    console.error('[email] deletion scheduled failed to send:', error);
    // Non-fatal — deletion is already scheduled in DB.
  }
}
