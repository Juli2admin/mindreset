# SESSION HANDOFF — 2026-06-04

**Read this BEFORE CLAUDE.md.** This is the most recent operational state.
Supersedes the earlier handoff (2026-05-22).

---

## TL;DR — where we are

MindReset is **soft-launch ready**. The full cutover ran today: Stripe Live,
Clerk Production + custom domain, Resend, Vercel env swap, DNS, smoke tests,
Google Search Console indexing live, PWA installable. 24 PRs shipped this
session — see **Today's PRs** below.

Next chapter: **Block C — the 8 blocks of The Journey + States & Themes
modules**. This is content + module-delivery infrastructure that was
deliberately deferred from soft launch. Pricing pages already show
"available soon" badges for these SKUs. Owner is starting a fresh
session for Block C work.

---

## What is working (verified by owner this session)

- **Stripe Live**: 3 products (Essential, Extended, Top-up) with 5 prices.
  Live webhook at `mindreset.ai/api/stripe/webhook` subscribed to 6 events.
  Customer Portal saved in Live mode. £4.99 top-up purchase flow tested
  end-to-end with `jloya4436@gmail.com`.
- **Clerk Production**: Pro upgraded. Custom domain `clerk.mindreset.ai` +
  `accounts.mindreset.ai` + DKIM records verified in Namecheap. Production
  API keys (`pk_live_`, `sk_live_`) + webhook secret in Vercel Production.
  Dev keys (`pk_test_`, `sk_test_`) added to Preview + Development so PR
  previews build.
- **Resend**: domain verified (DKIM/SPF/DMARC). Inbound webhook reaches
  `mindreset.ai/api/webhooks/email-inbound` successfully — proven by
  delivered test email producing a SupportEmail row.
- **DNS `mindreset.ai` → Vercel**: connected (confirmed by inbound webhook
  + browser tests). The CLAUDE.md note about apex DNS being pending is
  stale.
- **Welcome email**: arrives on real sign-up (verified with
  `jloya4436@gmail.com`).
- **Sign-up funnel**: Landing → Screening → Sign-up → Home → MiniMind
  works end-to-end for fresh accounts.
- **Admin access**: `loyayulia@gmail.com` signs into `/admin` (overview,
  support queue, testimonials moderation, marketing, telemetry,
  subscriptions, promo codes).
- **PWA installable**: `apple-touch-icon`, `icon-192/512`, `manifest.json`,
  Apple meta tags, theme-color all wired in `app/[locale]/layout.tsx`.
- **Google Search Console**: domain verified via DNS TXT. Sitemap at
  `https://mindreset.ai/sitemap.xml` accepted with 64 URLs discovered.
  Indexing starts within 24-72 hours.
- **Sentry**: error monitoring live (client + server + edge).
- **Testimonials**: 3 approved testimonials (Sarah / Emma / Rachel) live on
  Landing + Pricing across all 8 locales (display rule changed to global
  threshold so non-EN locales also show the block).

---

## What is broken / unverified

- **`loyayulia@gmail.com` as a regular USER**: data state corrupted from
  today's dev→prod migration testing. Owner deliberately keeps this email
  as admin-only and uses `jloya4436@gmail.com` for user-side testing. Not
  a code bug — won't affect real customers.
- **`STRIPE_PRICE_TOP_UP` legacy env name**: owner kept the underscore-
  before-UP spelling rather than the canonical `STRIPE_PRICE_TOPUP`. Code
  accepts both via fallback in `lib/stripe/products.ts:11-17` — no
  functional impact, just deferred cleanup.
- **Auto-send Phase 2 for support emails**: code shipped, env-var-gated
  (`AUTO_SEND_SUPPORT_ENABLED`), cron de-registered from `vercel.json`
  because Hobby plan caps minute-level crons. Re-enable when on Pro
  (re-add cron entry + set env var).
- **`Purchase.userId` missing `onDelete: Cascade`**: schema oversight
  surfaced when GDPR-deleting users with purchases. Not blocking for soft
  launch (no real refunded customers yet); needs a small schema PR before
  any GDPR delete request lands.
- **Sign-up T&C link uses `target="_blank"`**: on mobile / in-app browsers
  this can navigate in-place instead of opening a tab, causing the
  sign-up tab to be lost. Discovered while triaging the screening loop
  earlier today. Tracked as a known UX foot-gun; non-blocking but worth a
  small fix.

---

## Today's PRs (chronological)

All merged. Branch deletions handled. `main` is at `f63c762` plus this
handoff PR.

