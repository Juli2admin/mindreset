// app/robots.ts → /robots.txt at request time.
//
// Allow everything except API routes + the Clerk catch-all sub-paths
// (which include auth-tokens in URL segments — no SEO value, possible
// info leak in indexed snippets).

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/alternates';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/sign-in/', '/sign-up/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
