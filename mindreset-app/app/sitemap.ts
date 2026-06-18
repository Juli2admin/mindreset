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
import { SITE_URL } from '@/lib/seo/alternates';
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

function buildAlternates(path: string): Record<string, string> {
  const trimmed = path === '/' ? '' : path;
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    const localePath = locale === routing.defaultLocale ? trimmed : `/${locale}${trimmed}`;
    languages[locale] = `${SITE_URL}${localePath || '/'}`;
  }
  languages['x-default'] = `${SITE_URL}${trimmed || '/'}`;
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const allPaths = [...STATIC_PATHS, ...ARTICLE_PATHS, ...VS_PATHS];

  // One sitemap entry per (path × locale) pairing so each variant has
  // its own crawl URL. hreflang alternates are attached to each entry.
  return allPaths.flatMap((path) => {
    const trimmed = path === '/' ? '' : path;
    const languages = buildAlternates(path);
    return routing.locales.map((locale) => {
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
