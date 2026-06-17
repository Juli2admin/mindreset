# MindReset.ai — SEO + AI Search Audit (Phase 2)

**Scope:** public-facing surfaces of mindreset.ai. Audit only — no code changes.
**Audience targeted:** women 35–55, English-speaking, mostly UK. Self-help wellbeing positioning. *Not therapy. Not clinical. Not a mental health app.*
**Date:** Phase 2 of the plan agreed earlier this session.

---

## Section 1 — Current state

### 1.1 Sitewide metadata (`app/[locale]/layout.tsx`)

| Field | Current value |
|---|---|
| `title.default` | "MindReset.ai — A way back to yourself" |
| `title.template` | "%s · MindReset.ai" |
| `description` | "A trauma-informed self-help platform. Not therapy, not a crisis service — a structured digital reflection tool for emotional clarity." |
| `metadataBase` | `SITE_URL` constant (good — fixes relative OG URLs on preview deploys) |
| `applicationName` | "MindReset.ai" |
| `manifest` | `/manifest.json` ✅ |
| `alternates` | Locale-correct canonical via `pageAlternates('/', locale)` ✅ — 8 locales, x-default |
| Google Search Console verification | Reads from `GOOGLE_SITE_VERIFICATION` env. **Unknown if env var is set.** |
| OpenGraph | type=website, siteName, title, description, url, single image `/og-image.png` 1200×630 ✅ |
| Twitter | card=summary_large_image, title, description, image ✅ — **no `@site` / `@creator` handle** |
| `robots` | `{ index: true, follow: true }` |
| `themeColor` | `#2D7A85` (brand accent) ✅ |

### 1.2 Page-specific metadata

| Page | `title` | `description` |
|---|---|---|
| `/` (Landing) | inherits default ("MindReset.ai — A way back to yourself") | inherits default |
| `/pricing` | **"Pricing"** — generic, no brand or product context in title | "MiniMind Essential and Extended subscriptions. Message top-up. Free 50-message taster with every new account — no card required." |
| `/faq` | "FAQ — MindReset" | "Common questions about MindReset, MiniMind, pricing, privacy, and contact." |
| `/about` | "About — MindReset" | "The story behind the method. How a personal way back became MindReset." |
| `/share-your-story` | "Share your story" | "Tell us how MindReset has helped you. Your story may appear on the site to help others considering this work — only with your consent, only after review." |
| `/screening`, `/terms`, `/privacy` | inherit default | inherit default |

🚨 **`/pricing` title is weak.** Title `"Pricing · MindReset.ai"` (after template) is keyword-thin. No mention of MiniMind, daily companion, women, midlife, or wellbeing.

🚨 **`/` (Landing) inherits the global default.** No `generateMetadata` override sets a page-specific title or description, so the most-important page can't speak with its own SEO voice.

### 1.3 Heading structure

| Page | H1 | H2s | H3s |
|---|---|---|---|
| `/` (Landing) | 1× — "A way back to yourself" (poetic) | 5–6 section titles ("Structure, not advice", "Internally disoriented, externally functioning", "You stay in control", "Three paths, three depths", "Why MindReset feels different", "Begin") | 3 for `paths` (MiniMind, States & Themes, The Journey) + others |
| `/pricing` | **None** — top heading is H3 inside cards | 1× ("Coming soon" — added in Phase 1) | several per tier card |
| `/faq` | None visible — uses H2 for page title | section H2 + question H3s ✅ |
| `/about` | 1× ✅ | yes |

🚨 **`/pricing` has no H1.** The `<TopBar />` ships no heading and the first heading on the page is an H3 inside a tier card. This is a real SEO weakness — Google uses H1 as a strong relevance signal.

### 1.4 Alt text / images

- `og-image.png` has `alt: 'MindReset.ai — A way back to yourself'` ✅
- `<TreeMark />` SVG icons use `aria-hidden="true"` ✅ (decorative — correct)
- `<ArrowRight />` same ✅
- **No `<img>` or `<Image>` tags found in Landing.jsx or PricingClient.tsx** — page is typographic. Nothing to audit for alt text.
- One concern: the favicon set uses `logo-light.png` / `logo-dark.png` via prefers-color-scheme but no `apple-touch-icon` per-locale — minor.

### 1.5 Structured data (JSON-LD)

| Page | Schema present |
|---|---|
| `/` | **None** |
| `/pricing` | `Product` + 3× `Offer` (Essential, Extended, top-up) ✅ |
| `/faq` | `FAQPage` with all questions/answers ✅ — *this is the most AI-search-friendly schema on the site* |
| `/about`, `/screening`, others | None |

