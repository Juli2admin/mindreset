# Search Console + Bing Webmaster setup

One-time setup runbook. Re-read this when re-verifying or adding a
second property (e.g. if `www.mindreset.ai` ever needs separate
verification from `mindreset.ai`). Otherwise it's "do once, done".

Prerequisite: `mindreset.ai` is live and resolves on Vercel.

---

## 1. Google Search Console (~10 min)

1. Open `https://search.google.com/search-console` while signed in to
   the Google account that should own the property long-term (use a
   non-personal account if you have one — ownership transfers are
   painful).
2. **Add property** → choose **URL prefix** (not Domain — URL prefix is
   simpler and matches what the verification meta tag verifies).
   Enter: `https://mindreset.ai/`
3. Verification method → **HTML tag**. Google shows a meta tag like:
   ```html
   <meta name="google-site-verification" content="ABCDEF...xyz" />
   ```
   Copy the value of `content="..."`. That's the token.
4. Vercel dashboard → Project → Settings → Environment Variables.
   Add:
   - Name: `GOOGLE_SITE_VERIFICATION`
   - Value: the token from step 3 (no quotes)
   - Environments: **Production** (only — Preview deploys shouldn't
     claim ownership of the live property)
5. Trigger a Production deploy (push a no-op commit, or click
   "Redeploy" on the latest Production deployment).
6. Wait ~30s for the deploy to go live. Visit
   `https://mindreset.ai` → view-source → grep for
   `google-site-verification`. Confirm the tag is present.
7. Back in Search Console → click **Verify**. Should succeed within
   seconds.
8. Once verified, in Search Console:
   - **Sitemaps** → submit `https://mindreset.ai/sitemap.xml`
   - **Settings** → confirm crawl rate is on auto (the default)
   - **Indexing → Pages** → submit `https://mindreset.ai/` for
     indexing if it isn't already
9. Bookmark Search Console. Re-check **Performance → Search results**
   weekly during the first month for impression / click data.

---

## 2. Bing Webmaster Tools (~10 min)

Bing matters more than its market share suggests because:
- DuckDuckGo searches use Bing's index
- ChatGPT search uses Bing
- Yahoo searches use Bing

Setup:

1. Open `https://www.bing.com/webmasters` and sign in.
2. **Import from Google Search Console** is the fastest path if GSC
   verification (step 1 above) is already done. Click it → authorise
   Google → Bing imports the verified property automatically.
3. If import doesn't work, use the manual path: **Add a site** →
   enter `https://mindreset.ai/` → **HTML Meta Tag** verification.
   Bing shows a meta tag like:
   ```html
   <meta name="msvalidate.01" content="ABCDEF...xyz" />
   ```
   Copy the value of `content="..."`. That's the Bing token.
4. Vercel dashboard → Project → Settings → Environment Variables.
   Add:
   - Name: `BING_SITE_VERIFICATION`
   - Value: the Bing token (no quotes)
   - Environments: **Production**
5. Trigger a Production deploy (same as step 5 above).
6. View-source on `https://mindreset.ai` → grep for `msvalidate.01`
   → confirm.
7. Back in Bing Webmaster → click **Verify**.
8. Once verified, in Bing Webmaster:
   - **Sitemaps** → submit `https://mindreset.ai/sitemap.xml`
   - **URL Submission** → submit `https://mindreset.ai/` if not
     already crawled

---

## What to expect

- **First 24-48h**: GSC and Bing crawl the homepage, then walk the
  sitemap.
- **First 1-2 weeks**: index population. Most pages indexed by the end
  of week 2.
- **First 1-2 months**: search impression data accumulates. Click data
  follows impressions by a few weeks.
- **Anything not indexed after 4 weeks**: investigate. Common causes
  are noindex flags on pages that shouldn't have them, robots.txt
  mistakes, or JS-only content (none of these should apply here —
  everything ships as SSR with proper canonical/hreflang).

---

## Troubleshooting

**"Couldn't verify"** after the Verify click:
- Check the tag is on `https://mindreset.ai` (not the Vercel
  `*.vercel.app` URL). View-source the homepage at the real domain.
- Confirm the deploy that included the env var is actually the
  Production deploy (not just a Preview).
- Wait 60s and retry. Google's verifier sometimes lags edge cache
  invalidation.

**Sitemap submitted, "Discovered — currently not indexed"**:
- Normal for new sites in the first 1-2 weeks. Don't troubleshoot
  before week 3.
- If still un-indexed at week 3, check Search Console → **Indexing
  → Pages** → "Why pages aren't indexed". Common causes: thin
  content (won't apply — every page here has substance), duplicate
  without canonical (shouldn't apply — `pageAlternates` sets
  canonical everywhere), discovered crawl errors.

**Impressions = 0 after 2 weeks**:
- Either the property is verified but for the wrong URL prefix
  (`http://` vs `https://`, or `www.` vs apex), or nobody is
  searching the terms the site ranks for yet. Check the
  **Search results** report — if there's any impression, even on
  a single query, the property is fine.

---

## What NOT to do

- Don't add Google Analytics 4 yet. That's a separate decision
  (see `docs/operations/google-promotion.md` for when).
- Don't set up Google Ads conversion tracking yet. Same.
- Don't disable Vercel preview deploy URLs. They're noindex-ed by
  `app/robots.ts`, so they don't compete with the real domain.
- Don't add a `www.mindreset.ai` Search Console property unless you
  intentionally support the `www.` host. Right now `mindreset.ai`
  apex is canonical; adding a `www.` property fragments crawl signals.