| PR | Title |
|---|---|
| #102 | fix(inbound): defensive body extraction + raw-payload fallback + Sentry telemetry link |
| #103 | fix(inbound): fetch body via Resend Receiving API (webhook is metadata-only) |
| #104 | fix(inbound): Resend REST returns email fields flat, not wrapped in `{ data }` |
| #105 | docs: close open-question #24 (marketing-consent UI) as resolved by PR #89 |
| #106 | feat(support): Phase 2 narrow auto-send for methodology emails |
| #107 | fix(screening): break post-signup redirect loop (Clerk webhook race) |
| #108 | fix(deploy): remove minute-level cron blocking Hobby deploys |
| #109 | fix(screening): drop the failing transaction (real root cause was FK, not P2025) |
| #110 | chore(screening): extract linkage helper + Vitest regression test |
| #111 | fix(launch): clear customer-facing legal placeholders + Stripe env fallback + cutover doc |
| #112 | fix(minimind): backfill screeningResult from any past ScreeningResponse |
| #113 | chore(seo): locale-correct canonicals + Product JSON-LD + robots disallow expansion |
| #114 | feat(admin): testimonials moderation page |
| #115 | feat(testimonials): show on every locale once 3+ approved globally |
| #116 | feat(about): founder origin story page (`/about`) |
| #118 | feat: Footer compliance line + RU translations for About + Footer |
| #119 | i18n: About page + Footer translations — FR, DE, ES, IT, PL, PT |
| #120 | feat(landing): 'Why MindReset feels different' + 7 locale translations |
| #121 | feat(pwa): installable home-screen app + Google Search Console verification hook |
| #122 | fix(middleware): skip sitemap.xml and robots.txt (Search Console couldn't fetch the sitemap) |
| #123 | docs(ops): Google promotion runbook for after Block C |
| (this) | docs: session handoff 2026-06-04 |

Plus: SQL run manually in Supabase for PR #106 schema change
(`SupportEmail.autoSendAt`) and a manual `DELETE` to clean up the
owner's dev-era User row.

---

## Block C — what next session should know

The 8 blocks of The Journey are named in the About page and Stripe
products:

1. **Stop**
2. **Pain**
3. **Inner Self**
4. **Parts & Trauma**
5. **Foreign Parts**
6. **Support**
7. **New Model**
8. **Identity**

States & Themes modules (separate from Journey): 9 modules (anxiety, low
energy, come back, empty + 5 themes — money, body, family, shame,
self-realisation), each £59 one-off for non-subscribers, £29 for
subscribers (subscriber discount = `STRIPE_COUPON_MODULE` already
created in Stripe Live).

### Stripe state for Block C (already created, unused in code)

Owner created these in Live mode this session — sitting unused:

```
STRIPE_COUPON_MODULE = YUkaLfPZ
STRIPE_PRICE_STATE_ANXIETY        = price_1TeVIfEnfIBDDBbc5zaQKwaz
STRIPE_PRICE_STATE_LOW_ENERGY     = price_1TeVGFEnfIBDDBbcBaRhBift
STRIPE_PRICE_STATE_COME_BACK      = price_1TeVEMEnfIBDDBbczHg2GyV3
STRIPE_PRICE_STATE_EMPTY          = price_1TeVCVEnfIBDDBbc12o4Kque
STRIPE_PRICE_THEME_MONEY          = price_1TeVAYEnfIBDDBbciUdBSXH8
STRIPE_PRICE_THEME_BODY           = price_1TeV8dEnfIBDDBbcORyoYQOj
STRIPE_PRICE_THEME_FAMILY         = price_1TeV6YEnfIBDDBbcUjoQnF27
STRIPE_PRICE_THEME_SHAME          = price_1TeV4FEnfIBDDBbcC1JjGjZi
STRIPE_PRICE_THEME_SELF_REALISATION = price_1TeV1xEnfIBDDBbcMUaingeZ
STRIPE_PRICE_JOURNEY_FULL         = price_1TeUxEEnfIBDDBbcYppaQAgg
STRIPE_PRICE_JOURNEY_WEEKLY       = price_1TeUtYEnfIBDDBbcF5a8QbS5
```

Not in Vercel env yet. Adding them to Vercel and wiring
`app/api/checkout/create/route.ts` to recognise them is part of Block C.

### Files to start from for Block C

- `docs/operations/launch-cutover.md` — what's done
- `docs/operations/google-promotion.md` — defer until after Block C
- `mindreset-app/architecture.md` — data model overview
- `lib/stripe/products.ts` — extend with Block C SKUs
- `app/api/checkout/create/route.ts` — checkout endpoint to extend
- `app/[locale]/pricing/PricingClient.tsx` — pricing page currently
  shows S&T + Journey as "available soon" badges; flip those when the
  flow is live
