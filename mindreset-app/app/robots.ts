// app/robots.ts → /robots.txt at request time.
//
// Allow everything except routes that should never be crawled:
//   - /api/                      — JSON endpoints, no SEO value
//   - /sign-in/, /sign-up/       — Clerk catch-all paths with auth tokens
//   - /home, /minimind, /account — auth-gated user surfaces (also noindex
//     via per-page metadata, but disallow saves Google crawl budget)
//   - /admin                     — owner-only, email-allowlist gated
//   - /checkout/, /unsubscribe/  — transient flows, no SEO value
//
// Explicit AI crawler permissions:
// Each of the major AI/LLM crawlers gets its own rule block so the signal
// is intentional rather than implicit-via-the-catch-all. Phase B SEO
// foundation choice: maximum AI search discoverability for a self-help
// wellbeing product aimed at women in midlife — the primary discovery
// channel for this audience is increasingly AI search engines, not
// classical Google search. Disallow list is duplicated per crawler so
// the same auth-gated paths stay protected regardless of which crawler
// reads the rules. (Robots spec: each named user-agent follows its own
// block exclusively; we cannot inherit disallows from the catch-all.)

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/alternates';

const SHARED_DISALLOW = [
  '/api/',
  '/sign-in/',
  '/sign-up/',
  '/home',
  '/minimind',
  '/account',
  '/admin',
  '/checkout/',
  '/unsubscribe/',
];

// Major AI crawlers, in order of current discovery relevance for the
// MindReset audience. Each is explicitly welcomed.
const AI_CRAWLERS = [
  'GPTBot',          // OpenAI / ChatGPT
  'ChatGPT-User',    // OpenAI ChatGPT browse (user-initiated)
  'OAI-SearchBot',   // OpenAI SearchGPT
  'ClaudeBot',       // Anthropic Claude
  'Claude-Web',      // Anthropic Claude (alternative user-agent)
  'PerplexityBot',   // Perplexity AI search
  'Perplexity-User', // Perplexity user-initiated fetch
  'Google-Extended', // Google Gemini training opt-in signal
  'CCBot',           // Common Crawl (feeds many training datasets)
  'Bytespider',      // ByteDance / Doubao
  'Applebot-Extended', // Apple Intelligence training opt-in signal
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: SHARED_DISALLOW,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: SHARED_DISALLOW,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
