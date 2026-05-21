# Block B — Stripe billing for MiniMind

The full active plan. Supersedes any prior "Plus/Premium" pricing
discussion. Decisions locked as of 21 May 2026.

## Product structure

### Subscription products

| Product | Price | Billing | Message allowance |
|---|---|---|---|
| Free taster | £0 (no card) | One-time signup | 20 messages lifetime |
| MiniMind Essential | £14.99/month | Recurring monthly | 200 / cycle |
| MiniMind Essential Annual | £129/year | Recurring annual | 200 / cycle (2,400/yr functionally) |
| MiniMind Extended | £24.99/month | Recurring monthly | 800–1,200 / cycle (soft cap at 1,200) |
| MiniMind Extended Annual | £209/year | Recurring annual | 800–1,200 / cycle |

### One-off products

| Product | Price | What it does |
|---|---|---|
| Message top-up | £4.99 | +200 messages to current cycle, expires at cycle reset |

### NOT in Block B (deferred to Block C, post-launch)

- States & Themes module purchases (£59 one-off, per module)
- States & Themes All Access (£29/month)
- The Journey (£599 one-off OR 12 × £55/week instalment)

## All locked decisions

Captured in chronological order at
`../decisions/locked-decisions.md`. Highlights:

1. **UK-only at launch** — Stripe Checkout restricts billing to GB.
   Stripe Tax stays OFF (Julia is not VAT-registered).
2. **No grandfathering** — existing users reset to Free taster.
3. **PR 0 is copy-only** — restructure Account UI + T&Cs, no Stripe
   API. (Shipped — commit `fd17934b`.)
4. **Brand language audit scope** — Stripe surfaces only. In-app keeps
   "trauma-informed".
5. **Free taster start** — counter ticks from first MiniMind message
   sent.
6. **Single-use enforcement** — Clerk primary email match,
   case-insensitive.
7. **At-cap UX** — disabled input + inline banner with reset date +
   top-up button. No modal. History visible.
8. **Stripe account ready** — test + live keys obtainable.
9. **Free tier label** — "Free taster" on UI.
10. **Tier differentiator** — only message allowance differs (no
    feature flags between Essential and Extended for v1).
11. **T&Cs refund clause** — included in PR 0 (shipped). 7-day window.
12. **PR 0 file scope** — messages bundles + Landing + T&Cs +
    AccountClient.tsx restructure.
13. **Stripe naming** — plain functional names matching the app
    (`MiniMind Essential`, `MiniMind Extended`, `MiniMind Message
    Top-up`, plus Annual variants).
14. **EN tier copy** — Essential description drops the explicit
    "trauma-informed companion" framing; uses "A daily companion for
    self-guided reflection." RU mirrors EN.

## Schema changes (PR 1)

Manual SQL Julia runs in Supabase SQL editor:

```sql
ALTER TABLE "User"
  ADD COLUMN "stripeCustomerId"     TEXT UNIQUE,
  ADD COLUMN "stripeSubscriptionId" TEXT UNIQUE,
  ADD COLUMN "currentTier"          TEXT,
  ADD COLUMN "messagesUsedThisCycle" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cycleResetAt"         TIMESTAMP(3),
  ADD COLUMN "topUpMessagesRemaining" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lifetimeMessagesUsed" INTEGER NOT NULL DEFAULT 0;
```

`currentTier` is one of `'free' | 'essential' | 'extended' | null`. The
old `miniMindActive` and `miniMindUntil` columns stay — they're
populated by the webhook in PR 3.

After the SQL runs, `schema.prisma` is updated to mirror these columns,
and `prisma generate` runs to refresh the client.

Existing-user reset (also in PR 1 migration):

```sql
UPDATE "User" SET
  "currentTier" = 'free',
  "messagesUsedThisCycle" = 0,
  "topUpMessagesRemaining" = 0,
  "lifetimeMessagesUsed" = 0;
```

(This is safe because all currently-registered users are test users.)