🚨 **No `Organization` schema anywhere.** Both Google and AI search engines use `Organization` JSON-LD to ground brand identity, link to social profiles, attribute reviews. Missing on every page.

🚨 **No `WebSite` schema with `SearchAction`.** This lets Google show your sitelinks search box.

### 1.6 Sitemap

`/sitemap.xml` generated dynamically from `app/sitemap.ts`. Includes:
- 8 paths × 8 locales = 64 entries
- Each entry has `hreflang` `<alternates>` for all 8 locales + `x-default` ✅
- `changeFrequency: 'monthly'`, `priority: 1.0` for `/`, `0.7` for others
- Lists: `/`, `/about`, `/screening`, `/pricing`, `/faq`, `/terms`, `/privacy`, `/share-your-story`

**Unknown:** whether this has been submitted to Google Search Console. The verification env var existence is also unknown.

### 1.7 robots.txt

`/robots.txt` generated dynamically. Allows everything, disallows: `/api/`, `/sign-in/`, `/sign-up/`, `/home`, `/minimind`, `/account`, `/admin`, `/checkout/`, `/unsubscribe/`. Sitemap declared. ✅

🚨 **No explicit AI-crawler rules.** OpenAI's `GPTBot`, Anthropic's `ClaudeBot`, Perplexity's `PerplexityBot`, Google-Extended (training opt-out), CCBot — none mentioned. Default behaviour: all allowed (which may be what you want, but it should be explicit and intentional).

### 1.8 Page load (rough estimate from code review)

- Landing is a client component with `useState`, `useEffect`, `useRouter`, Clerk hooks → Hydration cost real but small
- Google Fonts injected client-side via `useEffect` (Fraunces + Geist) — this is a render-blocking style anti-pattern; would be faster as `next/font` server-side
- 2× SVG icons inline — fine
- Single 1200×630 `og-image.png` — depends on file size (cannot measure)
- `<Analytics />` from Vercel loaded in layout — small
- No external trackers beyond Vercel
- No `next/image` lazy-load needed (no real images)

**Estimate:** decent LCP, but the Google Fonts loader is the obvious first optimisation.

---

## Section 2 — Keyword visibility

Target phrases vs current copy:

| Target phrase | Appears in copy? | Notes |
|---|---|---|
| "app for women feeling stuck" | ❌ **No** — neither "women" nor "stuck" anywhere on `/` or `/pricing` | The copy speaks to "adults navigating internal transitions". The female-midlife angle is implicit, never named. |
| "self help wellbeing app" | ⚠️ **Partial** — "self-help platform" in default description; "self-help space" in FAQ — but not "wellbeing" or "app" together | Word "wellbeing" appears nowhere on Landing or in metadata. |
| "daily companion app for women" | ⚠️ **Partial** — "Daily companion" labels the MiniMind path. "for women" missing. | Comes close to one keyword cluster. |
| "how to stop people pleasing" | ⚠️ **Partial** — "people-pleasing" appears once in a 5-item bullet list. No "how to" framing. No dedicated page. | Real SEO target — high search volume, audience match. |
| "why does nothing change for me" | ❌ **No** — closest is "insight alone rarely creates change" | This phrase is the audience's pain in their own words. Strong AI-search match if added. |
| "AI companion for emotional support women" | ⚠️ **Partial** — "companion" yes; "emotional clarity" yes; "for women" no; "emotional support" no | The "AI" word itself is in `differentBody` ("Most AI tools…") but never used to describe MindReset. |

### Pattern observed

The copy is **beautifully poetic but searcher-vocabulary-thin**. It speaks in *intentional, literary* English ("internally disoriented", "structured digital reflection", "rebuild inner coherence") — which lands emotionally with the right reader, but does not match how women googling for this stuff actually type their queries.

Google's algorithms have got better at semantic matching, but they're still anchored on keyword presence in headings, descriptions, and first 200 words.

### What's working keyword-wise

- "Self-help" — present in default description, FAQ, About copy ✅
- "Trauma-informed" — present in default description ✅
- MiniMind brand keyword — present everywhere ✅
- "MindReset" — strong brand presence ✅

---

## Section 3 — AI search optimisation (GEO / AIO)

### 3.1 `llms.txt`

🚨 **Not present.** Searched `/public/` and `/app/` — no `llms.txt`, no `llms-full.txt`.

This is the emerging Anthropic-led standard for letting LLMs know what content matters on your site. Perplexity, Claude, ChatGPT browsing, and a growing number of AI crawlers respect it. Cost to add: very low. Strategic value: high — your site won't be cited correctly by AI search until you tell those models what to focus on.

