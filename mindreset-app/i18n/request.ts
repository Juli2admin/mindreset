import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

// Phase i18n.0 supported locales. Phase i18n.1 expands this to the full
// 8-language set (EN, RU, FR, DE, ES, IT, PL, PT) once routing is in place.
const SUPPORTED_LOCALES = ['en', 'ru'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: SupportedLocale = 'en';

// Cookie name follows our existing mr_* namespace (mr_screening,
// mr_disclaimer_acknowledged). next-intl's default is NEXT_LOCALE; we
// override that here so all locale persistence is grep-able under mr_*.
const LOCALE_COOKIE = 'mr_locale';

function isSupported(value: string | undefined): value is SupportedLocale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export default getRequestConfig(async () => {
  // No [locale] routing in Phase 0 — locale resolution is cookie-only.
  // Phase i18n.1 adds Accept-Language fallback + URL-prefixed routing.
  const cookieValue = cookies().get(LOCALE_COOKIE)?.value;
  const locale: SupportedLocale = isSupported(cookieValue)
    ? cookieValue
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
