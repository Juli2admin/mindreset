# Google promotion — runbook for after Block C

When to use this doc: **after Block C ships** (S&T modules + The Journey
content live and purchasable). Pre-launch and during soft-launch, this
sits idle — paid promotion before product-market fit is the #1 way
early-stage products waste money.

Goal of this doc: when you're ready to scale acquisition via Google,
this gives you the practical sequence, the policy landmines specific
to mental-wellness brands, and the order-of-operations from "no
analytics" to "paid campaigns running."

---

## TL;DR — order of operations

1. **GA4** (Google Analytics 4) — track behaviour, build conversion data
2. **Google Tag Manager** — clean way to wire GA4 + Ads tags later
3. **Conversion events** — define what counts as a "win" (sign-up, paid sub)
4. **4-12 weeks observation** — let organic traffic accumulate so you
   know what messaging converts before paying for clicks
5. **Google Ads healthcare certification** — required for mental-wellness
   keywords, 1-3 week approval
6. **Pilot campaign £200-500/mo** — single keyword group, single landing
   page, watch CPA closely for 30 days
7. **Scale only if CPA < LTV × 0.3** (rough rule of thumb for SaaS)

---

## Phase 0 — Foundation (free, do before any paid spend)

### 0.1 — Set up GA4

1. <https://analytics.google.com> → admin → **Create property**
2. **Property name**: MindReset.ai
3. Time zone: London. Currency: GBP.
4. Add **data stream** → Web → URL `https://mindreset.ai` → stream name
   "MindReset Production"
5. Copy the **Measurement ID** (looks like `G-XXXXXXXXXX`)
6. Vercel env: add `NEXT_PUBLIC_GA_MEASUREMENT_ID = G-XXXXXXXXXX` (all
   scopes — analytics on preview is fine, no privacy issue)
7. Ship a small PR adding `<Analytics />` from `@next/third-parties/google`
   in `app/[locale]/layout.tsx` — Next.js loads GA4 with SSR-safe
   defaults, respects the existing cookie banner if you ship one

### 0.2 — Define conversion events

In GA4 → **Events → Mark as conversion** for these 3:

| GA4 event | Triggers when |
|---|---|
| `sign_up` | User completes `/sign-up` (POST to /api/webhooks/clerk success) |
| `purchase` | Stripe webhook fires `checkout.session.completed` for any paid plan |
| `subscription_renewed` | Stripe webhook fires `invoice.payment_succeeded` with `billing_reason=subscription_cycle` |

These already happen in your backend. Two ways to fire them in GA4:

- **Client-side**: layer GTM and push events on relevant client navigations
  (simpler, but GA4 sees front-end signal only — misses webhooks)
- **Measurement Protocol**: server-side POST to GA4 from your Stripe
  webhook handler. Authoritative, gives you Stripe-confirmed revenue
  data. More work — 1-2 hrs.

Recommend: **client-side for sign_up, server-side for purchase**.
Revenue numbers in GA4 must be authoritative for Ads bidding later.

### 0.3 — Wire conversion tracking pixel for future Ads

Even before running ads, install **Google Ads conversion pixel**:
- Google Ads dashboard → Tools → Conversions → New
- Conversion category: **Purchase**
- Value: dynamic (you set per event)
- Get the **conversion ID** + **conversion label**
- Ship a tiny helper to fire it on `/checkout/success` page

Why now: Google Ads needs ≥7 days of conversion data BEFORE it can
optimise bidding. Wiring this pixel pre-spend means day 1 of paid
campaigns has real signal.

### 0.4 — Apply for Google for Startups credits

<https://cloud.google.com/startup>. Up to **$100k in GCP credits** if
accepted. Free money. Application takes 2-4 weeks to process. Apply
now even though you're on Vercel + Supabase — credits work for any
future GCP usage (you'd swap if you outgrow Vercel).

---

## Phase 1 — Watch organic (4-12 weeks)

Pre-paid-spend, your job is to **understand your funnel** before you
pay to fill the top of it.

### Metrics to track weekly

- **Sessions** (GA4 → Reports → Acquisition)
- **Sign-up rate** = sign_ups / sessions (typical 1-5% for cold traffic)
- **Paid conversion** = first purchases / sign-ups (typical 2-10%
  freemium-to-paid in month 1)
- **Top organic queries** (Search Console → Performance)

### Decisions Phase 1 informs

1. **Which keywords actually bring sign-ups?** If organic search shows
   *"AI journaling app"* converts at 5% and *"trauma support"* at 0.2%,
   bid on the former.
2. **Which Landing copy hooks?** If the *"Why MindReset feels different"*
   section drives most scroll-to-pricing, double down on that messaging
   in ad creative.
3. **What's your typical CPA tolerance?** = Average month-1 revenue per
   paid user × your acceptable payback period.

### Don't run ads until

- ≥30 paying customers (sample size for CPA math)
- ≥3 months of churn data (LTV estimate)
- Stripe shows ARPU > £15 (your £14.99/mo tier is the floor)

---

## Phase 2 — Google Ads (paid acquisition)

### 2.1 — Healthcare advertiser certification

**Required** before you can advertise mental-wellness keywords.

1. <https://support.google.com/adspolicy/answer/176031> — read the full
   healthcare advertising policy first
2. <https://support.google.com/adspolicy/answer/9893309> — apply for
   certification
3. You'll need:
   - ICO registration (you have: ZB642008)
   - Privacy Policy (live)
   - Confirmation you're not making medical claims (your brand voice
     already complies — see `docs/product/philosophy.md` forbidden list)
