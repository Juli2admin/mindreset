// app/sitemap.ts → /sitemap.xml.
//
// Lists every public route in every locale, with hreflang alternates
// inline (Google supports both link-tag and sitemap-tag hreflang;
// sitemap-tag is more discoverable for multi-locale sites because
// crawl frequency on the sitemap is higher than on individual pages).
//
// Excludes:
//   - auth surfaces (sign-in, sign-up) — Disallowed in robots.ts
//   - /home, /account — auth-gated, no SEO value
//   - /checkout/success — post-purchase, no SEO value
//   - /minimind — auth-gated
//   - API routes (not crawled anyway)
//
// Includes:
//   - / (Landing)
//   - /screening
//   - /pricing
//   - /faq
//   - /terms
//   - /privacy

import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_URL, NATIVE_CONTENT_LOCALES } from '@/lib/seo/alternates';
import { ARTICLES } from '@/lib/journal/articles';
import { COMPARISONS } from '@/lib/competitors';

// Public paths to include in the sitemap. Each entry lists every locale
// variant + hreflang alternates so search engines know about the full
// multi-locale graph.
const STATIC_PATHS = [
  '/',
  '/about',
  '/screening',
  '/pricing',
  '/alternatives',
  '/journal',
  '/faq',
  '/terms',
  '/privacy',
  '/share-your-story',
] as const;

// Journal article paths are sourced from the typed registry so adding a
// new article automatically extends the sitemap on next deploy.
const ARTICLE_PATHS = ARTICLES.map((a) => `/journal/${a.slug}`);

// /vs/{competitor} comparison paths — same registry-driven pattern.
const VS_PATHS = COMPARISONS.map((c) => `/vs/${c.slug}`);

// Only native-content locales are advertised. Placeholder locales serve
// byte-identical English and are noindex'd site-wide (see
// [locale]/layout.tsx), so listing them here would only waste crawl budget
// and generate duplicate-content warnings in Search Console. When a locale
// gets hand-curated content, add it to NATIVE_CONTENT_LOCALES and it
// appears here + in pageAlternates automatically.
const NATIVE_LOCALES = routing.locales.filter((l) => NATIVE_CONTENT_LOCALES.has(l));

function buildAlternates(path: string): Record<string, string> {
  const trimmed = path === '/' ? '' : path;
  const languages: Record<string, string> = {};
  for (const locale of NATIVE_LOCALES) {
    const localePath = locale === routing.defaultLocale ? trimmed : `/${locale}${trimmed}`;
    languages[locale] = `${SITE_URL}${localePath || '/'}`;
  }
  languages['x-default'] = `${SITE_URL}${trimmed || '/'}`;
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const allPaths = [...STATIC_PATHS, ...ARTICLE_PATHS, ...VS_PATHS];

  // One sitemap entry per (path × native-locale) pairing so each variant
  // has its own crawl URL. hreflang alternates are attached to each entry.
  return allPaths.flatMap((path) => {
    const trimmed = path === '/' ? '' : path;
    const languages = buildAlternates(path);
    return NATIVE_LOCALES.map((locale) => {
      const url =
        locale === routing.defaultLocale
          ? `${SITE_URL}${trimmed || '/'}`
          : `${SITE_URL}/${locale}${trimmed || '/'}`;
      return {
        url,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: path === '/' ? 1.0 : 0.7,
        alternates: { languages },
      };
    });
  });
}
