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

---

## Conversations endpoint orders by startedAt — not last-activity

`/api/minimind/conversations` returns the most recent Conversation by
`startedAt`, not by last message timestamp. This is correct for the common
case (user has one active conversation that grows) but produces the wrong
answer in edge cases:

- User starts conversation A Monday, uses heavily through Sunday.
- User clicks "Start new" Friday, sends one message.
- On return Monday, Continue offers Friday's near-empty conversation
  instead of Monday's substantial one.

**Proper fix (before public launch):** use `Conversation.endedAt` as the
active-conversation marker. "Start new" sets `endedAt: new Date()` on the
previous active conversation. The conversations endpoint filters
`endedAt: null` and returns the (at most one) match.

Requires Piece 3 (or a follow-up) to wire `endedAt` on "Start new" + a
one-time data migration for any pre-existing conversations without
`endedAt` set.

For v1 testing (Julia only), `startedAt` ordering is sufficient.

**Where the marker lives in code:** `app/api/minimind/conversations/route.ts`
has a comment above the `orderBy` referencing this note.

---

## Phase 3c keyword scanner is EN-only

The keyword lists in `lib/minimind/safety/keywords.ts` are English-only.
RU users typing crisis language (e.g. "хочу умереть") will not hit the
synchronous keyword tier and will rely entirely on the async LLM verifier
(Haiku handles RU natively). This is a real gap — the canned crisis
response won't fire instantly on an RU crisis.

Before public RU-audience launch, add at least Sev 4 + Sev 5 RU phrases
with native-speaker review. Lower tiers can wait for the i18n lift
branch.

---

## Phase 3c lesson — keyword lists with apostrophes

The Phase 3c keyword scanner was caught missing all apostrophed phrases
because clients (iOS keyboards, browsers with smart-quote settings,
rich-text paste) silently convert U+0027 → U+2019. The `\b`-anchored
regex matched literal codepoints, so curly-input never hit the
straight-quote phrase list — a Sev 3 test typed as "what's the point
of any of this" returned `{ matched: false }` and produced zero
SafetyEvent rows. Fixed by normalising both single (U+2018/U+2019) and
double (U+201C/U+201D) curly quotes to ASCII before regex matching in
`scanForKeywords`.

**Lesson for any future text-pattern matching code:** normalise
typographic punctuation upstream of regex / exact-match. This applies
to module content matching, future module quiz/answer validation, and
any future safety scanner additions (RU phrases at launch, etc.). If a
keyword list contains an apostrophe or quote character, it almost
certainly needs `normalizeForScan` (or equivalent) wrapping the input.

Same lesson, second cut: when adding new audit / logging paths, ensure
they emit *both* an entry signal *and* a distinctive failure tag. The
debugging round that produced this entry was lengthened by being
unable to distinguish "logger never called" from "logger called and
silently failed" — `[safety] event log starting` + `[SAFETY LOG
FAILED]` now resolve that permanently, but any new audit surface
should adopt the same pattern.

---

## `User.preferredName` field missing — MiniMind cannot address users by name

The `User` schema has `email`, `locale`, `themePref`, screening +
consent timestamps, and tier-state fields, but no `preferredName` /
`name` column. The Phase 3d memory loader
(`lib/minimind/memory/loader.ts`) consequently hardcodes
`Preferred name: not given` into every injected context block —
MiniMind has no way to address the user by name even when one would
be natural.

**Before public launch:** add `preferredName String?` to the `User`
model (or `displayName` — naming TBD) + capture flow on sign-up or
first chat. Then update `loader.ts` to read `user.preferredName ??
'not given'` in the two `Preferred name:` lines.

The v2.1 prompt's MEMORY ACROSS SESSIONS section already references
"preferred name" as a memory variable — it's expecting this data even
though the schema hasn't supplied it.

**Where it lives:** `prisma/schema.prisma` `User` model + the two
hardcoded lines in `mindreset-app/lib/minimind/memory/loader.ts`
(inside `emptyBlock` and the populated `block` template).

---

## `User.screeningResult` is never populated — screening → user backfill missing

`/api/screening/route.ts` writes `ScreeningResponse` rows with
`userId: null` (screening happens before sign-up in the current flow
re-order). After sign-up, nothing links the user to their pre-signup
screening response, and `User.screeningResult` / `User.screeningResultAt`
are never set.

Consequence for Phase 3d: the memory loader reads
`User.screeningResult` and consistently gets `null` for every user,
which renders as `Section 0 screening result: none` in MiniMind's
context block. The screening result that MiniMind's v2.1 prompt
expects (`GREEN`/`YELLOW`/`RED`) never arrives.

The `mr_screening` cookie set by `/api/screening` holds the
`ScreeningResponse.id` for the anonymous submission. The missing
piece is a post-sign-up handler that:

1. Reads the `mr_screening` cookie on first authenticated request.
2. Locates the matching `ScreeningResponse` row.
3. Sets its `userId` to the new user's id.
4. Mirrors `result` + `createdAt` into `User.screeningResult` +
   `User.screeningResultAt` for fast loader reads.

Until that wiring lands, MiniMind treats every user as
`screeningResult: none` regardless of their actual classification.

**Before public launch:** wire the backfill (probably in the Clerk
webhook handler at `app/api/webhooks/clerk/route.ts` or on first
authenticated /minimind hit). The Clerk-to-database wiring from
Phase 2 already exists; this is one extra step inside it.

**Where the gap lives:** between `app/api/screening/route.ts`
(writes anonymous ScreeningResponse) and `app/api/webhooks/clerk/`
(creates User on sign-up). Nothing currently bridges them.

---

## Phase 3d spec inconsistency on `riskMarkers`

The Phase 3d Claude Code instructions described `riskMarkers` as an
"APPEND-with-eviction array (cap at last 30)", grouping it with
`recentStateOccurrences` and `activeThemes`. But the existing
`DiagnosticProfile.riskMarkers` schema is a weighted Map:

```
riskMarkers Json?  // { "isolation": 0.4, "dysregulation": 0.6, "rumination": 0.3 }
```

This is a **weighted profile of risk dimensions** (does the user show
isolation? rumination? avoidance?), not an event log. The vocabulary
is a fixed set (isolation, dysregulation, rumination, avoidance,
somatization, overcontrol, despair) and each key gets a 0.0-1.0
weight reflecting how present that pattern currently is. A cap-at-30
is semantically meaningless on a Map of seven keys.

**Decision (Phase 3d Piece 4):** keep the Map shape and treat
`riskMarkers` as REPLACE on each updater run — Haiku outputs the full
updated map, the merge writes it whole. The implementation in
`lib/minimind/memory/updater.ts` matches the **schema**, not the
spec wording.

Future readers: if a reviewer asks "where's the riskMarkers
append-with-eviction logic from the Phase 3d spec?" — there isn't
one, by design. The spec was wrong about this field's shape.