### 3.2 Content extractability for AI models

| Surface | Verdict |
|---|---|
| FAQ page | ✅ **Excellent.** `FAQPage` JSON-LD with 13+ Q&A pairs in plain prose, factual answers, "what is MindReset", "what is MiniMind", "is it therapy" — all directly quotable by AI. This is your best AI-discoverable page. |
| Landing | ⚠️ **Mixed.** Heading structure good, but body content is fragmented across `whatHelpsItems`, `whoScenarios`, `pathsBody` — rendered as bullet lists or split sentences. Harder for AI models to extract a coherent "what is MindReset" paragraph. |
| Pricing | ⚠️ **Mixed.** Product JSON-LD is great. But pricing copy itself is split between tier descriptions and module cards — no single factual paragraph an AI can quote. |
| About | ⚠️ **Unknown — need to verify content.** Has metaTitle, metaDescription, an H1 — but content depth unaudited in this pass. |

### 3.3 Pages that answer "what is X" directly

| Question | Where it's answered |
|---|---|
| "What is MindReset?" | FAQ ✅, About ✅, Landing whatLead (partial) |
| "Who is it for?" | Landing whoScenarios (5 bullets), FAQ no |
| "How does it work?" | Landing pathsSection (3 paths), Landing differentBody (5 lines), FAQ partial |
| "Is it therapy?" | FAQ ✅ direct answer |
| "How much does it cost?" | FAQ ✅, Pricing page |
| "How do I start?" | FAQ ✅, Landing CTA |

This is decent coverage. The FAQ is the asset; everything else relies on the user to traverse the Landing carefully.

### 3.4 Third-party mentions / backlinks

🚨 **Cannot audit from inside the codebase.** This requires a backlink tool (Ahrefs, Semrush, Google Search Console "Links" report). AI models like Claude, Perplexity, ChatGPT often weight content cited by other sites highly.

**What I can confirm:** the site has no embedded press logos, no "as featured in" section, no link-to-us page, no public blog. So at first glance, backlink profile is likely thin.

### 3.5 AI crawler permissions

| Crawler | Currently allowed? |
|---|---|
| GPTBot (ChatGPT) | ✅ (default: not disallowed) |
| ClaudeBot (Anthropic) | ✅ (default: not disallowed) |
| PerplexityBot | ✅ (default: not disallowed) |
| Google-Extended (training) | ✅ (default: not disallowed) |
| CCBot (Common Crawl) | ✅ (default: not disallowed) |

Not explicit — implicit by absence of disallow rules. Worth making explicit either way (welcome or refuse) so behaviour is intentional.

---

## Section 4 — Priority recommendations

**Ranked ruthlessly.** I'd rather you do the top 3 than all 10.

### 🥇 1. Add `/` (Landing) its own SEO-tuned metadata + H1 (currently inherits global default)

