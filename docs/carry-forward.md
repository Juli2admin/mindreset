# Carry-forward notes

Decisions made during the build that future maintainers should know about.
Each entry records what was decided, why, and where in the code the decision
lives so it can be revisited or changed cleanly.

This file is not a TODO list — see `docs/security-deferrals.md` for upgrades
we've deliberately deferred. This file is for *finalised* design decisions
whose rationale would otherwise be lost.

---

## Disclaimer modal — exclusion list

The first-visit Medical & Crisis Disclaimer modal triggers on every page by
default (via the cookie + DB check in `app/layout.tsx`). As of commit
`23814e9`, the modal is **excluded from `/terms` and `/privacy`**.

**Reasoning:** legal documents should be openly readable without
prerequisites. A modal blocking access to the very rules being acknowledged
is mildly paradoxical, and trauma-informed UX favours letting people approach
at their own pace, including reading rules first. Anyone deep-linking to
`/terms` or `/privacy` is doing research, not active product use — the
disclaimer remains mandatory on all other pages (`/`, `/screening`,
`/sign-in`, `/sign-up`, `/account`).

**Where it lives:** `app/layout.tsx` — the `DISCLAIMER_EXCLUDED_PATHS` set.
The pathname is read from a custom `x-pathname` request header set by
`middleware.ts`.

**If we add more legal pages** (e.g. `/cookies`, `/accessibility`, `/refunds`
if we split it out from `/terms`), add them to `DISCLAIMER_EXCLUDED_PATHS` in
the same file.

**To reverse this decision:** delete the `DISCLAIMER_EXCLUDED_PATHS` set and
the `isExcludedPath` checks in `app/layout.tsx`. The middleware header can
stay — it's harmless if unused and may serve future server-side path-aware
features.

---

## Product naming

The deep eight-block transformation programme has three names in active use,
deliberately. Decision logged 14 May 2026 after considering single-name-
everywhere vs marketing/legal split.

- **User-facing name:** **"The Journey"** (Russian: **"Путь"**). Warmer,
  matches the trauma-informed brand voice. Used on `Landing`, `/account`
  tier card, `/terms` (Paid Products §8 + Refund Policy headings), and the
  source markdown in `docs/MindReset_Legal_Documents_EN.md`.
- **Internal/methodology name:** **"Reset 8 Blocks framework"** — describes
  the eight-stage structure inside the programme. Appears once in the
  finalised-name NOTE in Terms §8 ("Methodology described as the eight-stage
  Reset 8 Blocks framework — internal terminology only").
- **Internal/code identifier:** **"Recode"** — legacy. Still in use across
  the DB schema (`RecodeProgress` Prisma model, `recode_block` Conversation
  kind enum, `recode` Purchase productType), `architecture.md`, and
  `README.md`. **A dedicated branding-cleanup branch should rename these
  before MiniMind public launch** so internal identifiers stop diverging
  from user-facing copy. Scope sketch: Prisma model rename + migration +
  enum value renames + every consumer-code update + Supabase ALTER TABLE +
  README/architecture editorial pass.

**Where it lives in code:**

| Surface | Name | File |
|---|---|---|
| Landing tier 3 (EN / RU) | The Journey / Путь | `components/Landing.jsx` |
| /account tier 3 (EN / RU) | The Journey / Путь | `app/account/AccountClient.tsx` |
| /terms §8 + Refund Policy | The Journey | `app/terms/page.tsx` |
| Source legal markdown | The Journey | `docs/MindReset_Legal_Documents_EN.md` |
| DB schema / models | Recode* (legacy) | `prisma/schema.prisma`, `prisma/migrations/init.sql` |
| Internal docs | Recode (legacy) | `architecture.md`, `README.md` |

**If a fourth name candidate appears:** add an entry to this section
documenting which surface it lives on and why it's distinct.

---

## MiniMind chat API (`/api/minimind/chat`)

Phase 3a smoke-test endpoint: authenticated POST → Anthropic Claude Sonnet
4.6 → response. No DB writes, no streaming, no safety scanner, no memory,
no tier check. Two items deferred:

- **Rate limiting** before public launch. Apply alongside the deferred
  `/api/screening` rate limiting (logged separately). Anthropic API costs
  scale per call; an unauthenticated abuser can't reach this route (the
  route returns 401), but an authenticated abuser could rack up cost
  without a limiter.
- **Subscription tier gating.** The route currently assumes any
  authenticated Clerk user can call it. Once MiniMind is a paid tier (Phase
  3b or the Stripe integration phase), the handler must check
  `User.miniMindActive` / `miniMindUntil` and return 402 (or 403) for users
  without an active subscription. Until then, the route is open to every
  signed-in user.
