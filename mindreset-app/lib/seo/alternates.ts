// Per-page SEO helpers — hreflang alternates + canonical URLs.
//
// next-intl's `as-needed` localePrefix means English serves at the
// unprefixed path (/, /pricing, /faq) while every other locale is
// always URL-prefixed (/ru/, /ru/pricing, etc.). hreflang tags need
// the FULL set of locale alternates on every page so search engines
// know which language version to serve a given user.
//
// Usage in a page's metadata export:
//
//   export const metadata: Metadata = {
//     title: '...',
//     description: '...',
//     alternates: pageAlternates('/pricing'),
//   };
//
// `path` is the unprefixed pathname (always starts with '/'). The
// helper produces { canonical, languages: { en, ru, fr, ... } } where
// each language value is the absolute URL for that locale.

import { routing } from '@/i18n/routing';

// Production canonical domain. Set as a constant rather than reading
// env at metadata-evaluation time so the same URLs appear in every
// build artefact (and so Vercel-preview metadata still points at the
// real launch domain, not the preview URL).
export const SITE_URL = 'https://mindreset.ai';

// Locales with hand-curated or reviewed translations. Included in
// hreflang, sitemap, and eligible for indexing. Locales NOT in this set
// are treated as placeholders and noindex'd at the layout level.
//
// 2026-07-29: fr/de/es/it/pl/pt promoted to native. The 6 machine
// locales carry translated Landing/About/Faq/Terms/Privacy/Screening/
// ShareYourStory namespaces at 95-100% coverage (PR #242 + follow-ups).
// Routes whose prose lives in English-only registries (`/journal/*`,
// `/vs/*`) or whose content is still under-translated (`/states`,
// `/themes`) carry their own per-page `robots` override to stay noindex
// on the 6 machine locales — see those page.tsx files.
//
// Mirrored in:
//   - components/LanguagePicker.tsx     — picker UI native set
//   - i18n-tools/sync-placeholders.mjs  — bundles never overwritten by sync
// Update all three the same day.
export const NATIVE_CONTENT_LOCALES: ReadonlySet<string> = new Set([
  'en',
  'ru',
  'fr',
  'de',
  'es',
  'it',
  'pl',
  'pt',
]);

export function isPlaceholderLocale(locale: string): boolean {
  return routing.locales.includes(locale as (typeof routing.locales)[number])
    && !NATIVE_CONTENT_LOCALES.has(locale);
}

type Alternates = {
  canonical: string;
  languages: Record<string, string>;
};

export function pageAlternates(path: string, currentLocale?: string): Alternates {
  if (!path.startsWith('/')) {
    throw new Error(`pageAlternates: path must start with '/'. Got: ${path}`);
  }
  const trimmed = path === '/' ? '' : path;

  // hreflang alternates are limited to NATIVE_CONTENT_LOCALES. Placeholder
  // locales serve English content and are noindex'd site-wide — advertising
  // them here would tell Google "this is the French version" while the page
  // itself says "don't index this", a contradiction Google resolves by
  // picking a different canonical (Search Console flags these as
  // "Duplicate, Google chose different canonical"). When real translations
  // ship for a locale, add it to NATIVE_CONTENT_LOCALES and it appears here
  // and in the sitemap automatically.
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    if (!NATIVE_CONTENT_LOCALES.has(locale)) continue;
    // English (default) serves unprefixed under `as-needed`.
    const localePath = locale === routing.defaultLocale ? trimmed : `/${locale}${trimmed}`;
    languages[locale] = `${SITE_URL}${localePath || '/'}`;
  }
  // x-default points at the language-agnostic version (the EN/default
  // route here — Google uses it when no other locale matches the user).
  languages['x-default'] = `${SITE_URL}${trimmed || '/'}`;

  // Canonical is the URL of THIS page in the current locale. If no
  // currentLocale is supplied (e.g., a hardcoded metadata export on
  // a page that doesn't know its locale at evaluation time), fall
  // back to the unprefixed EN canonical — Google reads the hreflang
  // languages map to find the locale variants.
  const canonical = currentLocale && currentLocale !== routing.defaultLocale
    ? `${SITE_URL}/${currentLocale}${trimmed}`
    : `${SITE_URL}${trimmed || '/'}`;

  return { canonical, languages };
}
