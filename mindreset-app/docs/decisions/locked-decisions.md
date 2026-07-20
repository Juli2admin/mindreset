# Locked decisions — running log

Decisions that have been made and ratified. New entries go at the
bottom with a date. Once a decision is here, treat it as authoritative
unless the owner explicitly reopens it.

## Naming and process

- **2026-05-12** Branch naming: `claude/<topic>` for feature work.
  Squash-merge with descriptive PR title.
- **2026-05-12** Schema migrations are run **manually by Julia** in
  the Supabase SQL editor. Agent never runs `prisma migrate dev` or
  similar.
- **2026-05-13** GitHub MCP `owner` parameter is `Juli2admin` with a
  capital J. Lowercase returns 403.
- **2026-05-14** MiniMind prompt is **dual source of truth**:
  `lib/minimind/prompt.ts` + `docs/minimind/MiniMind_System_Prompt_v2.3.md`.
  Both must be updated in the same commit.
- **2026-05-14** Julia does not click merge buttons. The agent merges
  PRs via GitHub MCP.
- **2026-05-15** `mindreset-app/scripts/` is gitignored. Agent never
  `git add`s the scripts directory.

## i18n / RU style

- **2026-05-17** 8 locales total: en + ru native; fr/de/es/it/pl/pt are
  placeholders byte-identical to en.json.
- **2026-05-17** Native-locale set is locked in
  `components/LanguagePicker.tsx` (`NATIVE_CONTENT_LOCALES`).
- **2026-05-19** RU style:
  - Formal **Вы** by default
  - Informal **ты** only at trauma-soft moments (e.g.
    `Screening.yellowCta`)
  - **Feminine grammatical forms** are canonical
  - Use **ё** consistently
- **2026-05-19** Locale-specific quote marks: « » for RU/FR/ES/IT/PT;
  „ " for DE/PL.
- **2026-05-19** `Screening.tagline` RU is locked as
  "Травма-информированный спутник для самостоятельной работы..."
  (use as the canonical phrasing of the term).
- **2026-05-20** Phase 2b tooling pattern:
  `npm run i18n:sync` propagates en.json to placeholders;
  `npm run i18n:check` is the parity gate (wired into Vercel
  `prebuild`).
- **2026-05-20** All 8 message bundles' top-level keys are sorted
  alphabetically: Account, CrisisResources, DisclaimerModal, Footer,
  Landing, MiniMind, Screening, TopBar.

## Security

- **2026-05-20** RLS enabled + REVOKE ALL on all 10 public tables.
  Codified in `mindreset-app/db/rls.sql`. Future tables must add the
  same two lines to the canonical file. (PR #20.)
- **2026-05-20** Prisma's `postgres.*` role has `BYPASSRLS`, so the
  policy gain doesn't change app behaviour — it only blocks
  `anon`/`authenticated` from PostgREST access.

## Block B — Stripe billing

Locked 2026-05-21 in a single planning session.

1. **Tax / market**: UK-only at launch. Stripe Checkout restricts
   billing to GB. Stripe Tax stays OFF. Julia is not VAT-registered.
   *(Superseded by decision #44, 2026-05-25 — market scope opened to
   all countries; Stripe Tax remains OFF.)*
2. **Existing users**: No grandfathering. PR 1 migration resets all
   users to `currentTier = 'free'`, counters zeroed.
3. **PR 0 timing**: Standalone copy-only PR before any Stripe wiring.
   *(Shipped — commit `fd17934b`.)*
4. **Brand language scope**: Stripe payment surfaces only. In-app
   surfaces (screening, MiniMind prompt, Landing) keep "trauma-
   informed" and related language.
5. **Free taster start**: Counter starts at first MiniMind message
   sent (not at signup).
6. **Single-use enforcement**: Clerk primary email match,
   case-insensitive. (No Gmail-alias normalisation in v1.)
7. **At-cap UX**: Disabled chat input + inline banner showing reset
   date + top-up button. No modal. Chat history remains visible and
   scrollable.
8. **Stripe account status**: Exists, test + live keys obtainable.
9. **Free tier label on UI**: "Free taster".
10. **Tier differentiator**: Message allowance only — no feature flags
    between Essential and Extended for v1.
11. **T&Cs refund clause**: Included in PR 0. 7-day refund window from
    initial subscription purchase. LAST_UPDATED bumped to 20 May 2026.
12. **PR 0 scope**: Messages bundles + Landing + T&Cs + AccountClient
    restructure. Stale S&T/Journey prices hidden behind "Coming soon"
    badge.
13. **Stripe product names**: Plain functional names matching the app
    — `MiniMind Essential`, `MiniMind Essential Annual`,
    `MiniMind Extended`, `MiniMind Extended Annual`,
    `MiniMind Message Top-up`.
14. **EN tier copy**: Essential description = "A daily companion for
    self-guided reflection. 200 messages each billing cycle." (drops
    explicit "trauma-informed" framing on this surface).
    Extended description = "Higher monthly access for the times you
    need to lean in deeper. 800 to 1,200 messages each billing
    cycle."
