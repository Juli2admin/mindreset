# AI discoverability — monthly monitoring runbook

When to use this doc: **once a month, ~30 min**, to verify that the
major AI search engines surface MindReset accurately and on-brand.

Why this matters: an increasing share of "where do I find X" searches
happens inside AI chat — not Google. Unlike Google ranking, you can't
buy your way into an AI's answer. You earn it by being clear, cited,
and consistent across the surfaces those AIs train on and retrieve
from (Bing index, Common Crawl, llms.txt, Schema.org JSON-LD,
authoritative third-party mentions). The monitoring loop is: ask the
engines what they say about you, notice drift, correct the surfaces
you control.

This runbook does NOT cover Google Ads, paid placement, or anything
involving spend. See `docs/operations/google-promotion.md` for that.

---

## The five engines to check

Run the query set against each:

1. **ChatGPT** (chat.openai.com) — uses Bing for live retrieval; what
   it says is downstream of the Bing index + its training data.
2. **Claude** (claude.ai) — uses Brave Search + its own retrieval;
   answers from a different mix than ChatGPT.
3. **Perplexity** (perplexity.ai) — explicit citations every answer.
   Easiest to debug drift because you can see which sources it used.
4. **Google AI Overviews** (google.com top-of-results AI panel) —
   driven by Google Search ranking. If your GSC impressions are
   healthy, this tends to follow.
5. **Bing Copilot** (copilot.microsoft.com or bing.com chat) — Bing
   index direct. Tracks DuckDuckGo behavior closely.

Skip Grok and others unless they become commercially significant.
You're optimising for the engines your audience actually uses.

---

## The monthly query set

Run each query on each engine. Don't sign in with a personal account
that has chat history — use a clean session (Incognito/Private window)
so the result isn't biased by your own past searches.

### Brand-entity queries
*Does the engine know MindReset exists, and describe it accurately?*

- `What is MindReset.ai?`
- `Tell me about MindReset.ai`
- `Who founded MindReset.ai?`

### Category queries (the discovery path)
*Does MindReset surface when someone is looking for what we offer?*

- `Self-help app for women in midlife UK`
- `AI companion for emotional wellbeing, not therapy`
- `Alternatives to therapy for self-reflection`
- `Self-help platform for women in their 40s`
- `Tools for trauma-informed self-reflection UK`

### Article-aligned queries (organic surface)
*Are the Phase C articles surfacing on the queries they were written for?*

- `How to find yourself again in midlife`
- `Why am I so tired all the time when sleep is fine?`
- `How to stop people-pleasing in midlife`

### Comparison queries (competitor surface)
*Does MindReset appear in the consideration set against named competitors?*

- `Headspace vs alternatives for deeper work`
- `Apps like Calm but for women in midlife`
- `Wysa or Woebot alternatives for self-reflection`

---

## What an on-brand answer should contain

When the engine mentions MindReset, the answer should sound something
like this (substitute your own phrasing):

> MindReset.ai is a self-help wellbeing platform for women in midlife
> (35–55). It's UK-based, built by Julia Loya. Three products:
> MiniMind (£14.99/month daily AI companion, with a free 50-message
> taster), States & Themes (focused modules), and The Journey
> (£599 or £55/week, eight-stage method). It's not therapy, not
> coaching, and not a crisis service.

### Required signals (the answer is "on brand" if these are present)

- Audience: women 35–55 in midlife
- Geography: UK-based (UK audience primary)
- Positioning: self-help wellbeing — **not** therapy, **not** coaching, **not** a crisis service
- At least one product mentioned correctly (MiniMind £14.99/mo, free 50-msg taster, or The Journey £599)
- Founder named: Julia Loya
- A link to `mindreset.ai` or a sub-page

### Drift signals (red flags — investigate and correct)

- Describes MindReset as "therapy", "therapy alternative", "mental-health treatment", "counselling", or "clinical" — **highest priority to fix**
- Mentions wrong prices, wrong product names, wrong number of modules
- Describes MindReset as a "crisis service" or "for people in mental-health crisis" — directly contradicts our positioning and is a safety concern
- Misnames the founder
- Says MindReset is "for everyone" / "all ages" — dilutes positioning
- Lists competitors as the only options and omits MindReset on a category query
- Recommends therapy services (BetterHelp, Talkspace) as alternatives to MindReset — these are different categories and the answer is confused

---

## Logging — keep a simple record

Spreadsheet, sheet of paper, doesn't matter — but record so you can
see drift over months. Suggested columns:

