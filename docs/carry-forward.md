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
- **Anthropic API credit balance:** top up or enable auto-recharge before
  public launch. Current spec runs ~$0.015 per MiniMind turn (~4,700 in /
  ~50 out tokens on Sonnet 4.6).

---

## Landing First Load JS — `useUser()` cost

After flow re-order (commit `66b723c`), `/` First Load JS is **127 kB**
(+31 kB over the prior 96.2 kB). The extra weight is Clerk's client bundle,
pulled in because `Header` now calls `useUser()` to render the auth-aware
"Sign in" vs "Account" label.

**Acceptable for now** because the bundle is shared with `/sign-up` and
`/account` — most visitors will get cache hits on those routes' navigation.

**If we want to reduce it later:** render the link with the generic
"Sign in" label server-side (no Clerk hook in the initial paint), then
upgrade to "Account" client-side after Clerk's session hydrates. Net effect:
same DOM in the steady state, smaller initial JS, at the cost of slightly
more code. Worth doing only if Landing's TTI becomes a real metric concern
or if we find a way to do it without the brief label-flicker.

---

## i18n + theme global providers (deferred to post-Phase-3b)

### Current state (broken)
- Each top-level component (`Landing.jsx`, `Screening.jsx`,
  `AccountClient.tsx`) carries its own EN/RU `COPY` block and its own toggle
  with local `useState`.
- Toggling on one page does not propagate to others — language state is
  per-component.
- `/account` RU `COPY` is partial; toggling to RU still renders English
  content for the missing strings — visible bug. **Toggle hidden on
  `/account` for now** (see follow-up commit) as a holding pattern until
  the lift; reverts cleanly when global provider lands.
- `/sign-in`, `/sign-up`, `/terms`, `/privacy` are EN-only with no toggle.
- Day/night theme has the same per-component-local-state problem. Auth
  pages and account are day-only.
- `User.locale` and `User.themePref` columns exist in schema but no code
  reads or writes them.

### Target state
- Translation files at `locales/en.json`, `locales/ru.json`.
- Global `LanguageProvider` + `ThemeProvider` wrapping `app/layout.tsx`.
- `useLanguage()` / `useTheme()` hooks every component uses instead of
  local state.
- Refactor: Landing, Screening, AccountClient, sign-in, sign-up, terms,
  privacy, disclaimer modal — all read from JSON via the hooks.
- Persistence: write to `User.locale` / `User.themePref` for signed-in
  users, cookie for anonymous; read on mount so preferences follow the
  user across devices.

### Language scope
- v1: EN + RU (Julia native-quality in both).
- v2 (post-launch): UK (Ukrainian).
- Future: PL, DE, ES, FR only when native-speaker trauma-informed-copy
  review is available. Auto-translation is too risky for this product.

### Sequencing
- Branch: `claude/i18n-and-theme-lift` (pair both lifts — same files,
  same architectural shape).
- Slot: **after Phase 3b** (visible MiniMind chat), **before public
  launch** (can't sell to a Russian audience with a broken toggle).
- Scope: 1–2 focused sessions.

### Where MiniMind sits
Already handled — system prompt v2.1 instructs Claude to respond in the
user's typed language. No change needed in `/api/minimind/chat`. The
provider will inform the prompt's `preferred_language` runtime variable
when we wire the context block in Phase 3b/3d.

### Schema is ready
No migration needed. `User.locale` and `User.themePref` were added in
Phase 1 with sensible defaults (`"en"`, `"system"`). The lift is purely a
code change.
