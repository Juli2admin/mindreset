// Subscription lifecycle email templates — EN + RU.
// Triggered from app/api/stripe/webhook/route.ts on:
//   customer.subscription.created  → confirmed
//   customer.subscription.deleted  → cancelled
//   invoice.payment_failed         → payment failed
//
// EN is the source of truth; RU is hand-translated per CLAUDE.md
// (formal Вы, feminine grammatical forms where applicable).
// All other locales fall back to EN — Pattern A doesn't ship
// FR/DE/ES/IT/PL/PT for transactional email yet.

export type SubLocale = 'en' | 'ru';

export function resolveSubLocale(locale: string | null | undefined): SubLocale {
  return locale === 'ru' ? 'ru' : 'en';
}

// ---------------------------------------------------------------------------
// Subscription CONFIRMED
// ---------------------------------------------------------------------------

export function subConfirmedSubject(locale: SubLocale): string {
  return locale === 'ru'
    ? 'Ваша подписка MindReset активирована'
    : 'Your MindReset subscription is active';
}

export function subConfirmedBody(
  locale: SubLocale,
  vars: { tier: string },
): string {
  if (locale === 'ru') {
    return [
      `Ваша подписка MindReset ${vars.tier} активирована. Войдите в любое время на mindreset.ai/home — лимит сообщений обновляется в начале каждого расчётного периода.`,
      '',
      'Управлять подпиской, менять тариф или отписаться можно в настройках аккаунта в любое время.',
      '',
      '— Команда MindReset',
      '',
      'Вопросы? Загляните в наш FAQ на mindreset.ai/faq или напишите на support@mindreset.ai.',
    ].join('\n');
  }
  return [
    `Your MindReset ${vars.tier} subscription is now active. Sign in anytime at mindreset.ai/home — your message allowance refreshes each billing cycle.`,
    '',
    'Manage your subscription, change tier, or cancel anytime from your account settings.',
    '',
    '— The MindReset team',
    '',
    'Questions? Check our FAQ at mindreset.ai/faq, or write to support@mindreset.ai.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Subscription CANCELLED
// ---------------------------------------------------------------------------

export function subCancelledSubject(locale: SubLocale): string {
  return locale === 'ru'
    ? 'Ваша подписка MindReset отменена'
    : 'Your MindReset subscription has been cancelled';
}

export function subCancelledBody(
  locale: SubLocale,
  vars: { accessEndDate: string },
): string {
  if (locale === 'ru') {
    return [
      `Мы отменили Вашу подписку MindReset по запросу. Доступ сохраняется до ${vars.accessEndDate}.`,
      '',
      'После этой даты подписка завершится. Вы можете возобновить её в любое время, чтобы продолжить общение с MiniMind — Ваши разговоры, прогресс и история сохранены. Ничего не потеряно.',
      '',
      '— Команда MindReset',
      '',
      'Вопросы? Загляните в наш FAQ на mindreset.ai/faq или напишите на support@mindreset.ai.',
    ].join('\n');
  }
  return [
    `We've cancelled your MindReset subscription as requested. Your access continues until ${vars.accessEndDate}.`,
    '',
    'After that, your subscription ends. You can resubscribe any time to continue chatting with MiniMind — your conversations, progress, and history are preserved either way. Nothing is lost.',
    '',
    '— The MindReset team',
    '',
    'Questions? Check our FAQ at mindreset.ai/faq, or write to support@mindreset.ai.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Payment FAILED
// ---------------------------------------------------------------------------

export function paymentFailedSubject(locale: SubLocale): string {
  return locale === 'ru'
    ? 'Мы не смогли обработать платёж'
    : "We couldn't process your payment";
}

export function paymentFailedBody(locale: SubLocale): string {
  if (locale === 'ru') {
    return [
      'Последний платёж по Вашей подписке MindReset не прошёл. Доступ к подписке приостановлен.',
      '',
      'Чтобы возобновить доступ, обновите способ оплаты на mindreset.ai/home → Управление подпиской. Как только платёж пройдёт, доступ активируется автоматически.',
      '',
      'Если Вы не обновите карту, Stripe закроет подписку после серии повторных попыток. Ваши разговоры и прогресс сохранятся, если решите подписаться снова.',
      '',
      '— Команда MindReset',
      '',
      'Вопросы? Загляните в наш FAQ на mindreset.ai/faq или напишите на support@mindreset.ai.',
    ].join('\n');
  }
  return [
    "Your most recent MindReset subscription payment didn't go through. Your subscription access has been paused.",
    '',
    'To resume access, update your payment method at mindreset.ai/home → Manage subscription. Once payment succeeds, your access reactivates automatically.',
    '',
    "If you don't update your card, Stripe will close the subscription after its retry window. Your conversations and progress remain available if you resubscribe later.",
    '',
    '— The MindReset team',
    '',
    'Questions? Check our FAQ at mindreset.ai/faq, or write to support@mindreset.ai.',
  ].join('\n');
}
