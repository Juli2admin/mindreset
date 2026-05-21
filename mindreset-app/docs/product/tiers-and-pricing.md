# Tiers and pricing

All tiers locked as of 21 May 2026 (spec v2). Source of truth:
`docs/implementation/block-b-stripe-plan.md`.

## Full product table

| Product | Price | Type | What you get |
|---|---|---|---|
| **Free taster** | £0 (no card) | Lifetime, one per email | 50 messages with MiniMind |
| **MiniMind Essential** | £14.99/month *or* £129/year | Subscription | 200 messages per billing cycle |
| **MiniMind Extended** | £24.99/month *or* £209/year | Subscription | 800–1,200 messages per billing cycle |
| **Message top-up** | £4.99 | One-off | +200 messages to current cycle, expires at reset |
| **States & Themes module** | £59 (non-subscriber) *or* £29 (subscriber) | One-off | Permanent access to one module |
| **The Journey** | £599 *or* 12 × £55/week | One-off / installment plan | Full 8-block programme |

### DROPPED: States & Themes All Access

The £29/month all-access S&T subscription has been removed from the
product structure. It does not exist in Stripe and should not appear
anywhere in copy or code.

### Annual savings

- Essential annual: £129/yr vs £14.99 × 12 = £179.88 → ~28% saved
- Extended annual: £209/yr vs £24.99 × 12 = £299.88 → ~30% saved

Annual savings shown on `/account`. No urgency language, no countdown.

---

## Free taster rules

- **50 messages total**, lifetime per email (changed from 20 in spec v1)
- **No card required** at signup
- **No time limit** — spend them at any pace
- **Counter starts at first MiniMind message sent**, not at signup
- **Single-use per email** — Clerk primary-email match (case-insensitive)
- At message 50: inline banner "You have reached the free taster limit.
  Subscribe to continue your work with MiniMind."

---

## At-cap UX

When a user hits their limit:

- Chat input becomes disabled with non-alarming placeholder text
- Inline banner shows the reset date and offers top-up or upgrade
- **History remains visible and scrollable**
- No modal popup — banner only

Thresholds:
- Free taster at **50** lifetime messages
- Essential at **200** cycle messages
- Extended at **800** (gentle "approaching limit" notice) and **1,200**
  (hard cap, top-up CTA)

---

## Top-up rules

- £4.99 one-off — adds 200 messages to current cycle
- Expires at cycle reset — does not roll over
- Available to Essential and Extended subscribers only (not free taster)
- Stackable (multiple per cycle allowed)
- Non-refundable once purchased (digital content waiver at checkout)

---

## States & Themes subscriber discount

- Non-subscribers: **£59 per module**
- Active MiniMind subscribers (Essential or Extended): **£29 per module**
- Discount applied automatically at Stripe checkout based on subscription
  status
- If user later cancels MiniMind subscription, permanently purchased
  modules remain accessible — no clawback

---

## The Journey

- Available to everyone regardless of MiniMind subscription status
- **One-off £599:** non-refundable once first block accessed. 14-day
  refund window if first block never opened.
- **Installment 12 × £55/week:** each payment unlocks next block. User
  can stop future payments at any time. No refund on paid weeks. Not a
  subscription — a payment plan.

---

## Refund policy matrix

| Product | Refund window | Condition | After window |
|---|---|---|---|
| Free taster | N/A | N/A | N/A |
| Essential / Extended | 7 days from initial purchase | Fewer than 30 messages used | No refund; cancel anytime, access until cycle end |
| Message top-up | None | Digital content waiver at checkout | Non-refundable |
| S&T module (any price) | 14 days from purchase | Module never opened | Non-refundable once opened |
| The Journey one-off | 14 days from purchase | First block never accessed | Non-refundable once accessed |
| The Journey installment | Per-payment | No refund on paid weeks | Can stop future payments |

Refund requests: email `support@mindreset.ai` with "REFUND" in subject.

---

## Cancellation

- Cancel anytime via Stripe Customer Portal (PR 4)
- Access continues to end of current billing cycle
- No partial-cycle refunds after the 7-day window
- Downgrade Extended → Essential takes effect at next cycle boundary
  (Stripe scheduled change — not immediate)

---

## Existing-user handling (PR #23 migration)

No grandfathering. All existing DB users reset to:

- `currentTier = 'free'`
- `lifetimeMessagesUsed = 0`
- `stripeCustomerId = null`
- `stripeSubscriptionId = null`

Test users (including Julia) start the 50-message taster from zero.

---

## Where prices live in code

| Location | What it holds |
|---|---|
| `messages/en.json` Account.tiers | Display strings + price templates |
| `messages/ru.json` Account.tiers | RU mirror (native quality) |
| `lib/billing/limits.ts` | Tier caps (50 / 200 / 800 / 1,200 / +200 top-up) |
| `lib/stripe/products.ts` | Stripe Price ID map (env-gated test vs live) |
| `app/[locale]/account/AccountClient.tsx` | TIERS array (numeric values for `formatCurrency()`) |

Drift between code caps and Stripe dashboard prices is a launch risk —
confirm alignment at PR 2 review.
