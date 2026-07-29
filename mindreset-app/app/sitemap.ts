// app/sitemap.ts → /sitemap.xml.
//
// Two-tier structure (2026-07-29):
//
//   ALL_LOCALES_PATHS — routes whose prose is fully translated in every
//   locale in NATIVE_CONTENT_LOCALES. One sitemap entry per (path × 8
//   locales), with hreflang alternates linking all 8.
//
//   EN_RU_ONLY_PATHS — routes whose prose lives in English-only registries
//   (`lib/journal/articles.ts`, `lib/competitors/index.ts`) OR whose
//   messages/{locale}.json namespaces are still under-translated on the 6
//   machine locales (/states 0%, /themes 7.7%). Emitted only for en+ru; the
//   corresponding page.tsx files set locale-conditional `robots: index:false`
//   for the 6 machine locales so Google is told the URLs exist but not to
//   index them.
//
// Excludes:
//   - auth surfaces (sign-in, sign-up), /home, /minimind, /account, /journey,
//     /onboarding, /pilot, /redeem, /checkout, /states/[moduleId],
//     /themes/[moduleId] — noindex-by-design via per-page robots
//   - /admin (admin layout noindex)
//   - API routes (never crawled)

import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_URL, NATIVE_CONTENT_LOCALES } from '@/lib/seo/alternates';
import { ARTICLES } from '@/lib/journal/articles';
import { COMPARISONS } from '@/lib/competitors';

// Paths whose prose is fully translated in every native-content locale.
// Emitted once per (path × NATIVE_LOCALES), with hreflang alternates.
const ALL_LOCALES_PATHS = [
  '/',
  '/about',
  '/screening',
  '/pricing',
  '/alternatives',
  '/faq',
  '/terms',
  '/privacy',
  '/share-your-story',
] as const;

// Paths whose prose is English-only or whose per-locale messages are still
// under-translated. Emitted only for en+ru; other locales are marked
// noindex in each page's own generateMetadata.
const EN_RU_ONLY_PATHS = [
  '/journal',
  '/states',
  '/themes',
] as const;
const EN_RU_ONLY_LOCALES = ['en', 'ru'] as const;

// Journal article + comparison paths are English-only prose (registries in
// lib/journal/articles.ts and lib/competitors/index.ts) so treated the same
// way as EN_RU_ONLY_PATHS.
const ARTICLE_PATHS = ARTICLES.map((a) => `/journal/${a.slug}`);
const VS_PATHS = COMPARISONS.map((c) => `/vs/${c.slug}`);

const ALL_NATIVE_LOCALES = routing.locales.filter((l) => NATIVE_CONTENT_LOCALES.has(l));

function buildAlternates(path: string, locales: readonly string[]): Record<string, string> {
  const trimmed = path === '/' ? '' : path;
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    const localePath = locale === routing.defaultLocale ? trimmed : `/${locale}${trimmed}`;
    languages[locale] = `${SITE_URL}${localePath || '/'}`;
  }
  languages['x-default'] = `${SITE_URL}${trimmed || '/'}`;
  return languages;
}

function urlFor(path: string, locale: string): string {
  const trimmed = path === '/' ? '' : path;
  return locale === routing.defaultLocale
    ? `${SITE_URL}${trimmed || '/'}`
    : `${SITE_URL}/${locale}${trimmed || '/'}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const allLocalesEntries: MetadataRoute.Sitemap = ALL_LOCALES_PATHS.flatMap((path) => {
    const languages = buildAlternates(path, ALL_NATIVE_LOCALES);
    return ALL_NATIVE_LOCALES.map((locale) => ({
      url: urlFor(path, locale),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: path === '/' ? 1.0 : 0.7,
      alternates: { languages },
    }));
  });

  const enRuOnlyPaths = [...EN_RU_ONLY_PATHS, ...ARTICLE_PATHS, ...VS_PATHS];
  const enRuOnlyEntries: MetadataRoute.Sitemap = enRuOnlyPaths.flatMap((path) => {
    const languages = buildAlternates(path, EN_RU_ONLY_LOCALES);
    return EN_RU_ONLY_LOCALES.map((locale) => ({
      url: urlFor(path, locale),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      alternates: { languages },
    }));
  });

  return [...allLocalesEntries, ...enRuOnlyEntries];
}
