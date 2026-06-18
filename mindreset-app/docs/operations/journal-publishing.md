# Journal publishing — runbook

When to use this doc: **every time a new long-form article is published to
`/journal`**. The Phase C content engine is registry-driven, which means
most of the discoverability signals fire automatically — but a few things
need human attention per article, and a couple of internal-link spots
have to be touched by hand. This doc lists both.

If Phase C article cadence resumes (currently paused after article 3),
follow this from end to end. It's also the right reference if a Claude
session is asked to ship a new article from owner-supplied prose.

---

## What's automatic from the registry

When a new entry lands in `lib/journal/articles.ts`, the following fire
on the next deploy with no extra work:

| Signal | How it propagates |
|---|---|
| Article page at `/journal/<slug>` | `generateStaticParams` in `app/[locale]/journal/[slug]/page.tsx` |
| `/journal` index entry (newest-first) | `getArticlesNewestFirst` |
| `<title>` + `<meta description>` | `generateMetadata` reads `metaTitle` / `metaDescription` |
| Canonical + hreflang alternates | `pageAlternates(/journal/<slug>, locale)` |
| OpenGraph type=article, title, dates, author | same `generateMetadata` block |
| `BlogPosting` JSON-LD | `buildJsonLd(article)` (embedded as a `<script>`) |
| Sitemap entry × every locale | `app/sitemap.ts` reads `ARTICLES` |
| Inline product-token links in closing prose | `productLinks` (or the default `MiniMind` → `/minimind`) |
| Edge cache invalidation | Vercel rebuild on push to `main` |

You do not need to touch the sitemap, JSON-LD, hreflang or alternates
files by hand. Don't.

---

## What every new article needs (registry fields)

Each `Article` entry in `lib/journal/articles.ts`:

- **`slug`** — kebab-case, SEO-tuned, no stop-words unless the phrase
  needs them. Use the same primary keyword as `metaTitle` where
  possible. Once shipped, never change it (would break crawled links).
- **`title`** — H1 on the page + `headline` in JSON-LD. Can run long
  and prose-y; this is the human title.
- **`metaTitle`** — `<title>` tag. Convention: `"<headline> · MindReset"`.
  Aim under ~70 chars including the suffix.
- **`metaDescription`** — `<meta name="description">`. 140-180 chars.
  Plain English, no clickbait, no hype words. Should restate the
  promise of the article in one breath.
- **`author`** — `{ name: 'Julia Loya', url: '/about' }` is the standing
  byline. Don't change unless co-authored.
- **`publishedAt`** — ISO date (`YYYY-MM-DD`). Drives the index sort
  and the JSON-LD `datePublished`. Use the actual ship date.