- `prisma/schema.prisma` — likely needs new tables for module / Journey
  progress tracking (currently `ModuleProgress` and `RecodeProgress`
  exist as stubs)

### Block C dependencies / open product questions

These need owner sign-off before code work starts:

- **Module content format**: text + audio + video? markdown? interactive?
- **The Journey 8-block delivery**: linear unlock (must finish block N
  before N+1)? Time-gated (one block per week)? All available from purchase?
- **Module → subscription discount**: code applies `STRIPE_COUPON_MODULE`
  to module checkout when the user has an active sub. Need: when does
  "active sub" mean? Mid-cycle of cancelled sub still counts?
- **Refund policy** for £599 Journey full programme already locked
  (non-refundable once first block accessed — see CLAUDE.md). Need same
  level of clarity for States & Themes modules.

---

## Service state snapshot

| Service | Mode | Notes |
|---|---|---|
| Stripe | Live | All 5 launch SKUs + Block C SKUs created. Webhook live. Portal saved. |
| Clerk | Production | `clerk.mindreset.ai` verified. Production keys + webhook in Vercel. |
| Resend | Live (single environment) | Domain verified. Inbound webhook live. `RESEND_FROM_SUPPORT_EMAIL` not set — falls back to `hello@mindreset.ai`. |
| Vercel | Hobby | Hobby caps cron at daily. Block C may push us to Pro. |
| Sentry | Live | Client + server + edge configs present. Project URL in `/admin/telemetry`. |
| Google Search Console | Verified + sitemap accepted | Indexing in progress. |
| Supabase | Postgres live | All migrations applied manually. |

---

## Env vars set in Vercel

**Production scope (live):**

- `STRIPE_SECRET_KEY` = `sk_live_…`
- `STRIPE_WEBHOOK_SECRET` = `whsec_…` (live)
- `STRIPE_PRICE_ESSENTIAL_MONTHLY`, `STRIPE_PRICE_ESSENTIAL_ANNUAL`,
  `STRIPE_PRICE_EXTENDED_MONTHLY`, `STRIPE_PRICE_EXTENDED_ANNUAL`,
  `STRIPE_PRICE_TOP_UP` = live price IDs
- `CLERK_SECRET_KEY` = `sk_live_…`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_…`
- `CLERK_WEBHOOK_SECRET` = `whsec_…` (live)
- `NEXT_PUBLIC_APP_URL` = `https://mindreset.ai`
- `ADMIN_EMAILS` = `loyayulia@gmail.com`

**Preview + Development scope (test/dev):**

- `CLERK_SECRET_KEY` = `sk_test_…`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_test_…`
- `CLERK_WEBHOOK_SECRET` = `whsec_…` (dev)
- `ADMIN_EMAILS` = `loyayulia@gmail.com,jloya4436@gmail.com`
- `NEXT_PUBLIC_APP_URL` = `https://mindreset.ai`

**Optional / not set (falls back to safe default in code):**

- `RESEND_FROM_SUPPORT_EMAIL` — code falls back to `hello@mindreset.ai`
- `SEV5_ALERT_EMAIL` — falls back to first `ADMIN_EMAILS` entry
- `AUTO_SEND_SUPPORT_ENABLED` — keep unset until on Vercel Pro with
  re-added cron
- `GOOGLE_SITE_VERIFICATION` — not needed (owner used DNS TXT verification
  instead of HTML meta tag)

---

## CLAUDE.md doc drift

`CLAUDE.md` "Deployment / domain — current state (as of 22 May 2026)"
section is **stale**. Items to refresh in a future doc PR (not urgent):

- "mindreset.ai is NOT connected to Vercel yet" → it IS connected
- "production = whatever Vercel-provided URL the project is serving" →
  production is `mindreset.ai`
- Stripe webhook URL bypass note → now uses clean
  `https://mindreset.ai/api/stripe/webhook`
- Add: PWA + Google indexing shipped 2026-06-04

---

## Tone reminder for next session

- Owner pushes through quickly; minimise back-and-forth
- Don't pile multiple steps in one message — give one clear next action
  at a time when walking through dashboard work
- Verify with code-side audits before patching; today's session burned
  hours on multiple "wrong fix" patches because of insufficient
  upfront investigation
- Owner is the final decision-maker on product copy + UX choices —
  propose, don't impose
