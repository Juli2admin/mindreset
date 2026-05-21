# Next steps

A tactical sequence — what to do, in what order, and the gates between
each step. Last updated 21 May 2026.

## Immediate (this branch)

`claude/review-project-structure-3uVtO` — Block B PR 0 (pricing copy)
is committed at `fd17934b`, not yet opened as a PR.

**Owner action**: tell the agent to open PR for PR 0, or merge directly
from the current branch.

## Block B sequence — Stripe billing

| Step | What | Blockers |
|---|---|---|
| **PR 0** | Pricing copy revision | DONE — awaiting PR open |
| **PR 1** | Schema + Stripe lib + billing limits | Owner runs SQL + creates Stripe Price IDs |
| **PR 2** | Checkout flow | Stripe Price IDs in env vars |
| **PR 3** | Webhook + state sync + chat gating | Webhook URL configured in Stripe dashboard |
| **PR 4** | Customer Portal + at-cap UI | Customer Portal enabled in Stripe dashboard |
| **PR 5** | Message counter integration polish | PR 3 must be live |
| **PR 6** | Top-up purchase flow (if not folded into PR 2) | PR 3 webhook handles top-up event |

Each PR is independently shippable. Between PRs, the app stays in a
working state — e.g. after PR 1 the schema has new columns but no
checkout UI exists yet, after PR 2 checkout works but doesn't gate
chat, etc.

## Pre-launch (parallel work — not Block B)

These items are independent of Block B and can be worked in parallel
or after Block B ships:

1. **Welcome email sequence** (Resend) — launch-critical
2. **AI support email Pattern A** (Resend) — launch-critical
3. **`User.screeningResult` populate** — fix the cookie linkage to
   write the result into the User row
4. **Clerk production instance setup** — currently using dev keys
5. **Auth-page i18n** — sign-in / sign-up / terms / privacy still EN-only
6. **`/account` language toggle** — restore from Footer-only access
7. **RU phrases in safety scanner** — Phase 3c keyword scanner is
   EN-only
8. **Pre-launch native translation pass** — `translate-missing.mjs`
   per-locale, owner reviews
9. **T&C duplication investigation** — pre-existing bug to understand
   before launch

## Block C — post-launch

States & Themes and The Journey. Schema is partially ready
(`Purchase` table, `ModuleProgress`, `RecodeProgress`) but:

- **No prompts yet** — 9 module prompts + 8 Journey block prompts need
  designing (with Julia's clinical-voice review)
- **No UI** — module-player and Journey-player not built
- **Pricing in schema** but not in Stripe — would be added as Price
  IDs when Block C ships

Reusing Block B's infrastructure for Block C is mostly mechanical:
new Price IDs, new product types in the existing checkout endpoint,
new webhook handlers for module purchases. The hard part is the
prompts and the player UI.

## Block F — Julia's external steps

Out of agent scope but needed before launch:

- UK Limited company registration
- ICO data-controller registration
- Solicitor review of T&Cs and Privacy
- Domain DNS final setup
- Designer pass on Landing / Account
- Stripe Tax UK confirm OFF status

## Decision points the owner needs to make

Before PR 1 starts, the owner needs to lock:

- ❓ **Counter reset timing** — midnight UTC vs Stripe anniversary
- ❓ **Mid-cycle upgrade behaviour** — counter persists vs resets
- ❓ **Webhook endpoint scope** — production only vs preview/staging
  too
- ❓ **Receipt VAT line wording** — "VAT not applicable" line vs no
  tax line at all
- ❓ **Promo code rollout** — when does the first 50%-off-first-month
  code go live

Logged in `../decisions/open-questions.md` with recommendations.

## Suggested order if shipping fast

1. Open + merge PR 0 (today)
2. Lock the 5 open questions above (15 minutes)
3. PR 1 (1 session) — owner runs SQL + creates 5 Stripe Prices
4. PR 2 (1 session) — owner pastes Price IDs into Vercel env
5. PR 3 (1 session — the hardest) — careful review
6. PR 4 + PR 5 (1 session combined)
7. Welcome email + AI support email (1–2 sessions)
8. `User.screeningResult` fix (small)
9. RU pre-launch translation pass (manual review-heavy)
10. Soft launch
11. Auth-page i18n + remaining polish

Total estimate: 5–7 working sessions for Block B + critical email +
screening fix. Then launch-readiness check.
