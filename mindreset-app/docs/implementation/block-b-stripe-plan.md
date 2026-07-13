# Block B — Stripe billing for MiniMind

**Specification version:** v2  
**Date locked:** 2026-05-21  
**Supersedes:** v1 and all prior pricing assumptions  
**Architect signoff:** Julia Loya  

Key changes from v1: free taster 20 → 50 messages; S&T All Access
subscription dropped entirely; S&T subscriber discount model added (£29
vs £59); Journey installment no-cancellation clarified; 5 product
questions confirmed by Julia.

---

## Sequencing context

Stripe billing proceeds in English first. Locale-aware Stripe checkout
is added later when i18n.1 routing lands.

**Block B** = MiniMind subscriptions + top-up + S&T modules + Journey
purchase flows.  
**Block C** (future) = S&T module content delivery + Journey block-gating
logic.

---

## Product structure

### User journey

1. User signs up → 50 free MiniMind messages (free taster). No S&T or
   Journey access without purchasing.
2. After taster, user chooses one or more of three independent purchase
   paths. No path requires another — a user can buy The Journey directly
   from the free taster without ever subscribing to MiniMind.
3. S&T and Journey are gated by AI assistant — content delivered block
   by block. This is Block C content-delivery logic, not Block B billing.

### Products table (locked)

| Product | Price | Who can buy | Billing type |
|---|---|---|---|
| Free taster | £0 | Everyone (new accounts) | None |
| MiniMind Essential | £14.99/month or £129/year | Everyone | Recurring subscription |
| MiniMind Extended | £24.99/month or £209/year | Everyone | Recurring subscription |
| Message top-up | £4.99 / 200 messages | Active subscribers only | One-off charge |
| States & Themes module | £59 per module | Non-subscribers | One-off charge |
| States & Themes module | £29 per module | Active MiniMind subscribers | One-off charge (subscriber discount) |
| The Journey | £599 | Everyone | One-off charge |
| The Journey | 12 × £55/week | Everyone | Installment plan |

### DROPPED from v1

**States & Themes All Access £29/month standalone subscription — REMOVED
ENTIRELY.** This product no longer exists. Do not create it in Stripe.

---

## Tier definitions

### Free taster
- **50 messages lifetime** (changed from 20 in v1)
- No card required
- No time limit
- One per email address (Clerk primary-email match, case-insensitive)
- At message 50: "You have reached the free taster limit. Subscribe to
  continue your work with MiniMind."

### MiniMind Essential — £14.99/month or £129/year
- 200 messages per billing cycle
- At 200: show top-up CTA or wait message with next reset date
- Annual = same monthly allowance (200/month), billed £129 upfront

### MiniMind Extended — £24.99/month or £209/year
- 800–1,200 messages per billing cycle, soft-capped at 1,200
- At 800: gentle notice "You are approaching your monthly limit"
- At 1,200: show top-up CTA or wait message
- NEVER use the word "Unlimited"

### Message top-up — £4.99
- One-off charge, not subscription
- Adds 200 messages to current billing cycle
- Expires at cycle reset — does not carry over
- Stackable (can buy multiple per cycle)
- Available to Essential and Extended subscribers only
- Non-refundable (digital content waiver at checkout)

### States & Themes module — £59 (non-subscriber) / £29 (subscriber)
- One-off purchase per module
- Permanent access to that module once purchased
- Subscriber discount (£29) applies automatically at checkout when user
  has active Essential or Extended subscription
- If user cancels MiniMind subscription, they keep permanently purchased
  modules
- Non-refundable once module opened
- If not opened within 14 days of purchase, full refund available on
  request

### The Journey — £599 one-off or 12 × £55/week
- Available to everyone regardless of MiniMind subscription status
- Price identical whether or not user has active MiniMind subscription
- Content gated block by block — user cannot see all 8 blocks at once
  (Block C logic)
- **One-off £599:** non-refundable once first block accessed. 14-day
  refund window if never accessed.
- **Installment 12 × £55/week:** each weekly payment unlocks next block.
  User can stop future payments at any time. No refund on payments
  already made. No cooling-off right once first block accessed.
- Installment plan is NOT a subscription — it is a payment plan.
  Stopping future payments ends further content unlocking but does not
  trigger refunds.

---

## Promo codes

Handled natively by Stripe built-in Coupons + Promotion Codes. No
separate database table needed.

- Discount shape: 50% off first month only (`duration: 'once'`)
- UI: quiet "Have a code?" link below CTA at checkout. No banners or
  popups.
- Referral programme (credit-based, not cash) deferred to post-100-users
  phase.

---

## Refund policy matrix (locked)

| Product | Refund window | Condition | After window |
|---|---|---|---|
| Free taster | N/A | N/A | N/A |
| Essential / Extended (monthly or annual) | 7 days from initial purchase | Fewer than 30 messages used | No refund. Cancel anytime, access until cycle end |
| Message top-up | None | Digital content waiver at checkout | Non-refundable |
| S&T module (any price) | 14 days from purchase | Module never opened | Non-refundable once opened |
| The Journey one-off | 14 days from purchase | First block never accessed | Non-refundable once first block accessed |
| The Journey installment | Per-payment | No refund on paid weeks | Can stop future payments, no recovery of past payments |

