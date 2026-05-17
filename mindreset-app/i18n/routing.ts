import { defineRouting } from 'next-intl/routing';

// Phase i18n.1a — full v1 locale set (UK launch, English source).
// Native-quality strings: EN (Julia native), RU (Julia native). Other six
// (FR/DE/ES/IT/PL/PT) ship with EN content as placeholders until Phase
// i18n.2's DeepL pass + native-speaker review on tone-sensitive strings.
//
// Per UK census the larger non-English first-language UK communities
// include Punjabi/Urdu/Bengali/Gujarati/Arabic — explicitly deferred
// post-launch (RTL support is a separate engineering surface).
export const routing = defineRouting({
  locales: ['en', 'ru', 'fr', 'de', 'es', 'it', 'pl', 'pt'] as const,
  defaultLocale: 'en',
  // 'as-needed' means English serves at BOTH / and /en/; other locales
  // are always URL-prefixed (/ru/screening, /fr/account, etc.).
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