15. **RU parity with EN**: When EN tier copy is revised, RU is updated
    to mirror.
16. **Cancellation behaviour**: Standard SaaS — access continues to
    end of current billing cycle on cancel. No partial-cycle refunds
    after 7-day window.
17. **Refund flow**: Manual via `support@mindreset.ai`. No self-serve
    refund UI at launch.
18. **Counter reset timing**: Driven by `invoice.payment_succeeded` webhook
    (Stripe anniversary). No separate cron. Auto-blocks user if renewal fails.
    **Confirmed by Julia 2026-05-21.**
19. **Mid-cycle upgrade (Essential → Extended)**: Counter persists; cap raises
    from 200 to 1,200. User is buying headroom, not a fresh allowance.
    **Confirmed by Julia 2026-05-21.**
20. **Mid-cycle downgrade (Extended → Essential)**: Effective at next cycle
    boundary via Stripe Customer Portal scheduled-change. No negative-cap edge
    case; user retains Extended access until period end.
    **Confirmed by Julia 2026-05-21.**
21. **Webhook endpoint scope**: Production only —
    `https://mindreset.ai/api/webhooks/stripe`. Local dev via
    `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
    **Confirmed by Julia 2026-05-21.**
22. **Receipt VAT line**: Hidden entirely. Stripe Tax OFF, no tax_id
    collection. Julia is not VAT-registered; subtotal = total.
    **Confirmed by Julia 2026-05-21.**
23. **S&T All Access subscription**: DROPPED ENTIRELY. The £29/month all-access
    S&T subscription no longer exists. Do not create it in Stripe.
    **Locked in spec v2, 2026-05-21.**
24. **S&T subscriber discount**: Non-subscribers pay £59/module; active
    MiniMind subscribers (Essential or Extended) pay £29/module. Discount
    applied automatically at Stripe checkout.
    **Locked in spec v2, 2026-05-21.**
25. **Free taster limit**: **50 messages lifetime** (changed from 20 in v1).
    **Locked in spec v2, 2026-05-21.**

## Pricing structure (locked — v2, 2026-05-21)

### MiniMind

| Product | Price | Limit |
|---|---|---|
| Free taster | £0 (no card) | **50** messages lifetime |
| MiniMind Essential | £14.99/month or £129/year | 200 msgs/cycle |
| MiniMind Extended | £24.99/month or £209/year | 800–1,200 msgs/cycle |
| Message top-up | £4.99 | +200 msgs/cycle, expires at reset |

Annual savings copy: "Annual billing saves around 28%" (Essential) and
"around 30%" (Extended).

### States & Themes

| Product | Price | Notes |
|---|---|---|
| S&T module (non-subscriber) | £59 per module | One-off, permanent access |
| S&T module (subscriber) | £29 per module | Auto-applied at checkout |
| S&T All Access subscription | DROPPED | Does not exist |

### The Journey

| Product | Price | Notes |
|---|---|---|
| The Journey (one-off) | £599 | Non-refundable once first block accessed |
| The Journey (installment) | 12 × £55/week | Not a subscription; can stop, no refund on paid weeks |

## Out-of-scope / explicit non-goals (locked)

- "Unlimited" tier — never. Use "Extended" / "Expanded" / "High Access".
- Multi-currency at launch — GBP only.
- Russian-market pricing — deferred to month 6.
- Annual → monthly downgrade flow — use Customer Portal cancel +
  re-subscribe.
- Pause subscription feature.
- Referral programme with per-user codes — deferred (reward = account
  credit, not cash).
- Self-serve refund UI — manual via email.
- S&T All Access subscription — removed from product structure entirely.

## Block B — implementation locks (2026-05-22)

Locked during the PR 3 / PR 4 / PR 5 build-out:

26. **Cycle = billing period.** Counter resets driven by
    `invoice.payment_succeeded` for `billing_reason: subscription_cycle`.
    Monthly subscribers reset monthly; annual subscribers reset annually.
    The word "cycle" in UI copy means the billing period.
    **Locked 2026-05-22.**
27. **Crisis / cooldown branches do NOT meter messages.** Safety
    surfaces are not charged: (a) cooldown-within-floor canned text,
    (b) cooldown-past-floor verifier + canned text, (c) Sev 4/5
    keyword crisis canned text, (d) zero-token stream failure (user
    message rolled back). Charging users in crisis is unacceptable.
    **Locked 2026-05-22 (PR #27 audit).**
28. **At-cap API response is HTTP 402** with `{ error: 'at-cap' }`.
    Client falls back to existing generic error suffix; SSR banner
    is the primary at-cap UX surface. No bespoke client-side 402
    handling.
    **Locked 2026-05-22.**
29. **Counter incremented post-stream-success only.** Inside the
    chat-route stream's `finally` block, only when
    `accumulated.length > 0`. Fire-and-forget so an increment-DB
    failure doesn't 500 a delivered turn.
    **Locked 2026-05-22.**
30. **Top-up pool consumed before cycle pool.** Mirrors
    `hasCapacity()` priority. `consumeMessage()` and `hasCapacity()`
    must stay in sync.
    **Locked 2026-05-22.**
31. **Top-up expires at billing-period reset.** `invoice.payment_succeeded`
    zeros both `messagesUsedThisCycle` AND `topUpMessagesRemaining`.
    Top-up is "extra headroom this cycle", not perpetual credit.
    **Locked 2026-05-22.**
32. **Webhook uses `updateMany` not `update`** for subscription/
    invoice events. A missing `stripeCustomerId` silently no-ops
    instead of throwing P2025 and triggering Stripe retries.
    **Locked 2026-05-22.**
33. **Top-up idempotency via `Purchase.stripeSessionId` unique
    constraint.** Webhook creates `Purchase` row first; P2002 means
    "already processed", skip the credit increment. Stripe retries
    cannot double-credit.
    **Locked 2026-05-22.**
34. **`current_period_end` defensive read.** Webhook reads from both
    `SubscriptionItem.current_period_end` (newer API: 2025-08-27.basil
    and after) and `Subscription.current_period_end` (older).
    SDK pinned to `2025-02-24.acacia` but webhook endpoint receives
    `2026-04-22.dahlia` events.
    **Locked 2026-05-22.**
35. **Customer Portal "Activate" toggle is for shareable links
    only.** API-based `billingPortal.sessions.create()` works without
    enabling the toggle. Settings (cancel mode, enabled features) must
    still be configured and saved.
    **Locked 2026-05-22.**
36. **Customer Portal cancel mode = "At end of billing period".**
    Configured in Stripe Dashboard → Settings → Billing → Customer
    portal. Aligns with locked decision #16 (no partial-cycle refunds
    after 7-day window).
    **Locked 2026-05-22.**
37. **Vercel Deployment Protection must stay OFF** at the project
    level. Was previously blocking Stripe webhooks with 401 SSO
    redirects. Do not re-enable.
    **Locked 2026-05-22.**
38. **PR #27 (message counter) approach** — audit-approved by owner:
    gate above all branches (so at-cap users can't pump messages
    through cooldown), increment only on successful AI turn, top-up
    consumed first, fire-and-forget consume call.
    **Locked 2026-05-22.**

## Market scope (2026-05-25)

44. **Open to all countries at launch.** Supersedes decision #1
    ("UK-only at launch"). No country restriction at Stripe Checkout
    (none was ever built in code; the original lock was aspirational).
    Julia is not VAT-registered; she knowingly accepts EU/non-UK VAT
    non-compliance risk at launch volume — no turnover threshold
    applies for non-resident sellers, but volume is too low to attract
    enforcement. Prices remain GBP-only, inclusive (no VAT line at
    checkout). Stripe handles FX automatically for non-GBP cards;
    customers see GBP at checkout regardless of their card's
    denomination (multi-currency pricing is locked out at launch — see
    Out-of-scope above).
    **Locked 2026-05-25.**

<!--
  Decision numbers #39–#43 were approved on 2026-05-22 and live in
  SESSION_HANDOFF.md pending transcription to this log. The next free
  number after the current section is #45, leaving the #39–#43 range
  reserved.
-->

## Voice input (originally 2026-05-22, transcribed 2026-05-26)

45. **Voice input on MiniMind chat — push-to-talk via Groq Whisper.**
    Mic button on the chat input bar. Tap to record, tap to stop,
    auto-stop at 2 minutes per turn. Audio uploads as multipart to
    `/api/minimind/transcribe`, which forwards to Groq's
    `whisper-large-v3-turbo` model (OpenAI-compatible endpoint). The
    returned transcript fills the chat textarea; the user reviews and
    edits before sending. The MiniMind prompt, safety scanner, memory
    pipeline, and chat-route gating are unchanged — they only ever
    receive text.
    
    Privacy commitments: audio is not persisted on our side at any
    layer (no DB write, no filesystem write, no logging of audio
    content). Zero Data Retention is enabled in the Groq console —
    audio is not retained by the speech-to-text provider after
    transcription either.
    
    Defence-in-depth: auth required, dual user (20/min) + IP (60/min)
    rate limit on the transcribe route, 10 MB upload cap before
    forwarding upstream, 503 (not 500) when GROQ_API_KEY is absent so
    the failure mode is "voice input unavailable" not "server bug".
    
    Legal copy: one paragraph each in Terms (Section 6) and Privacy
    (Section 4) covering transient audio handling. Provider name is
    not in the legal copy (matches the existing pattern that does not
    name Anthropic) — flexibility to switch providers later.
    
    **Originally locked 2026-05-22 (decision #22 in open-questions.md);
    transcribed to this log 2026-05-26.**

## Admin panel + soft-launch infrastructure

- **2026-05-31** **Admin email allowlist via env var.** `/admin` access is
  gated by Clerk sign-in (middleware) PLUS an `ADMIN_EMAILS`
  comma-separated allowlist checked in `app/admin/layout.tsx` via
  `currentUser()`. Non-admin signed-in users get a 404, not a 401, so
  the existence of /admin is not advertised. Production cutover requires
  re-adding admin emails on the production Clerk instance.

- **2026-05-31** **`/admin` is English-only and sits outside `[locale]`.**
  The admin layout renders its own `<html>`/`<body>`/`ClerkProvider`
  because the locale layout (which owns those on customer surfaces) does
  not run for /admin paths. Middleware skips next-intl for /admin.

- **2026-05-31** **Subscription pause/refund admin UI dropped.**
  Originally on the pre-launch plan (§4.4) as a trauma-informed UX
  feature. Dropped for two reasons: (1) Stripe's `pause_collection`
  doesn't gate access — paused customers still use MiniMind, so an
  honest pause would need access-gating logic and a "your subscription
  is paused" UI; (2) refunds happen ~1 in 100 transactions at launch
  volumes and take 30 seconds in Stripe Dashboard. Will revisit after
  the first month of real customer operations.

- **2026-05-31** **Webhook idempotency model: claim-then-rollback.**
  `StripeEvent` table (PR #78) is the dedup log; the Stripe event ID is
  the primary key. First step of every webhook handler: insert the
  StripeEvent row (catches concurrent retries atomically via P2002).
  If the handler then throws, the StripeEvent row is **deleted** (best-
  effort) so Stripe's next retry can re-claim and re-run. PR #87 fixed
  the original bug where the claim committed but the work didn't,
  causing retries to be silently deduped.

- **2026-05-31** **Marketing email consent: HMAC unsubscribe token, no
  expiry.** Tokens are `userId.base64url(HMAC-SHA256(userId, SECRET))`.
  PECR/GDPR require unsubscribe links to remain valid for the lifetime
  of the email, so tokens never expire. Rotating
  `UNSUBSCRIBE_TOKEN_SECRET` invalidates every previously-sent link —
  only rotate on compromise. The endpoint accepts GET and POST so email
  clients pre-fetching links don't break the flow (the HMAC IS the
  auth). Deleted accounts: `updateMany` is a no-op, never leaks
  whether an account exists.

- **2026-05-31** **Resend Inbound unavailable on current Resend
  account.** Access request sent to Resend support. Until granted, the
  `/admin/support` queue is fed manually via the `Add test email` form
  (server action that creates a `SupportEmail` row + triggers AI
  categorisation). PR 2c (the inbound webhook endpoint) is held until
  access lands; when it lands, the test form is removed.

- **2026-05-31** **mindreset.ai connected to Vercel.** DNS for the apex
  switched from Namecheap parking page to Vercel's IP (216.198.79.1).
  Email MX records (Resend inbound + send subdomain) untouched —
  separate DNS record type, no interaction with web routing.

- **2026-05-31** **Resend From-address policy for support replies.**
  `lib/email/sendSupportReply.ts` reads `RESEND_FROM_SUPPORT_EMAIL`
  first, falls back to `RESEND_FROM_EMAIL` (`hello@mindreset.ai`).
  Replies currently go from `hello@`; flip the env var to
  `MindReset Support <support@mindreset.ai>` once that mailbox is
  verified in Resend. No code change needed at that point.

- **2026-05-31** **Per-marketing-send unsubscribe via RFC 8058
  headers.** Each `lib/email/sendMarketing.ts` call sets
  `List-Unsubscribe: <…token URL…>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Gmail / Apple
  Mail / Outlook surface a native "Unsubscribe" button at the top of
  the message in addition to the footer link. Required for inbox
  placement at higher send volumes anyway.