Refund request process: email `support@mindreset.ai` with "REFUND" in
subject line.

---

## Brand language (CRITICAL — Stripe compliance)

All Stripe product names, descriptions, metadata, checkout copy, and
email receipts must use approved language only.

**Approved:** self-help, self-guided reflection, emotional wellbeing,
personal growth, trauma-informed self-development, daily companion,
companion for reflection.

**Forbidden (Stripe deplatforms for these):** therapy / therapeutic,
treatment, medical, mental illness, diagnosis, counseling / counselling,
clinical intervention.

---

## Schema changes (PR #23 — on hold pending limit fix)

### 7 new User columns

| Column | Type | Default | Purpose |
|---|---|---|---|
| `stripeCustomerId` | `String? @unique` | null | Stripe Customer ID |
| `stripeSubscriptionId` | `String? @unique` | null | Active subscription ID |
| `currentTier` | `String?` | null | `'free' \| 'essential' \| 'extended' \| null` |
| `messagesUsedThisCycle` | `Int` | `0` | Cycle message counter |
| `cycleResetAt` | `DateTime?` | null | Next counter reset timestamp |
| `topUpMessagesRemaining` | `Int` | `0` | Top-up balance (consumed before cycle counter) |
| `lifetimeMessagesUsed` | `Int` | `0` | Gates free taster (cap = **50**) |

### SQL to run in Supabase (updated — use IF NOT EXISTS)

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT UNIQUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT UNIQUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currentTier" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "messagesUsedThisCycle" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cycleResetAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "topUpMessagesRemaining" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lifetimeMessagesUsed" INTEGER NOT NULL DEFAULT 0;
```

Run in Supabase SQL editor before merging PR #23.

### Existing-user reset (also needed)

```sql
UPDATE "User" SET
  "currentTier"            = 'free',
  "messagesUsedThisCycle"  = 0,
  "topUpMessagesRemaining" = 0,
  "lifetimeMessagesUsed"   = 0;
```

### Code fix outstanding before PR #23 merges

In `lib/billing/limits.ts`:
- `TIER_CAPS.free.lifetime`: **change 20 → 50**

---

## Stripe environment variables

```
STRIPE_SECRET_KEY=sk_test_...           # or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   # or pk_live_...