## PR sequence

### PR 0 — Pricing copy (SHIPPED)

Commit `fd17934b` on branch `claude/review-project-structure-3uVtO`.
Awaiting open-PR command from owner. See `./progress.md` for contents.

### PR 1 — Schema + Stripe client + billing limits

**Files added:**

- `lib/stripe/client.ts` — server-side Stripe SDK singleton
- `lib/stripe/products.ts` — Price ID map, env-gated test vs production
- `lib/billing/limits.ts` — tier caps (50 / 200 / 1,200 / +200 top-up),
  helpers: `hasCapacity(user)`, `availableMessages(user)`,
  `cycleHasReset(user, now)`
- `lib/billing/messageCounter.ts` — increment + decrement helpers used
  by PR 5 chat gating

**Files changed:**

- `prisma/schema.prisma` — User gains the 7 new columns above
- `.env.example` — documented Price ID env vars for all 5 Stripe
  products

**Manual steps Julia takes outside the codebase:**

1. Run the ALTER TABLE SQL above in Supabase SQL editor
2. Run the existing-user reset UPDATE
3. In Stripe dashboard (test mode first):
   - Create Product "MiniMind Essential", Price £14.99/month → copy
     `price_xxx`
   - Create Product "MiniMind Essential Annual", Price £129/year →
     copy `price_xxx`
   - Create Product "MiniMind Extended", Price £24.99/month → copy
     `price_xxx`
   - Create Product "MiniMind Extended Annual", Price £209/year →
     copy `price_xxx`
   - Create Product "MiniMind Message Top-up", Price £4.99 one-off →
     copy `price_xxx`
4. Paste all 5 IDs into `.env.local` + Vercel env vars (test + live
   separately)
5. Confirm Stripe Tax is OFF
6. Confirm Stripe Checkout is set to restrict billing-address country
   to GB only

**Verification:** Stripe API callable from the app's server runtime;
`hasCapacity()` returns expected values for the seeded users.

### PR 2 — Checkout flow

**Files added:**

- `app/api/stripe/checkout/route.ts` — POST handler
  - Body: `{ tier: "essential" | "extended"; interval: "month" | "year" }`
    OR `{ topup: true }`
  - Creates Customer if `user.stripeCustomerId` is null, saves the ID
  - Creates Checkout Session with right Price ID + customer + success/
    cancel URLs + GB billing-address restriction
  - Exposes promo-code field (Stripe native)
  - Returns Checkout URL for client redirect
- `app/[locale]/account/checkout/success/page.tsx` — landing after
  Stripe redirect
- `app/[locale]/account/checkout/cancel/page.tsx` — landing on user
  back-out

**Files changed:**

- `app/[locale]/account/AccountClient.tsx` — wire Subscribe / Top-up
  CTAs to the new endpoint (was placeholders post-PR-0)
- `messages/en.json` + `ru.json` — checkout-flow strings

**Verification:** A test purchase end-to-end in Stripe test mode lands
on success page. No DB writes yet — PR 3 owns that.

### PR 3 — Webhook + state sync + chat gating

**Files added:**

- `app/api/webhooks/stripe/route.ts` — mirror the
  `app/api/webhooks/clerk/route.ts` pattern (svix-style verification,
  but using `stripe.webhooks.constructEvent` instead of `svix.Webhook`)
