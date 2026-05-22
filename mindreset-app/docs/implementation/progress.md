# Implementation progress

Snapshot of what's shipped, what's in flight, and what's next. Last
updated 22 May 2026 (after Block B PRs 0–4 merge).

> **For the next session**: read `docs/SESSION_HANDOFF.md` FIRST. It
> covers the current production-deploy issue that gates further work.

## Shipped (on `main`)

### Block A — MiniMind core (complete)

| Phase | What | PR |
|---|---|---|
| 3a | MiniMind chat API endpoint | #5 |
| 3b | Chat UI + streaming + conversation persistence | #8 |
| 3c | Safety scanner (keyword + LLM verifier + cooldown) | #9 |
| 3d | Cross-session memory + safety verifier state classification | #10 |
| 3e | MiniMind v2.3 prompt + clinical grounding to 8-block methodology | #11 |

### Legal + sign-up flow

| Phase | What | PR |
|---|---|---|
| — | Legal foundation: /terms, /privacy, footer, T&C capture, disclaimer modal | #4 |
| — | Sign-up routing, screening → signup flow, gate cleanup | #6 |
| — | Roadmap v1 added | #7 |
| — | Account page + Clerk webhook + screening cookie linkage | #2 |

### i18n (complete enough to ship — auth pages still EN-only)

| Phase | What | PR |
|---|---|---|
| i18n.0 | next-intl foundation, Footer translated EN/RU | #13 |
| i18n.0 fix | Remove Screening's legacy LangSwitch | #14 |
| i18n.1a | URL-prefixed routing + Clerk/next-intl middleware composition | #15 |
| i18n.1b | locale-aware Link sweep + minimind defence-in-depth + Accept-Language verification | #16 |
| i18n.1c | URL-aware picker (globe + dropdown) + lib/format.ts Intl helpers | #17 |
| i18n.1d.2 | Shared TopBar component + Landing.jsx unification + CrisisResources extraction | #18 |
| i18n.2a | String extraction — Landing/Screening/Account/MiniMind/Crisis/Disclaimer with full EN+RU + 6 placeholder bundles | #19 |
| i18n.2b | i18n sync tooling: sync-placeholders.mjs, check-bundle-parity.mjs, translate skeleton, pre-commit hook | #21 |

### Security

| Phase | What | PR |
|---|---|---|
| — | Codify production RLS fix in `db/rls.sql` + carry-forward entry | #20 |

### Block B — Stripe billing (PRs 0–4 merged)

| PR | Scope | Merged |
|---|---|---|
| **Block B PR 0** | Pricing copy — Free taster / Essential / Extended / Top-up; S&T/Journey "Coming soon" | `f2a0ef9` |
| **Block B PR 1** | Schema columns + Stripe client lib + billing limits (`hasCapacity`, `TIER_CAPS`) | `b0ba00d` |
| **Block B PR 2** | Stripe Checkout flow (subscribe + top-up) | `ff075e0` |
| **Block B PR 3** | Stripe webhook + active-plan badge + `getPeriodEnd()` defensive read + top-up idempotency | `29cbc4e` |
| **Block B PR 4** | Customer Portal + at-cap UI (`AtCapBanner`) + Active tier badge | `35d8338` |

## In flight

### Block B PR 5 — Message counter integration

- **Branch**: `claude/block-b-pr5-message-counter`
- **PR**: [#27](https://github.com/Juli2admin/mindreset/pull/27)
- **Status**: Open, owner-approved, **NOT merged**.
  Blocked on Vercel production deploys (see SESSION_HANDOFF.md).

Adds `consumeMessage(userId)` to `lib/billing/limits.ts` and wires
billing gate + post-stream increment into `app/api/minimind/chat/route.ts`.

### Block B PR 6 — Top-up purchase flow

Likely already covered by PR 3's webhook handler
(`checkout.session.completed` → `topUpMessagesRemaining += 200` via
idempotent `Purchase` row). **Re-scope before starting** — may be a
no-op PR.

## Known launch blockers (not in Block B)

These need attention before public launch but are out of Block B scope:

- **Vercel production deploys** — currently broken; auto-deploy on
  `main` not firing. See `SESSION_HANDOFF.md`.
- **`mindreset.ai` DNS** — domain not yet connected to Vercel.
- **`User.screeningResult` is never populated** — screening row
  linkage works, but the denormalised result field on User is left
  null. Tracked in `docs/carry-forward.md`.
- **Welcome email + AI support email Pattern A** — Resend installed
  but not wired. Both are launch-critical.
- **Clerk production instance setup** — currently dev keys. Production
  instance needs setup. Tracked in `docs/carry-forward.md`.
- **Auth-page translation** — sign-in / sign-up / terms / privacy are
  EN-only.
- **`/account` language toggle restoration** — LanguagePicker only in
  Footer.
- **RU phrases in safety scanner** — Phase 3c keyword scanner is
  EN-only.
- **Pre-launch native translation pass** for fr/de/es/it/pl/pt — use
  `translate-missing.mjs`.
- **T&C duplication in signup flow** — pre-existing on main, needs
  investigation.

## External (Block F — Julia's steps)

- UK Limited company registration
- ICO data-controller registration
- Solicitor review of T&Cs and Privacy
- Domain DNS final setup (mindreset.ai → Vercel)
- Designer pass on Landing / Account
- Stripe Tax UK confirm OFF (done — Julia confirmed not VAT-registered)

## Carry-forward themes

These have come up repeatedly across sessions and are worth keeping in
mind. Full notes in `docs/carry-forward.md`:

- `Conversation` orders by `startedAt`, not last-activity — known
- v2.3 type-to-practice categories run ahead of the named-practice
  catalog — known
- Orphan DB columns from abandoned preferredName work — to be cleaned
- DiagnosticProfile updates are async — race between update and read
  not addressed
- Tier downgrade edge case: subscriber cancels → inherits high
  `lifetimeMessagesUsed` → instantly at-cap on free fallback. Flagged
  in PR #27 audit, deferred.

## Roadmap v1 status

`docs/roadmap/MindReset_Roadmap_v1.md` dated 15 May 2026 is the
strategic document. It is significantly out of date in places
(pricing, especially) and should be refreshed once Block B ships. The
v1 numbers in the roadmap supersede nothing — `tiers-and-pricing.md`
and `decisions/locked-decisions.md` are the current sources of truth.
