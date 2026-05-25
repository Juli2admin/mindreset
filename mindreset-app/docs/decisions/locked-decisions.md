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

## Communication and email (2026-05-25)

39. **Support@ inbound = Option A (Resend Inbound + Pattern A).**
    Full webhook → AI categoriser → SupportTicket table → admin draft
    queue. Post-launch build (Block D). At launch, `support@` is a
    dead `mailto:` link until Pattern A ships and DNS connects.
    **Locked 2026-05-25.**
40. **Marketing emails at launch = transactional only.** No
    re-engagement, milestone, or win-back emails before launch. PECR
    opt-in/unsubscribe tokens not built. Revisit post-launch once user
    behaviour is understood.
    **Locked 2026-05-25.**
41. **FAQ page exists at `/faq` (PR #34) and the welcome email link
    to it is correct — keep it.** An earlier agent session incorrectly
    proposed removing the FAQ link from the welcome email on the
    assumption the page didn't exist. It does. The welcome email
    template is correct as-is.
    **Locked 2026-05-25.**
42. **Stripe sends successful-payment receipts automatically.**
    Confirmed in Stripe Dashboard. No app-side receipt template needed
    for subscription confirmation or top-up. Stripe's PDF receipt
    covers the legal obligation.
    **Locked 2026-05-25.**

## Workflow (2026-05-25)

43. **Subagent workflow: product-gate → architecture-guardian →
    code-reviewer.** Auto-invoke `product-gate` before any new feature
    proposal; `architecture-guardian` after approval before writing
    code; `code-reviewer` after writing code before showing diff to
    Julia. Agents live in `.claude/agents/` and load at session start.
    **Locked 2026-05-25.**
