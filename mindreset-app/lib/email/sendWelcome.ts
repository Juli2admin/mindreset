import prisma from '@/lib/prisma';
import { getResend, FROM_ADDRESS } from './resend';
import { getWelcomeSubject, getWelcomePlainText, getWelcomeHtml, WelcomeLocale } from './welcome';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mindreset.ai';

// Sends the welcome email exactly once per user. Safe to call on every
// /account visit — the updateMany guard ensures only the first call wins.
export async function sendWelcomeEmail({
  userId,
  email,
  locale,
}: {
  userId: string;
  email: string;
  locale: string;
}): Promise<void> {
  // Atomically claim the send slot. If count === 0, another call already sent.
  const claimed = await prisma.user.updateMany({
    where: { id: userId, welcomeEmailSentAt: null },
    data: { welcomeEmailSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  // Resolve to a supported template locale; fall back to EN.
  const templateLocale: WelcomeLocale = locale === 'ru' ? 'ru' : 'en';

  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome email for', email);
    return;
  }

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: getWelcomeSubject(templateLocale),
    text: getWelcomePlainText(templateLocale),
    html: getWelcomeHtml(templateLocale, APP_URL),
  });

  if (error) {
    console.error('[email] welcome email failed to send:', error);
    // welcomeEmailSentAt is already written — won't retry automatically.
    // This is intentional: prefer one failed send over potential duplicates.
    // If needed, Julia can manually null the field in Supabase to trigger a resend.
  }
}
