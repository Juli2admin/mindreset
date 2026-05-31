// Resend wrappers for the three subscription lifecycle emails.
// Each one is called from the Stripe webhook via waitUntil() — failures
// log but never throw back (webhook handler must keep returning 200).

import { getResend, FROM_ADDRESS } from './resend';
import {
  resolveSubLocale,
  subConfirmedSubject,
  subConfirmedBody,
  subCancelledSubject,
  subCancelledBody,
  paymentFailedSubject,
  paymentFailedBody,
} from './subscriptionLifecycle';

function formatTier(tier: string): string {
  if (tier === 'essential') return 'Essential';
  if (tier === 'extended') return 'Extended';
  return tier;
}

function formatAccessEndDate(periodEndSeconds: number | null, locale: string): string {
  if (!periodEndSeconds) return locale === 'ru' ? 'окончание текущего периода' : 'the end of your current period';
  const d = new Date(periodEndSeconds * 1000);
  // en-GB for English (UK brand); ru-RU for Russian.
  const fmt = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return fmt.format(d);
}

type Common = {
  to: string;
  userLocale: string | null;
};

export async function sendSubscriptionConfirmed(
  input: Common & { tier: string },
): Promise<void> {
  const locale = resolveSubLocale(input.userLocale);
  const tier = formatTier(input.tier);

  try {
    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      subject: subConfirmedSubject(locale),
      text: subConfirmedBody(locale, { tier }),
    });
    if (error) {
      console.error('[email] subscription-confirmed send failed:', error);
    }
  } catch (err) {
    console.error('[email] subscription-confirmed threw:', err);
  }
}

export async function sendSubscriptionCancelled(
  input: Common & { periodEndSeconds: number | null },
): Promise<void> {
  const locale = resolveSubLocale(input.userLocale);
  const accessEndDate = formatAccessEndDate(input.periodEndSeconds, locale);

  try {
    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      subject: subCancelledSubject(locale),
      text: subCancelledBody(locale, { accessEndDate }),
    });
    if (error) {
      console.error('[email] subscription-cancelled send failed:', error);
    }
  } catch (err) {
    console.error('[email] subscription-cancelled threw:', err);
  }
}

export async function sendPaymentFailed(input: Common): Promise<void> {
  const locale = resolveSubLocale(input.userLocale);

  try {
    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      subject: paymentFailedSubject(locale),
      text: paymentFailedBody(locale),
    });
    if (error) {
      console.error('[email] payment-failed send failed:', error);
    }
  } catch (err) {
    console.error('[email] payment-failed threw:', err);
  }
}
