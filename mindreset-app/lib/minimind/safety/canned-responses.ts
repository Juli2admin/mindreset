// Localised canned responses for MiniMind safety flows.
//
// PR π (2026-07-11) — pre-launch audit M11. Previously all three canned
// messages (crisis, cooldown-holding, cooldown-lift) were hardcoded
// English in the chat route. Russian-speaking users in crisis got
// English text and a UK phone number, which is a real UX + safety UX
// gap for the two native locales MindReset ships (EN + RU per
// CLAUDE.md).
//
// EN is the fallback for any locale we don't have translated yet.

export const MINIMIND_CRISIS_RESPONSE_EN = `I hear how serious this is. What you're carrying right now is more than this conversation is built for, and I want you safe. Please reach out to a person who can be with you in this:

Samaritans — 116 123 (free, 24/7)
NHS 111, option 2 — for mental health crisis
Your GP if you have one
If you're in immediate physical danger, call 999 or go to A&E

I'll be here when you're ready to come back.`;

export const MINIMIND_CRISIS_RESPONSE_RU = `Я слышу, насколько это серьёзно. То, что вы сейчас несёте, — больше, чем может вместить этот разговор, и я хочу, чтобы вы были в безопасности. Пожалуйста, обратитесь к человеку, который сможет побыть рядом:

Samaritans — 116 123 (бесплатно, круглосуточно)
NHS 111, вариант 2 — кризисная психиатрическая помощь
Ваш врач общей практики, если есть
Если жизнь в непосредственной опасности — звоните 999 или обратитесь в отделение скорой помощи (A&E)

Я буду здесь, когда вы будете готовы вернуться.`;

export const MINIMIND_COOLDOWN_HOLDING_EN =
  "I'm here. Are you somewhere safe right now?";

export const MINIMIND_COOLDOWN_HOLDING_RU =
  'Я здесь. Вы сейчас в безопасном месте?';

export const MINIMIND_COOLDOWN_LIFT_EN =
  "I'm glad you're letting me know. How are you doing right now?";

export const MINIMIND_COOLDOWN_LIFT_RU =
  'Я рада, что вы дали знать. Как вы сейчас?';

export function getMinimindCrisisResponseForLocale(
  locale: string | null | undefined,
): string {
  if (locale === 'ru') return MINIMIND_CRISIS_RESPONSE_RU;
  return MINIMIND_CRISIS_RESPONSE_EN;
}

export function getMinimindCooldownHoldingForLocale(
  locale: string | null | undefined,
): string {
  if (locale === 'ru') return MINIMIND_COOLDOWN_HOLDING_RU;
  return MINIMIND_COOLDOWN_HOLDING_EN;
}

export function getMinimindCooldownLiftForLocale(
  locale: string | null | undefined,
): string {
  if (locale === 'ru') return MINIMIND_COOLDOWN_LIFT_RU;
  return MINIMIND_COOLDOWN_LIFT_EN;
}
