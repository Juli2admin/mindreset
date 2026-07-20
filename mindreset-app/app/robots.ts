// app/robots.ts → /robots.txt at request time.
//
// Disallow ONLY /api/ — JSON endpoints with no page content, so they can
// never end up "indexed but blocked".
//
// Every other non-public route (/home, /minimind, /account, /admin,
// /sign-in, /sign-up, /checkout, /unsubscribe) is kept out of the index by
// a per-page `noindex` tag, NOT by a Disallow. This is deliberate and was
// a bug fix (2026-07-20): a robots.txt Disallow blocks Google from
// crawling, so it never sees the `noindex` and can never DE-index a URL
// that got in via a link — Search Console's "Indexed, though blocked by
// robots.txt" state. noindex only works if the page stays crawlable.
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

const SHARED_DISALLOW = ['/api/'];

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
