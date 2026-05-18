import type { Locale } from '@/i18n/routing';

// Phase i18n.1c — Intl.* wrappers used by future consumers (1d MiniMind
// chat timestamps; Phase 2 legal-doc LAST_UPDATED dates). Pure functions:
// no React hooks, no module state — safe to call from both server
// components (resolve locale via `await getLocale()` then pass it in)
// and client components (resolve via `useLocale()` then pass it in).
//
// Why locale-explicit rather than hook-wrapped: hooks are client-only,
// and we want the same function callable from both surfaces. Caller pays
// the trivial cost of passing `locale` once.

// Map our 8-locale set to BCP-47 tags. UK-bias: 'en' → 'en-GB' (not
// en-US), so date order is DD/MM/YYYY and currency defaults read as £.
const INTL_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  ru: 'ru-RU',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pl: 'pl-PL',
  pt: 'pt-PT',
};

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

/**
 * Format a date in the active locale's conventions.
 * Default options render as "14 May 2026" (en-GB), "14 мая 2026 г." (ru), etc.
 */
export function formatDate(
  date: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(INTL_TAGS[locale], options ?? DEFAULT_DATE_OPTIONS).format(d);
}

/**
 * Format a number in the active locale's conventions (thousands separators,
 * decimal separator, etc.).
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(INTL_TAGS[locale], options).format(value);
}

/**
 * Format a currency value. Always rendered in en-GB regardless of UI
 * locale — this is a UK-only product and prices stay in British format
 * everywhere ("£9.99", never "9,99 £" or "9,99 £GB"). Reasoning:
 *   - Stripe checkout shows English-format GBP regardless of UI language,
 *     so picker switches in our UI shouldn't desync from checkout
 *   - Trauma-informed simplicity: avoids "is that 9.99 or 999" format
 *     ambiguity for users unfamiliar with comma-as-decimal conventions
 *   - Localisation work applies to labels AROUND the price
 *     ("/month" → "/месяц") not the price itself
 *
 * Defaults to GBP. Other ISO 4217 codes accepted in case we ever surface
 * a USD/EUR figure (e.g. a reference price), still in British format.
 *
 * Example: formatCurrency(9.99) → "£9.99" for every UI locale.
 */
export function formatCurrency(value: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Format a relative-time expression in the active locale.
 *
 * Example: formatRelativeTime(-1, 'day', 'en') → "yesterday",
 *          formatRelativeTime(-2, 'day', 'ru') → "позавчера",
 *          formatRelativeTime(-5, 'day', 'en') → "5 days ago".
 *
 * Pairs with MiniMind chat timestamps in Phase 1d (current MiniMindClient
 * formatRelative function uses hardcoded English strings — migrating to
 * this helper is a 1d follow-up).
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: Locale,
): string {
  return new Intl.RelativeTimeFormat(INTL_TAGS[locale], { numeric: 'auto' }).format(value, unit);
}
