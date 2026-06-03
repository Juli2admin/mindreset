// app/robots.ts → /robots.txt at request time.
//
// Allow everything except routes that should never be crawled:
//   - /api/                      — JSON endpoints, no SEO value
//   - /sign-in/, /sign-up/       — Clerk catch-all paths with auth tokens
//   - /home, /minimind, /account — auth-gated user surfaces (also noindex
//     via per-page metadata, but disallow saves Google crawl budget)
//   - /admin                     — owner-only, email-allowlist gated
//   - /checkout/, /unsubscribe/  — transient flows, no SEO value

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/alternates';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/sign-in/',
          '/sign-up/',
          '/home',
          '/minimind',
          '/account',
          '/admin',
          '/checkout/',
          '/unsubscribe/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