- **`modifiedAt`** — only set if you ship a meaningful revision later
  (typo fixes don't count). Reflected as `dateModified` in JSON-LD.
- **`intro`** — array of paragraphs above the first H2. The first
  paragraph gets a slightly larger serif lead-in treatment.
- **`sections`** — `{ heading, paragraphs }`. Paragraphs are either
  plain strings or `{ lead, body }` for the inline-bold "advice" style.
- **`closingHeading`** *(optional)* — H2 above the closing paragraphs
  (e.g. "Where to begin"). Omit for an unlabelled coda.
- **`closing`** — paragraphs after the last section. Product tokens
  listed in `productLinks` get wrapped in inline links.
- **`productLinks`** *(optional)* — `[{ token, href }]`. Defaults to
  `MiniMind` → `/minimind`. Override per article when:
  - You want to mention both `MiniMind` and `The Journey`
  - The article is more `The Journey`-shaped (link both to `/` while
    The Journey is in phased rollout and not purchasable yet)
  - You want `MiniMind` to route somewhere other than `/minimind`

---

## Pre-publish checklist

Run through before opening the PR.

- [ ] **Slug** is final, kebab-case, unique, and the same as in the
      `Article` entry. Check `lib/journal/articles.ts` for collisions.
- [ ] **metaTitle** has the `· MindReset` suffix and is under ~70 chars.
- [ ] **metaDescription** is 140-180 chars, plain English, no hype.
- [ ] **Closing paragraphs** mention at least one product token, and
      the token actually appears in the prose (the renderer does
      substring matching — typos won't link).
- [ ] **`productLinks`** — confirm where each token should route.
      Default for new articles unless the article mentions
      `The Journey` (in which case both link to `/` while The Journey
      isn't purchasable).
- [ ] **Hard rules pass** — no use of `therapist` to describe any
      MindReset product, no therapy-price comparison, no
      `mental health` language. Crisis lines (Samaritans, NHS 111)
      only if the article topic warrants them.
- [ ] **Brand voice pass** — literary register, no clinical jargon,
      no "you need to" / "you must" hectoring. Matches the existing
      three articles' tone.
- [ ] **`npm run i18n:check`** — confirms no message-bundle drift was
      introduced by mistake (this is run pre-build but worth a local
      pre-PR sanity check).
- [ ] **`npm test`** — green.
- [ ] **`npx tsc --noEmit`** — green.

---

## Internal linking (manual)

The registry covers the article page and the journal index. Internal
link surfaces that need human touch:

- **Earlier articles' "see also"** — Phase C did not ship inline
  cross-links between articles. If a new article ladders directly off
  an earlier one (e.g. "Burnout vs exhaustion" off "Why Am I So Tired
  All the Time?"), consider whether a single contextual link in the
  closing of the older article is worth a PR. Don't do this in bulk —
  only when it's genuinely useful to the reader. The three live
  articles are also locked content; do not edit them to add cross-links
  without owner sign-off.
- **Homepage / About** — currently neither surfaces journal content
  directly. No work required unless the owner decides to feature an
  article.
- **Footer** — already includes `Journal` as a nav link in the global
  `Footer` component; no per-article work.

---

## llms.txt and llms-full.txt

- **`llms.txt`** — lists `/journal` as a "Key page" but does not
  enumerate individual articles. No per-article update needed.
- **`llms-full.txt`** — describes the platform; does not enumerate
  articles. No per-article update needed.

These files only need touching when a structural change happens
(new product tier, repositioning, new social handle, etc.), not when
journal content is added.

---

## Post-publish verification

After the deploy completes and the article URL resolves:

1. **`/journal/<slug>` loads cleanly** in an incognito window. No
   layout regression, links work, back-to-journal link works.
2. **`/journal` index** shows the new entry at the top (it's
   newest-first by `publishedAt`).
3. **`view-source:` on the article page** contains:
   - The expected `<title>` and `<meta name="description">`
   - `<link rel="canonical">` pointing at the canonical URL
   - `<link rel="alternate" hreflang>` lines for every locale
   - The `application/ld+json` block with `"@type":"BlogPosting"`,
     correct headline, datePublished, author, mainEntityOfPage
4. **`/sitemap.xml`** contains the new URL × every locale, with
   hreflang alternates inline. (Vercel may take a few minutes to
   refresh the cached XML; force-reload with `?t=$(date +%s)` if
   needed.)
5. **Google Search Console** (when set up post Block C) — submit the
   new article URL for indexing. Pre-Block-C this is a no-op; the
   sitemap entry is enough.
6. **Social preview** (Instagram / TikTok bio link, etc.) — the
   article uses the site-wide `og-image.png`. There is no per-article
   custom OG image (see Known limitations below).

---

## Known limitations

These are intentional gaps from Phase C; don't "fix" them without
owner sign-off.

- **No per-article OG image.** Every article shares the site-wide
  `/og-image.png`. Acceptable for the current organic-only traffic
  profile; revisit if/when articles are pushed via paid social.
- **English-only content.** Articles render the same English prose in
  every locale path. The `[locale]` route still serves at every locale
  prefix so canonical/hreflang stay consistent, but the body text
  itself is not translated. Don't add a translation field to the
  `Article` type until there's an owner decision to ship localised
  long-form content.
- **No canonical-URL override.** Every article canonicalises to its
  own `/journal/<slug>` URL via `pageAlternates`. There is no field
  to canonical to an external version (e.g. a Medium repost). If we
  ever syndicate, that field is added then, not pre-emptively.
- **No tag/category taxonomy.** Articles are a flat list. If/when the
  registry has 20+ entries, revisit. Three is not 20.
- **Renderer wraps the FIRST occurrence of each product token only?**
  No — it wraps every occurrence in `closing` paragraphs. If a token
  appears twice in the same paragraph, both get wrapped. Plan the
  closing prose accordingly.

---

## What NOT to do

- **Do not edit the three live articles.** Articles 1-3 are locked
  content (people-pleasing, tired, find yourself again). Owner-approved
  prose stays exactly as published. Only typo-level fixes, and only with
  owner sign-off recorded in the PR body.
- **Do not edit the sitemap, JSON-LD, hreflang or alternates files by
  hand.** Everything flows from the registry. If the registry isn't
  expressing what you need, extend the type — don't bypass it.
- **Do not change a shipped `slug`.** Broken external links cost more
  than a slightly imperfect URL.
- **Do not add `noindex` to journal pages.** Journal is the organic
  acquisition channel.
- **Do not add per-article analytics events.** The site-wide Vercel
  analytics is the canonical source. Per-article custom events would
  fragment the data and create maintenance burden.

---

## Future work (not now)

These are flagged as deferred, not as bugs:

- Per-article OG image generation (Next.js `ImageResponse` from the
  `headline`) — only worth doing if a paid-social channel ships.
- Inline cross-links between related articles — only worth doing
  when there are >5 articles and a clear ladder pattern.
- Localised long-form content — owner decision when/whether to do.
- Tag/category taxonomy — when registry hits 15-20 entries.
- A `/journal/feed.xml` RSS endpoint — when there's an audience asking
  for it. Currently nobody is.