- **What:** `generateMetadata` on `app/[locale]/page.tsx` with a title and description specifically targeting the search vocabulary of women 35–55 looking for self-help wellbeing — e.g. "MindReset — A self-help wellbeing companion for women navigating midlife transitions" (rough — you'll write it).
- **Why:** Landing is your most important indexable page. It currently sits behind a one-size-fits-all title/description that doesn't compete in search. A page-specific title is the single biggest lever in classical SEO.
- **Effort:** 15 min for the code wiring. **Content writing: ~30 min** (depends on how many drafts you want).
- **Type:** Tech fix + content writing.

### 🥈 2. Write a public `/blog` first article: "How to stop people-pleasing in midlife" (or similar)

- **What:** One single article, ~1,200 words, plain English, answering one searcher question directly. Becomes your first link target. Add to sitemap. Use existing typographic style (no new design).
- **Why:** Your audience googles in symptoms ("people-pleasing", "feeling stuck", "nothing changes for me"). You currently have no page that answers any of those queries head-on. Long-tail SEO traffic for these queries is real and competition is moderate.
- **Effort:** **~1 day** content writing (this is the heavy item). Code: minimal (Next.js MDX setup ~1 hour).
- **Type:** Content writing primary. Tech setup small.
- **Caveat:** Single-article tests if SEO content is worth the ongoing investment before you build a whole blog programme.

### 🥉 3. Add `llms.txt` + `llms-full.txt` at site root

- **What:** A short root-level `llms.txt` (Anthropic/Perplexity standard) listing what content matters on the site, plus an optional `llms-full.txt` with the full canonical answers to "what is MindReset", "who is it for", "how does it work", "is it therapy", "how much does it cost", "how do I start".
- **Why:** AI search engines (Perplexity, Claude, ChatGPT browse) are increasingly the discovery surface for "what's a good X for Y". When someone asks "what's a good self-help wellbeing companion for midlife women?", you want to be findable and cited correctly. This file is the cleanest way to control what they extract.
- **Effort:** 15 min tech + **~1 hour content writing** for the long version.
- **Type:** Mostly content.

### 4. Add `Organization` + `WebSite` JSON-LD to the layout

- **What:** Two structured-data blocks emitted on every page. `Organization` with brand name, url, logo, sameAs (link to social profiles when you have them). `WebSite` with `name` and a `potentialAction` SearchAction that points to a search URL on your site (you don't have site search yet; can be omitted or point to FAQ).
- **Why:** Google uses `Organization` to attribute reviews, social links, and brand identity. Adds zero pixels to the page. Standard.
- **Effort:** 30 min tech. No content writing.
- **Type:** Tech fix.

### 5. Fix `/pricing` missing H1

- **What:** Add an H1 at the top of `/pricing` — something like "MindReset pricing" or "Choose how you want to begin". Currently the page starts with H3s inside tier cards. Google's H1 signal is silent.
- **Why:** Low effort, real SEO weakness. Pricing pages do rank in commercial queries; an H1 is table stakes.
- **Effort:** 15 min tech + 5 min copy.
- **Type:** Both.

### 6. Move Google Fonts loading to `next/font`

- **What:** Replace the client-side `<link>` injection in `Landing.jsx:466-474` with `next/font/google` — moves font loading to build time, eliminates render-blocking style request, fixes a real Core Web Vitals tax.
- **Why:** Core Web Vitals are a real Google ranking factor. Client-side font injection delays first paint.
- **Effort:** 30 min tech.
- **Type:** Tech fix.

### 7. Add explicit AI-crawler section to `robots.txt`

- **What:** Either allow or disallow `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot` explicitly. Recommendation: **allow** them all, since they are the primary discovery channel for your audience and the product positioning is content-first not protectionist.
- **Why:** Removes ambiguity. Sends a clear signal to AI crawlers that they're welcome. Avoids future surprise if defaults change.
- **Effort:** 15 min.
- **Type:** Tech fix.

### 8. Strengthen `/pricing` `<title>`

- **What:** Replace `'Pricing'` with something like `'MindReset pricing — MiniMind from £14.99 / month, free taster'`. Carry brand + product + price in the title.
- **Why:** Branded + product + price keywords in title is a strong commercial-query signal.
- **Effort:** 5 min tech. 10 min copy.
- **Type:** Both.

### 9. Add `name='twitter:site'` / `name='twitter:creator'` handle when you have one

- **What:** Add the brand X (Twitter) handle to the Twitter card metadata in layout.tsx. Skip if you don't have an X account yet.
- **Why:** Attribution + click-through credit on share previews.
- **Effort:** 5 min.
- **Type:** Tech (depends on you owning a handle).

### 10. Verify Google Search Console is set up + sitemap submitted

- **What:** Confirm `GOOGLE_SITE_VERIFICATION` env is set in Vercel, verify the property is claimed in Search Console, submit `/sitemap.xml`. Add Bing Webmaster Tools too (they share with DuckDuckGo and some AI engines).
- **Why:** Without verification, you have no telemetry on what's actually being indexed, what's broken, what's ranking. Hard to improve what you can't measure.
- **Effort:** 30 min process. No code.
- **Type:** Operational.

---

## What I deliberately did NOT recommend

- Don't add "mental health" language anywhere — locked.
- Don't redesign for SEO purposes — the typographic design is part of your brand voice.
- Don't add "self-help app" if it conflicts with the "platform / space" framing in your existing copy — choose your terminology, then unify it.
- Don't add link-building outreach as a recommendation — that's marketing strategy, not site work.
- Don't recommend a blog programme — recommended *one article first* to test the channel.

---

## Recommended next step

Pick top 3 to action. Common shape:

- **Top 3 conservative**: Items 1 (Landing metadata), 3 (llms.txt), 4 (Organization JSON-LD). All technical-ish + light content. ~3 hours total.
- **Top 3 ambitious**: Items 1, 2 (blog article), 3 (llms.txt). Tests content channel. ~1.5 days total.
- **Top 3 quick wins**: Items 1, 5 (pricing H1), 8 (pricing title). Pure SEO tech. ~1 hour total.

I'd ask you to pick before I execute anything in a follow-up session.