- Idempotency: dedupe via `stripeEventId` (will need a column on
  `Purchase` to track this — add in this PR's migration)

**Events handled:**

| Event | Action |
|---|---|
| `checkout.session.completed` | Insert Purchase row; set `stripeSubscriptionId`, `currentTier`, `miniMindActive`, `cycleResetAt`, `miniMindUntil` |
| `customer.subscription.updated` | Update `currentTier`, `cycleResetAt`, `miniMindUntil` |
| `customer.subscription.deleted` | Flip `miniMindActive = false` at period end (not immediately — user keeps access until paid period ends) |
| `invoice.payment_succeeded` | Reset `messagesUsedThisCycle` to 0; update `cycleResetAt` |
| `invoice.payment_failed` | Flag user as `paymentFailed` (need new bool column on User?) — TBD |
| `charge.refunded` | If subscription refund: cancel sub + `miniMindActive` false |
| `payment_intent.succeeded` (top-up product) | `topUpMessagesRemaining += 200`, write Purchase row |

**Files changed:**

- `app/api/minimind/chat/route.ts` — gating: before LLM call, check
  `hasCapacity(user)`; if false return 402 with structured error +
  next reset date. On success, decrement `topUpMessagesRemaining`
  first, then `messagesUsedThisCycle`.

**Verification:** Stripe CLI fires test events end-to-end.

### PR 4 — Customer Portal + at-cap UI

**Files added:**

- `app/api/stripe/portal/route.ts` — POST returns Stripe Customer
  Portal session URL
- `components/CapReachedBanner.tsx` — inline banner shown when
  `hasCapacity()` is false (NOT a modal, per locked decision)

**Files changed:**

- `app/[locale]/account/AccountClient.tsx` — "Manage subscription"
  button for active subscribers
- MiniMind chat client component — when chat returns 402, render
  `CapReachedBanner` and disable input
- `messages/en.json` + `ru.json` — banner copy

**Verification:** Cancel via portal → webhook fires → subscription
flagged for end-of-period cancellation. Cap reached → banner appears
with date + top-up button.

### PR 5 — Message counter integration (already partially in PR 3)

If PR 3 doesn't fully cover chat gating, PR 5 fills the gaps:

- Soft-cap warning at 800 messages on Extended (gentle approach
  notice — not a hard cap, the hard cap is at 1,200)
- Lifetime cap at 20 for Free taster
- Frontend handling of 402 with structured error payload
- Idempotency of decrement (in case of partial streams)

**Verification:** Test cap behaviour with mocked counter values via
diagnostic script.

### PR 6 — Top-up purchase flow

If not already shipped in PR 2 + PR 3, PR 6 adds:

- `app/api/stripe/checkout/topup/route.ts` (or unify with checkout
  endpoint via body discriminator)
- UI surface: top-up CTA in `CapReachedBanner`
- Stackability: webhook adds 200 to whatever's already in
  `topUpMessagesRemaining`

**Verification:** End-to-end test of top-up purchase + counter
increment.

## Verification before PR 1 starts

- ✅ Stripe account exists, test + live keys ready (confirmed by
  owner)
- ⏳ Stripe Tax: OFF (to be confirmed when Julia logs in)
- ✅ Product structure approved (this document)
- ✅ PR sequence approved

## Open questions parked for in-flight resolution

Logged in `../decisions/open-questions.md`. Highlights:

- **Counter reset timing** — midnight UTC vs Stripe anniversary
  (blocks PR 5 gating logic)
- **Mid-cycle Essential → Extended upgrade** — does the counter reset
  or just raise the cap? (blocks PR 3 webhook logic; recommended
  answer: keep counter, raise cap)
- **Mid-cycle downgrade** — Stripe Customer Portal handles via
  scheduled change at next cycle boundary; confirm we use that
- **Webhook endpoint** — production only, or also a Vercel preview
  /staging endpoint? (affects PR 3 setup)
- **Receipt VAT line** — show "VAT not applicable" line, or no tax
  line at all? (affects PR 2 Checkout config)
- **Annual savings copy** — "Annual billing saves around 28%" — is
  this final, or do you want different framing?
- **Promo code rollout** — when does the first 50%-off-first-month
  code go live? Pre-launch / launch day?

## Non-goals (explicit, recorded)

- Multi-currency (GBP only)
- Russian pricing variant
- Annual → monthly downgrade UI (use Customer Portal cancel + re-sub)
- Pause subscription
- Referral programme with per-user codes
- Self-serve refund flow
- "Unlimited" tier
