import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

// Phase i18n.1a — locale resolution order:
//   1. URL segment ([locale] in the path), passed in via requestLocale
//      from next-intl's middleware
//   2. mr_locale cookie (set by the Footer picker — see
//      components/FooterLanguagePicker.tsx)
//   3. defaultLocale ('en') as final fallback
//
// Accept-Language header detection lands in Phase i18n.1b (middleware-
// side, applies only to first-visit users who lack both URL segment and
// cookie).
//
// Cookie name follows our mr_* namespace (mr_screening,
// mr_disclaimer_acknowledged). next-intl's default cookie is
// NEXT_LOCALE; we override here for grep-ability and ownership clarity.
const LOCALE_COOKIE = 'mr_locale';

function isSupported(value: string | undefined): value is (typeof routing.locales)[number] {
  return (
    typeof value === 'string' &&
    (routing.locales as readonly string[]).includes(value)
  );
}

export default getRequestConfig(async ({ requestLocale }) => {
  // 1. URL segment (set by next-intl middleware when route is under [locale])
  let locale = await requestLocale;

  // 2. Cookie fallback (when URL has no [locale] prefix, e.g. root /)
  if (!isSupported(locale)) {
    const cookieValue = cookies().get(LOCALE_COOKIE)?.value;
    if (isSupported(cookieValue)) {
      locale = cookieValue;
    }
  }

  // 3. Default fallback
  if (!isSupported(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
