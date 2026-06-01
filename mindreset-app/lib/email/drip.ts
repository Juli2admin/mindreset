// Onboarding drip email templates — EN + RU, owner-authored 2026-06-01.
// Triggered by /api/cron/drip on the daily 10:00 UTC schedule (see
// vercel.json). Sent only to users with marketingConsent=true — these
// are marketing emails under PECR/GDPR, not transactional.
//
// Subjects + bodies are owner-authored copy. Don't tweak without
// sign-off; the trauma-informed brand voice is load-bearing.

export type DripLocale = 'en' | 'ru';

export function resolveDripLocale(locale: string | null | undefined): DripLocale {
  return locale === 'ru' ? 'ru' : 'en';
}

// ---------------------------------------------------------------------------
// Drip 1 — Day 1 (24-48h after signup, no MiniMind message yet)
// ---------------------------------------------------------------------------

export function drip1Subject(locale: DripLocale): string {
  return locale === 'ru'
    ? 'Вы пришли сюда не случайно'
    : 'Something brought you here';
}

export function drip1Body(locale: DripLocale): string {
  if (locale === 'ru') {
    return [
      'Здравствуйте,',
      '',
      'Обычно люди приходят в MindReset не случайно.',
      '',
      'Чаще всего за этим стоит что-то ещё — чувство потерянности, усталость, неопределённость или просто ощущение, что что-то внутри больше не работает так, как раньше.',
      '',
      'Что бы Вас сюда ни привело, это не обязательно должно быть срочным, чтобы быть важным.',
      '',
      'Когда будете готовы, MiniMind поможет замедлиться, прислушаться к себе и начать разбираться в том, что остаётся незамеченным в повседневной суете.',
      '',
      'Ваши 50 бесплатных сообщений ждут на mindreset.ai/home.',
      '',
      '— Команда MindReset',
      '',
      'Вопросы? Загляните в наш FAQ на mindreset.ai/faq или напишите на support@mindreset.ai.',
    ].join('\n');
  }
  return [
    'Hi,',
    '',
    "Most people don't join MindReset by accident.",
    '',
    'Usually there is something underneath it — a feeling of disconnection, exhaustion, uncertainty, or simply the sense that something is no longer working the way it used to.',
    '',
    "Whatever brought you here, it doesn't need to be urgent to matter.",
    '',
    "When you're ready, MiniMind is here to help you slow down, reflect, and begin making sense of what's been sitting beneath the surface.",
    '',
    'Your free 50 messages are waiting at mindreset.ai/home.',
    '',
    '— The MindReset team',
    '',
    'Questions? Check our FAQ at mindreset.ai/faq, or write to support@mindreset.ai.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Drip 2 — Day 7 (7-14d after signup, lifetime messages < 5)
// ---------------------------------------------------------------------------

export function drip2Subject(locale: DripLocale): string {
  return locale === 'ru' ? 'Мягкое напоминание' : 'A gentle reminder';
}

export function drip2Body(locale: DripLocale): string {
  if (locale === 'ru') {
    return [
      'Здравствуйте,',
      '',
      'Неделю назад Вы решили попробовать что-то другое.',
      '',
      'Не потому что всё разваливается.',
      '',
      'А, возможно, потому что что-то внутри ощущалось тяжёлым, запутанным или просто перестало ощущаться правильным.',
      '',
      'Жизнь отвлекает. Хорошие намерения откладываются. Это нормально.',
      '',
      'Если Вы собирались вернуться — MindReset всё ещё здесь.',
      '',
      'Без давления. Без сроков. Просто место, где можно остановиться, прислушаться к себе и восстановить внутреннюю опору — когда почувствуете, что момент подходящий.',
      '',
      'Вы можете продолжить в любое время на mindreset.ai/home.',
      '',
      '— Команда MindReset',
      '',
      'Вопросы? Загляните в наш FAQ на mindreset.ai/faq или напишите на support@mindreset.ai.',
    ].join('\n');
  }
  return [
    'Hi,',
    '',
    'A week ago, you decided to try something different.',
    '',
    'Not because everything was falling apart.',
    '',
    'But perhaps because something inside felt unclear, heavy, disconnected, or simply out of alignment.',
    '',
    'Life gets busy. Good intentions get postponed. That happens.',
    '',
    "If you've been meaning to come back, MindReset is still here.",
    '',
    'No pressure. No deadlines. Just a place to pause, reflect, and reconnect with yourself when the moment feels right.',
    '',
    'You can continue anytime at mindreset.ai/home.',
    '',
    '— The MindReset team',
    '',
    'Questions? Check our FAQ at mindreset.ai/faq, or write to support@mindreset.ai.',
  ].join('\n');
}
