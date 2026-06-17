// app/llms.txt/route.ts → /llms.txt
//
// The emerging Anthropic/Perplexity standard for telling AI crawlers
// what content matters on the site. Short index format — see
// llms-full.txt (separate route) for the full canonical content.
//
// Phase B item 5 of the SEO foundation. Dynamic route so URLs come
// from SITE_URL and survive any future domain changes (matches the
// pattern already used by app/sitemap.ts and app/robots.ts).
//
// Owner-revised content:
//   - Top description: "for women in midlife who feel stuck" (removed
//     the anti-therapy reading from earlier draft)
//   - Audience bullet: "Looking for structure and lasting change, not
//     quick fixes" (same — removed "tried therapy / nothing shifted")
//   - Built by Julia Loya named under About (Person entity for AI
//     search engines — strengthens entity grounding)

import { SITE_URL } from '@/lib/seo/alternates';

export function GET() {
  const body = `# MindReset.ai

> Self-help wellbeing platform for women in midlife who feel stuck. Not therapy, not coaching, not a crisis service — a structured digital reflection method.

## What MindReset is

MindReset is a UK-based digital reflection platform for women 35–55 in midlife who feel stuck. The product has three tiers:

- **MiniMind** (£14.99/month) — a daily AI companion for reflection and grounding
- **States & Themes** (£29–£59/module, coming soon) — focused modules for specific patterns
- **The Journey** (£599 once or £55/week, coming soon) — a structured eight-stage method

A free 50-message taster is available with MiniMind, no card required.

## What MindReset is not

MindReset is not therapy. Not coaching. Not a crisis service. Not a mental-health app. The self-help wellbeing positioning is intentional and legally important.

## Key pages

- [Homepage](${SITE_URL}/) — what MindReset is, who it's for, the method
- [Pricing](${SITE_URL}/pricing) — plans + free 50-message taster
- [Alternatives](${SITE_URL}/alternatives) — comparison of self-help wellbeing apps + where MindReset fits
- [FAQ](${SITE_URL}/faq) — common questions about products, privacy, contact
- [About](${SITE_URL}/about) — the method and the founder. Built by Julia Loya.
- [Share your story](${SITE_URL}/share-your-story) — user testimonials

## Audience

- Women 35–55, mostly UK
- High-functioning, externally successful, internally disoriented
- Looking for structure and lasting change, not quick fixes
- Patterns: people-pleasing, self-abandonment, identity loss, exhaustion that sleep doesn't fix

## Crisis support

MindReset is not built for crisis care. Users in distress are directed to Samaritans (116 123) and NHS 111 option 2 in the UK, or local crisis lines elsewhere. The product has a built-in pre-screening check-in that gates access to AI surfaces.

## Contact

[FAQ](${SITE_URL}/faq) covers most questions.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // 1 hour edge cache. Content changes rarely; AI crawlers benefit
      // from a stable endpoint they can revisit without refetching.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