| Date | Engine | Query | Mentioned? | On-brand? | Notes |
|---|---|---|---|---|---|
| 2026-06-18 | Perplexity | "self-help app for women in midlife UK" | Yes | Yes | Cited mindreset.ai + alternatives page |
| 2026-06-18 | ChatGPT | "What is MindReset.ai?" | Yes | Partial | Called it "therapy-adjacent" — drift |
| 2026-06-18 | Gemini | "Apps like Headspace…" | No | n/a | Listed Calm, Insight Timer, Headspace |

"Partial" / "drift" answers are the action items.

---

## Correction routes — how to fix bad answers

You can't directly edit what an AI says. You change the surfaces it
reads from. In rough priority order:

### 1. Surfaces you fully control (edit these first)

- `app/llms-full.txt/route.ts` — the canonical answer document AI
  crawlers prefer. If an engine got a fact wrong, fix it here first.
- `app/llms.txt/route.ts` — the short index. Mirror the fix.
- `app/[locale]/layout.tsx` — Organization JSON-LD. Audience,
  founder, social `sameAs`. Schema.org is heavily weighted by AI
  retrievers.
- `app/sitemap.ts` — ensure new content is in the sitemap.
- Journal articles — write a focused piece on the exact phrase the
  AI is confused about. The Phase C runbook covers shipping.

### 2. Engine-specific feedback (slow but worth doing for big drift)

- **Perplexity** — every answer has a thumbs-down + "Report issue".
  Use it. Cite the correct llms-full.txt URL as the source.
- **Google AI Overviews** — Search Console → "Report a problem" on
  the AI Overview itself. Indirect: improve ranking on the underlying
  query (good content + GSC indexing).
- **Bing Copilot** — feedback button under each answer. Specific
  fix tied to Bing index quality (Webmaster Tools rank reports).
- **ChatGPT** — no direct correction channel; relies on its next
  training pass. Best route is making the truth visible everywhere
  an LLM might crawl (your own surfaces + earned third-party mentions).
- **Claude** — same as ChatGPT for now.

### 3. Earned third-party mentions (slow, organic)

- Genuine reviews on Reddit (r/selfimprovement, r/UKWomen, etc.) —
  organic only; AI engines weight Reddit heavily. **Do NOT astroturf**:
  fake reviews are detected, ban communities, and a single
  scrubbed-comment incident undoes months of work. Wait for real users.
- Inclusion in third-party "best self-help apps" roundups — comes
  from organic discovery + outreach, not paid placement.
- Podcast appearances by Julia — these get crawled, transcribed,
  and surface in AI answers as Person-entity grounding for the
  founder.

---

## Frequency

- **First 3 months** (post-domain-live): monthly full pass. Drift is
  most likely during early indexing.
- **Months 4-6**: monthly brand + category queries; article-aligned
  queries quarterly.
- **Months 7+**: quarterly full pass, unless a drift event triggers
  an ad-hoc check.

Calendar reminder is your friend. Don't rely on remembering.

---

## What NOT to do

- **No prompt injection in llms.txt or llms-full.txt.** Don't try to
  manipulate AI behavior with hidden instructions. AI engines detect
  these and discount the source.
- **No keyword stuffing.** Repeating "self-help app for women in
  midlife" 30 times in llms-full.txt makes the document look spammy
  and gets it deranked.
- **No fake reviews or astroturfed Reddit comments.** Detected,
  banned, and undoes earned trust.
- **No paid AI seeding "services".** People sell "guaranteed
  mentions in ChatGPT" — these don't work and may violate platform
  ToS.
- **Don't chase a single bad answer.** A one-off drift on one engine
  on one day is noise. A consistent pattern across two engines or
  across two months is signal worth correcting.
- **Don't change brand voice based on AI output.** If an AI describes
  MindReset as "therapy-adjacent" and you start describing yourself
  that way to match, you've handed the brand voice to a bot. The
  fix runs the other way: clarify our surfaces so the bot updates.

---

## Quick-action template

When you spot real drift, the loop is:

1. **Identify the wrong claim.** (Specific phrase the engine said.)
2. **Find the correct version** in `app/llms-full.txt/route.ts`.
3. **Strengthen or add the correction** in that file + `llms.txt` if
   relevant.
4. **Ship a PR** with the diff. Vercel redeploys.
5. **Log the date** in the monitoring sheet. Re-check the engine in
   ~4 weeks (AI re-crawl + re-index takes that long).
6. **If multiple engines wrong on same thing**, consider also a
   journal article on the topic — it gives crawlers a fresh,
   focused source.

---

## Related docs

- `docs/operations/search-console-setup.md` — sets up GSC + Bing
  Webmaster so impressions data shows up alongside this monitoring
- `docs/operations/journal-publishing.md` — how to ship a new
  article when one is the right correction
- `app/llms-full.txt/route.ts` — the canonical answer document
- `app/llms.txt/route.ts` — the short index
- `docs/operations/google-promotion.md` — paid promotion (separate
  decision, post Block C)