- **2026-07-20** **Onboarding v2 — typed routing (owner-approved with
  two routing corrections).** Onboarding exists to sort out the user's
  TYPE and refer them correctly. Step 3 ("What kind of work are you
  looking for?") decides the type; Steps 1–2 decide which product of
  that type; Step 4 (style) affects voice only. Types: Transformation →
  «Путь к себе» primary from ANY topic, always via the informed-choice
  page, never checkout; the module slot goes to the matching State if
  Step 1 names one, else the matching Theme — never both; MiniMind rides
  as companion. Relief + named state → that State primary. Focused +
  named theme → that Theme primary. Talk/not-sure and all fallbacks →
  Companion shape: MiniMind primary + matching State and/or Theme; a
  soft «Путь к себе» card only when a soft signal exists (repeating
  story / several areas / whole-life-identity) AND fewer than two
  modules matched — it never displaces a directly matching module.
  Dashboard: one Primary + up to two Other options (max 3 cards),
  full catalogue below, nothing restricts access, owned products show
  "You already have access — continue here". Hard prohibitions:
  onboarding is not diagnosis (no trauma/parts/diagnosis inference from
  buttons); love/relationships never → Family; strong reactions never →
  Anxiety; Shame & Guilt only via the explicit self-worth/shame area.
  Legacy v1 answers translate honestly at read time; unmappable ones
  are dropped, and legacy goal answers read as talk_through — the
  Journey is never inferred for someone who was never asked the depth
  question. Supersedes the v1 scoring engine (PR #335's mapping tables).
