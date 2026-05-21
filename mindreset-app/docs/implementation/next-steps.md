# Next steps

Tactical sequence for Block B. Last updated 21 May 2026 (v2 spec).

## Immediate — both PRs on hold

Both open PRs are on hold pending spec v2 updates:

**PR #22** (`claude/review-project-structure-3uVtO`) — on hold.
Blockers:
- Julia to provide RU translation of ~28 new EN strings
- S&T subscriber discount copy (£29 vs £59) not yet in messages/en.json
- Architect review of final RU strings before merge

**PR #23** (`claude/block-b-pr1-schema-stripe`) — on hold.
Blockers:
- `lib/billing/limits.ts`: change `TIER_CAPS.free.lifetime` **20 → 50**
- `.env.example`: add 4 new price ID env vars
- Align env var: `STRIPE_PRICE_TOPUP` (canonical) vs `STRIPE_PRICE_TOP_UP`
  (current code)
- Julia runs SQL migration in Supabase after merge

---

## Block B sequence

| Step | What | Status | Blockers |
|---|---|---|---|
| **PR #22** | Pricing copy + T&C | On hold | RU translation + S&T copy |
| **PR #23** | Schema + Stripe client + billing limits | On hold | 20→50 fix + env vars + SQL |
| **PR 2** | Checkout flow (all product types) | Not started | 9 Stripe Price IDs in env |
| **PR 3** | Webhook + state sync | Not started | Webhook URL in Stripe dashboard |
| **PR 4** | Customer Portal + at-cap UI | Not started | Portal enabled in Stripe |
| **PR 5** | Message counter integration | Not started | PR 3 must be live |
| **PR 6** | Top-up purchase flow | Not started | PR 3 webhook handles it |

Each PR is independently shippable — app stays in a working state between
steps.

---

## PR #22 outstanding copy work

These strings need adding to `messages/en.json` (and RU mirror) before
PR #22 can merge. They are NOT currently in the branch:

1. **S&T subscriber discount UI copy** — e.g. "£29 for subscribers /
   £59 standard" on the `/account` tier card and checkout page
2. Any new top-up strings (if the existing `topUp.description` covers it,
   just confirm)

T&C text in `terms/page.tsx` also needs a review for the S&T subscriber
discount refund policy (14-day window if module never opened). The
current Section 8 S&T text uses the old single-price model.

---

## PR #23 outstanding code fixes

Three concrete changes needed on `claude/block-b-pr1-schema-stripe`:

1. `lib/billing/limits.ts` — `TIER_CAPS.free.lifetime: 20` → `50`
2. `.env.example` — add these four env vars:
   ```
   STRIPE_PRICE_ST_MODULE_FULL=price_...
   STRIPE_PRICE_ST_MODULE_SUBSCRIBER=price_...
   STRIPE_PRICE_JOURNEY_ONETIME=price_...
   STRIPE_PRICE_JOURNEY_INSTALLMENT=price_...
   ```
3. `lib/stripe/products.ts` — add entries for the 4 new price IDs above;
   rename `topUp` key to match canonical `STRIPE_PRICE_TOPUP`

---

## Julia's manual steps (before PR 2 can be tested)

1. Run ALTER TABLE SQL in Supabase (from PR #23 body — use the
   `IF NOT EXISTS` version)
2. Run existing-user reset UPDATE
3. Create 9 Stripe products/prices in TEST MODE (see
   `docs/implementation/block-b-stripe-plan.md`)
4. Paste 9 `price_xxx` IDs into `.env.local` + Vercel env vars
5. Confirm Stripe Tax is OFF
6. Confirm billing restricted to GB

---

## Pre-launch (parallel work — independent of Block B)

1. **Welcome email sequence** (Resend) — launch-critical
2. **AI support email Pattern A** — launch-critical; spec not yet defined
3. **`User.screeningResult` populate** — cookie linkage doesn't write
   the field; see `docs/carry-forward.md`
4. **Clerk production instance setup** — currently dev keys
5. **Auth-page i18n** — sign-in / sign-up / terms / privacy EN-only
6. **`/account` language toggle** — currently Footer-only
7. **RU phrases in safety scanner** — Phase 3c keyword scanner is EN-only
8. **Pre-launch native translation pass** — `translate-missing.mjs`
9. **T&C duplication** — pre-existing bug; investigate before launch

---

## Block C — post-launch

States & Themes and The Journey content delivery:
- S&T block-by-block delivery + AI gating
- Journey 8-block progression + time gates per block
- No prompts yet — 9 module prompts + 8 Journey prompts to design
- No UI — module-player and Journey-player not built

Block B billing infrastructure (checkout, webhook, Purchase rows) is
reused in Block C with new product types.

---

## Block F — Julia's external steps

- UK Limited company registration
- ICO data-controller registration
- Solicitor review of T&Cs and Privacy
- Domain DNS final setup
- Designer pass on Landing / Account
- Stripe Tax UK confirm OFF status

---

## Suggested fast-ship order (once PRs unblocked)

1. RU translation (Julia) + S&T copy → unblock PR #22
2. Limit fix + env vars → PR #23 → Julia runs SQL → merge both
3. Julia creates 9 Stripe Prices → PR 2
4. PR 3 (hardest — careful review)
5. PR 4 + PR 5 combined
6. Welcome email + AI support email (1–2 sessions)
7. `User.screeningResult` fix
8. RU pre-launch translation pass
9. Soft launch
10. Auth-page i18n + remaining polish