4. Processing time: **1-3 weeks**. Some applications get rejected with
   feedback; iterate and resubmit.

### 2.2 — Brand-voice constraints for ad copy

The same forbidden-words list from your Stripe-surface rules applies to
Google Ads copy. **NEVER use** in ad headlines or descriptions:

- *therapy, therapeutic, treatment, medical, mental illness, diagnosis,
  counseling, counselling, clinical intervention, unlimited*
- *cure, fix, heal, recover from* (implies treatment)
- *anxiety relief, depression help* (medical claim)

**Approved language** for ads:

- *self-help, self-guided reflection, emotional wellbeing, personal growth*
- *companion for daily reflection, structured method, women-focused*
- *trauma-informed self-development, recovery support*

### 2.3 — Pilot campaign structure

Start narrow. **One campaign, one ad group, one keyword theme** for the
first 30 days.

- **Campaign type**: Search (not Performance Max — gives you control)
- **Budget**: £15-20/day = ~£500/mo
- **Bidding**: Maximise Conversions (let Google's ML optimise once
  conversion pixel has data)
- **Locations**: UK only at first. Expand once CPA known.
- **Audience**: women 25-55, optionally
- **Keyword theme example**: *"self-help app"*, *"AI journaling app"*,
  *"personal growth app"*, *"women self-discovery app"*
- **Negative keywords**: *therapy, therapist, free, jobs, hiring,
  download mod, crack* (filters out non-converters and policy minefields)
- **Ad copy**: 3-5 variants. Each leans on a different angle (founder
  story / methodology / The Journey 8-block / free taster)
- **Landing page**: Pricing OR a dedicated `/start` landing with
  paid-traffic-optimised copy + signup form right there

### 2.4 — 30-day measurement

After 30 days of pilot:

- **Healthy signal**: CPA < £30, ≥3% conversion rate, ≥10 paid sign-ups
- **Iterate**: pause keywords with CPA > £50 or 0 conversions in 14 days
- **Stop**: if total CPA > £60 and no positive trend, the message-market
  fit isn't there yet — return to organic, refine product, retry later

### 2.5 — When to scale

Rule of thumb: scale paid spend when **CPA < LTV × 0.3**

Example: if a paying customer's average lifetime value is £150
(roughly £15/mo for 10 months), your CPA ceiling is £45. Spend more
the further under that you are.

---

## Other Google promotion surfaces (defer further)

### Performance Max
Google's all-channel campaign type. **Don't use early** — it eats budget
across channels with little control. Wait until you have ≥6 months
data and £2k+/mo budget.

### YouTube ads
Effective for consideration-stage products but production cost (script
+ shoot + edit) starts at £500-1000 per video. Defer until brand is
established.

### Google Discovery
Native ads in Gmail + YouTube Home + Discover feed. Cheaper CPC than
Search but lower intent. Worth testing once Search is profitable.

### Google Display Network
Banner ads across the web. Generally low quality traffic for
subscription products. Skip unless you have specific retargeting needs.

---

## Cost summary

| Item | Cost | When |
|---|---|---|
| GA4 setup | £0 + 30 min | Now (before launch) |
| Google Tag Manager | £0 + 1 hr | With GA4 |
| Conversion pixel | £0 + 30 min | With GA4 |
| Google for Startups | £0 + 1 hr application | Now (long approval) |
| Healthcare advertiser cert | £0 + waiting | Before Phase 2 |
| Pilot ad campaign | £500/mo for 1 month | Phase 2 only |
| Scaling campaigns | £1k-10k/mo | After Phase 2 success |

---

## When to revisit this doc

- After Block C ships (S&T + Journey content live)
- After ≥30 paying customers, ≥3 months data
- When you're ready to spend £500/mo on customer acquisition

Then start at **Phase 2.1 (certification)** and work forward. Phase 0
should already be done by then.

---

## Related docs

- `docs/operations/launch-cutover.md` — production-cutover runbook
- `docs/product/philosophy.md` — brand voice + forbidden words
- `docs/decisions/locked-decisions.md` — pricing + tier logic