# Price IDs — create in Stripe dashboard, paste here
STRIPE_PRICE_ESSENTIAL_MONTHLY=price_...
STRIPE_PRICE_ESSENTIAL_ANNUAL=price_...
STRIPE_PRICE_EXTENDED_MONTHLY=price_...
STRIPE_PRICE_EXTENDED_ANNUAL=price_...
STRIPE_PRICE_TOPUP=price_...
# S&T modules — one product per module, £59. Subscribers get
# STRIPE_COUPON_MODULE (£30 off) applied programmatically at checkout.
# Env-var slugs mirror Stripe product names (LOW_ENERGY = apathy,
# COME_BACK = loss_of_self, EMPTY = inner_emptiness).
STRIPE_PRICE_STATE_ANXIETY=price_...
STRIPE_PRICE_STATE_LOW_ENERGY=price_...      # code slug: apathy
STRIPE_PRICE_STATE_COME_BACK=price_...       # code slug: loss_of_self
STRIPE_PRICE_STATE_EMPTY=price_...           # code slug: inner_emptiness
STRIPE_COUPON_MODULE=<coupon_id>             # £30 off, shared across states
STRIPE_PRICE_JOURNEY_FULL=price_...          # £599 (see PR ρ — renamed from JOURNEY_ONETIME)
STRIPE_PRICE_JOURNEY_INSTALLMENT=price_...   # £55/month × 12
```

> **Historical note.** An earlier draft of this spec proposed two shared
> prices (`STRIPE_PRICE_ST_MODULE_FULL`/`_SUBSCRIBER`). The final
> production architecture is per-module prices + one shared coupon —
> matching the Themes / Journey pattern already in Vercel.

Note: PR #23 used `STRIPE_PRICE_TOP_UP` (underscore before UP). The
canonical name per this spec is `STRIPE_PRICE_TOPUP`. Align before PR 2
wires the checkout endpoint.

---

## PR sequence (v2)

### PR #22 — Pricing copy and T&C updates

**Status: on hold.**

Blockers before merge:
- Julia to provide RU translation of new EN strings (~28 sentences)
- S&T subscriber discount copy (£29 vs £59) not yet in messages/en.json
- Architect review of final RU strings

### PR #23 — Schema + Stripe client + billing limits

**Status: on hold.**

Blockers before merge:
- `lib/billing/limits.ts`: change `TIER_CAPS.free.lifetime` **20 → 50**
- `.env.example`: add the per-module state price env vars
  (STATE_ANXIETY, STATE_LOW_ENERGY, STATE_COME_BACK, STATE_EMPTY),
  STRIPE_COUPON_MODULE, and JOURNEY_FULL / JOURNEY_INSTALLMENT
- Align env var name: `STRIPE_PRICE_TOPUP` (canonical) vs
  `STRIPE_PRICE_TOP_UP` (current code)
- Julia runs SQL migration in Supabase after merge

### PR 2 — Checkout flow

POST `/api/stripe/checkout` handles all purchase types via body
discriminator:
- Essential/Extended subscription (monthly or annual)
- S&T module (detects subscriber status → £29 or £59 price ID)
- Journey one-off £599
- Journey installment (Stripe payment plan / subscription schedule)
- Top-up one-off

Features:
- Creates Stripe Customer if `user.stripeCustomerId` is null
- Billing address collection required (no country restriction — see
  locked decision #44)
- Stripe-native promo code field at checkout
- Digital content waiver checkbox for: top-up, S&T modules, Journey

Pages: `/account/checkout/success`, `/account/checkout/cancel`.

**Blocker:** Julia creates 9 Stripe price objects in test mode, pastes
IDs into Vercel env vars.

### PR 3 — Webhook + state sync

Events handled:

| Event | Action |
|---|---|
| `checkout.session.completed` | Insert Purchase row; set `stripeCustomerId`, `stripeSubscriptionId`, `currentTier`, `miniMindActive`, `cycleResetAt`, `miniMindUntil` |
| `customer.subscription.updated` | Update `currentTier`, `miniMindUntil`, `cycleResetAt` |
| `customer.subscription.deleted` | `miniMindActive = false` at period end |
| `invoice.payment_succeeded` | Reset `messagesUsedThisCycle` to 0; update `cycleResetAt` |
| `invoice.payment_failed` | Flag payment failure — downgrade path TBD |
| `charge.refunded` | Cancel sub; flip `miniMindActive` |
| `payment_intent.succeeded` (Journey installment) | Unlock next block flag (Block C reads this) |

Idempotency via `stripeEventId` column on `Purchase` — dedupes on
webhook retry.

**Blocker:** webhook URL configured in Stripe dashboard (production
only). Local dev uses `stripe listen --forward-to
localhost:3000/api/webhooks/stripe`.

### PR 4 — Customer Portal

- `POST /api/stripe/portal` → returns portal URL
- "Manage subscription" button in AccountClient
- Portal handles: cancel, update card, invoices, upgrade/downgrade,
  switch interval

### PR 5 — Message counter integration

Updates `/api/minimind/chat/route.ts`:
- Check `lifetimeMessagesUsed` (free taster, cap = **50**)
- Check `topUpMessagesRemaining` (consumed first)
- Check `messagesUsedThisCycle` (paid tier cap)
- Soft-cap warnings at correct thresholds (800 for Extended)
- Return 402 with next reset date when caps hit
- Frontend handles 402 with top-up CTA or wait message

### PR 6 — Top-up purchase flow

Separate endpoint or body discriminator in PR 2 checkout.
- Digital content waiver at checkout
- Webhook increments `topUpMessagesRemaining` by 200

---

## Julia's Stripe dashboard setup (before PR 2 testing)

In TEST MODE, create 9 products and prices:

1. MiniMind Essential — recurring £14.99/month
2. MiniMind Essential Annual — recurring £129/year
3. MiniMind Extended — recurring £24.99/month
4. MiniMind Extended Annual — recurring £209/year
5. Message Top-up — one-off £4.99
6. States & Themes Module — Full Price — one-off £59
7. States & Themes Module — Subscriber Price — one-off £29
8. The Journey — One-off — £599
9. The Journey — Installment — recurring £55/week (12 weeks)

Copy each `price_xxx` ID into Vercel env vars. Then confirm Stripe Tax
is OFF. No country restriction at Checkout (see locked decision #44).

---

## Out of scope for Block B

- S&T content delivery and block gating (Block C)
- Journey 8-block progression logic and time gates (Block C)
- Locale-aware Stripe checkout (waits for i18n.1 routing)
- Multi-currency (GBP only at v1)
- Russian-market pricing (deferred to month 6)
- Referral programme with user-specific codes (post-100-users)
- Annual → monthly mid-cycle downgrade (Customer Portal)
- Pause subscription feature
- VAT registration and Stripe Tax automation
- UK cookie consent banner

---

## Five product decisions — confirmed by Julia (2026-05-21)

1. **Counter reset timing:** Stripe anniversary via
   `invoice.payment_succeeded` webhook. Not midnight UTC.
2. **Mid-cycle upgrade (Essential → Extended):** Counter persists. 150
   used → stays at 150, cap raises from 200 to 1,200.
3. **Mid-cycle downgrade (Extended → Essential):** Takes effect at next
   cycle boundary via Stripe Customer Portal scheduled change.
4. **Webhook environment:** Production only. Stripe CLI for local dev.
5. **VAT handling:** Stripe Tax OFF. Tax line hidden entirely.
