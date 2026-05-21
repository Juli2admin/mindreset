# Tiers and pricing

All MiniMind tiers locked as of 21 May 2026. States & Themes and The
Journey are **Block C** (post-launch) and are not in scope here.

## The four MiniMind product surfaces

| Product | Price | Type | What you get |
|---|---|---|---|
| **Free taster** | £0 (no card) | One-time, lifetime | 20 messages with MiniMind, one shot per email |
| **MiniMind Essential** | £14.99 / month *or* £129 / year | Subscription | 200 messages per billing cycle |
| **MiniMind Extended** | £24.99 / month *or* £209 / year | Subscription | 800–1,200 messages per billing cycle (soft cap at 1,200) |
| **Message top-up** | £4.99 | One-off charge | +200 messages added to current cycle, expires at cycle reset |

### Annual savings

- Essential annual: £129/year vs. £14.99×12 = £179.88 → ~28% saved
- Extended annual: £209/year vs. £24.99×12 = £299.88 → ~30% saved

Annual savings copy is shown plainly on `/account`. No urgency language,
no countdown.

## Free taster rules

- **20 messages total**, not 20 per month. Lifetime per email.
- **No card required** at signup.
- **No time limit** — user can take as long as they want to spend the 20.
- **Counter starts at first MiniMind message sent**, not at signup.
- **Single-use per email** — enforced by Clerk primary-email match
  (case-insensitive). Same email cannot get a fresh taster by
  cancel+re-signup.
- **At message 20**, chat input becomes disabled with an inline banner
  offering subscription or top-up.

## At-cap UX (soft cap)

When a user hits their cycle limit:

- Chat input becomes disabled with non-alarming placeholder text
- Inline banner shows the reset date and offers a top-up (£4.99 for
  +200) or upgrade
- **Conversation history remains visible and scrollable**
- No modal popup — banner only

This applies to:

- Essential at 200 messages
- Extended at 1,200 messages (with a gentle "approaching limit" notice
  at 800)
- Free taster at 20 messages

## Top-up rules

- **£4.99 one-off charge** — adds 200 messages to the current cycle
- **Expires at cycle reset** — does not roll over
- **Available to all paid tiers** (Essential and Extended)
- **Stackable** — a user can buy multiple top-ups in one cycle
- **Non-refundable once purchased** — digital content delivered for
  immediate use; 14-day cancellation right waived at checkout per
  Consumer Contracts Regulations 2013

## Refund policy

| Product | Refund window |
|---|---|
| Essential or Extended subscription (monthly or annual) | 7 days from initial purchase |
| Message top-up | Non-refundable |
| Future S&T modules (Block C) | 14 days from purchase (planned) |
| Future Journey (Block C) | 30 days, only if <25% engaged (planned) |

A refunded subscription is cancelled immediately. `miniMindActive` →
false, `miniMindPeriodEnd` → refund timestamp.

Refund requests are handled manually via
`support@mindreset.ai` with "REFUND" in the subject. No self-serve
refund flow at launch.

## Cancellation

- Cancel anytime via Stripe Customer Portal (Block B PR 4)
- Access continues to the end of the current billing cycle
- No partial-cycle refunds after the 7-day window
- Downgrade Extended → Essential takes effect at next cycle boundary
  (handled natively by Stripe Customer Portal)

## Mid-cycle upgrade

- Upgrade Essential → Extended: Stripe prorates the bill automatically.
  Message counter persists (just gets a higher cap).
- Decision recorded but NOT yet implemented in code — see
  `../decisions/open-questions.md`.

## Existing-user handling (Block B PR 1 migration)

**No grandfathering.** All existing users in the DB get reset to:

- `currentTier = 'free'`
- `lifetimeMessagesUsed = 0`
- `stripeCustomerId = null`
- `stripeSubscriptionId = null`

Test users (including Julia's own account) start the 20-message taster
from zero at PR 1 deploy time.

## What's NOT in scope for Block B

- States & Themes module purchases (£59 one-off or £29/mo all-access)
- States & Themes All Access subscription
- The Journey (£599 one-off or 12×£55/week instalment)
- Referral programme with user-specific codes
- Multi-currency support (GBP only at launch)
- Russian-market pricing (deferred to month 6)
- Annual → monthly downgrade flow (use Customer Portal cancel +
  re-subscribe)
- Pause subscription feature
- Stripe-native Annual price IDs that auto-renew — annual sub will
  charge once a year via Stripe's standard interval

## Where the prices live in code

- `mindreset-app/app/[locale]/account/AccountClient.tsx` — TIERS array
  (numeric values feed `formatCurrency()`)
- `mindreset-app/messages/en.json` Account.tiers — display strings
- `mindreset-app/messages/ru.json` Account.tiers — RU mirror
- Future: `mindreset-app/lib/billing/limits.ts` — caps and cycle math
  (Block B PR 1)
- Future: `mindreset-app/lib/stripe/products.ts` — Stripe Price ID map
  (Block B PR 1, env-gated test vs live)

## What's in Stripe vs what's in code

- **Stripe dashboard** holds the canonical Price objects (£14.99, £129,
  £24.99, £209, £4.99). Julia creates these manually in the dashboard,
  paste IDs into env vars.
- **Code** holds the numeric values for display (formatCurrency) and
  the caps (50, 200, 800, 1200). These are kept in sync manually with
  the Stripe dashboard.
- Drift between code and Stripe is a launch risk — confirm at PR 2
  review.
