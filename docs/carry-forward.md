# Carry-forward notes

Decisions made during the build that future maintainers should know about.
Each entry records what was decided, why, and where in the code the decision
lives so it can be revisited or changed cleanly.

This file is not a TODO list — see `docs/security-deferrals.md` for upgrades
we've deliberately deferred. This file is for *finalised* design decisions
whose rationale would otherwise be lost.

---

## Disclaimer modal — exclusion list

> **UPDATED 2026-05-26 (PR #55):** the layout-level exclusion approach
> described below was abandoned. The DisclaimerGate component is now
> mounted inside `app/[locale]/minimind/page.tsx`, not the root layout.
> Pages that don't render the component cannot show the modal — no URL
> detection, no middleware dependency. The denylist set and the
> `x-pathname` reliance are gone. The original entry below is kept for
> historical context.

### Historical (pre-PR #55)

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

**Where it lives (pre-PR #55):** `app/layout.tsx` — the
`DISCLAIMER_EXCLUDED_PATHS` set. The pathname is read from a custom
`x-pathname` request header set by `middleware.ts`.

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

## `User.preferredName` field — feature dropped after Preview testing

**Status: dropped.** MiniMind will learn the user's name naturally in
conversation. Preview testing showed this works better than backfilling
from a sign-up-time captured value, which carried duplicate-collection
UX cost and turned out to be technically fragile (see below).

### What was tried

The `claude/carry-forward-user-fields` branch (May 2026, abandoned —
preserved at tag `archive/preferred-name-backfill-2026-05-17`) attempted:

- New nullable column `User.preferredName` (TEXT) + new nullable column
  `ScreeningResponse.preferredName` (TEXT) — migration
  `20260516140000_user_screening_preferred_name.sql`, applied to
  production DB.
- Capture: optional "What should we call you?" input on the screening
  result screen (`ResultScreen` in `components/Screening.jsx`), PATCH
  to `/api/screening` to store on the unclaimed `ScreeningResponse`.
- Linkage: client passes `ScreeningResponse.id` via Clerk's
  `<SignUp unsafeMetadata={{ screeningId }} />` prop. URL-param-wins,
  cookie-fallback. Clerk webhook reads `data.unsafe_metadata.screeningId`
  on `user.created`, validates against DB, backfills the User row.
- Memory loader reads `user.preferredName?.trim() || 'not given'`.

End-to-end the implementation type-checked, built, and passed every
layer of code review and most Preview tests — except the Clerk
`unsafeMetadata` prop on the prebuilt `<SignUp>` component never landed
on the Clerk user object for fresh sign-ups. Documented as a prop in
`@clerk/types@4.26.0` and supported per Clerk docs; historical clerk-js
bugs in this area exist (PR #5161 fix in 5.53.0, PR #7647 fix in
5.121.1) but root cause for our specific case was not isolated. The
decision to drop the feature avoided further investigation cost on a
mechanism the product no longer wanted.

### Why MiniMind learning the name in conversation is better

- One less form-field at sign-up — reduces friction at conversion-
  critical moment.
- Honest UX: the moment the name matters is the first conversation, not
  the form. Asking inside the conversation makes the use of it visible.
- No reliance on Clerk SDK internal metadata propagation.

### What this means for the prompt

The v2.3 prompt's MEMORY ACROSS SESSIONS section already renders
`Preferred name: not given` for users without a stored name. MiniMind
can introduce herself, ask the user's name when it feels natural, and
remember it through the existing `DiagnosticProfile.engineNotes`
narrative field (or a future dedicated mechanism, post-launch).

**Where the orphan DB columns live now:** see the
"Orphan DB columns from abandoned preferredName work" entry below.
The columns remain in production (nullable, harmless) for potential
future use.

---

## `User.screeningResult` populated — RESOLVED 2026-05-25

**Status: shipped.** MiniMind now has access to the user's screening
result for screening-aware care (YELLOW pacing, etc).

Implementation took two paths instead of the single sketched approach:

1. **Signed-in users**: `POST /api/screening` writes
   `User.screeningResult` + `User.screeningResultAt` directly at
   screening time (no cookie hop needed).
2. **Anonymous-then-signed-up**: the `mr_screening` cookie carries the
   pre-auth `ScreeningResponse.id`. On first `/minimind` page load,
   the server component reads the linked row and backfills
   `User.screeningResult` + `User.screeningResultAt` if still null.

The Clerk-SDK-metadata-propagation approach (Path B1, via
`<SignUp unsafeMetadata={{ screeningId }} />`) was abandoned — the
metadata never landed on Clerk's user object reliably. The cookie
backfill is the durable solution.

Cross-device edge case: if a user screens on mobile, clears cookies,
then signs up on desktop, the cookie is lost and the screening result
stays null. MiniMind treats this as `screeningResult: none`.
Acceptable for v1; post-launch a "did you already screen?"
account-settings flow can address it.

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

---

## v2.3 Type-to-practice categories ahead of the named-practice catalog

The v2.3 prompt's `Type-to-practice matching` subsection in
`YOUR PRACTICE TOOLKIT` (introduced in Phase 3e Commit 1, file
`mindreset-app/lib/minimind/prompt.ts` + the canonical .md doc)
references technique **categories** rather than the named practices
in the existing `Example practices` subsection:

- `contact points` (chair, floor, hands) — for Freeze / Shutdown
- `small movement` (toes, fingers) — for Freeze / Shutdown
- `warm-object practice` — for Freeze / Shutdown (distinct from the
  existing Warm Point, which is hand-on-self)
- `gentle weight awareness` — for Freeze / Shutdown
- `concrete body bridge questions` — for Over-analytical / Cognitive
- `somatic containment` (hands over chest) — for Emotional Overflow
  (overlaps Warm Point conceptually but framed differently)
- `symbolic containment` — for Visual / Imaginative
- `warmth as light` — for Visual / Imaginative
- `safe-place imagery` — for Visual / Imaginative
- `image-of-feeling` — for Visual / Imaginative

The categories are descriptive and read naturally in-context, and the
single named reference (`5-4-3-2-1`) does map cleanly to the existing
`Grounding 5-4-3-2-1` entry. So this works for v2.3 — but when v3.0
moves practices to a structured catalog (each practice as a row with
type-mapping, duration, sequence steps, contraindications), these
categories need to be populated as concrete named practices in the
catalog and the Type-to-practice subsection rewritten to reference
those names directly.

**Where it lives:** `### Type-to-practice matching (quick reference)`
inside `## YOUR PRACTICE TOOLKIT` in both
`lib/minimind/prompt.ts` and the canonical doc.

---

## Orphan DB columns from abandoned preferredName work

Two nullable TEXT columns exist in the production database that no code
on main references:

- `"User"."preferredName"` TEXT NULL (no default)
- `"ScreeningResponse"."preferredName"` TEXT NULL (no default)

Added by migration
`20260516140000_user_screening_preferred_name.sql` (no longer in
the repo — only existed on the abandoned branch
`claude/carry-forward-user-fields`, preserved at tag
`archive/preferred-name-backfill-2026-05-17`). The migration was run
manually in Supabase before the branch was abandoned, so the columns
remain.

**Decision: leave in place.** No functional impact — Prisma accepts
extra DB columns it doesn't know about. Dropping would require an
additional manual SQL statement against production and would lose any
preferredName values that may have been populated during the Preview
testing window (test data only; non-critical, but unnecessary loss).

**Future use:** if a later phase reintroduces preferredName capture
(any mechanism — account-settings page edit, cookie-based post-signup
link, etc.) the columns are already there. No migration needed to
revive. The `prisma/schema.prisma` on main would need a single-line
addition per column at that point so Prisma generates client types for
them; the DB itself is ready.

**Test data note:** the Preview branch ran the Clerk-webhook backfill
code briefly. A small number of test users (Julia, Maria, internal
test accounts) may have `preferredName` populated. Treat this as
not-canonical and safe to ignore until a future phase decides
explicitly what to do with it.

---

## Clerk production instance setup (pre-launch)

Clerk is currently running in **development mode** on production —
the dev-mode banner is visible at the top of every page on
`mindreset.vercel.app`. This is acceptable for closed Preview testing
but **must be switched to a production Clerk instance before public
launch**.

**Requirements before launch:**

1. Create a production Clerk application in the Clerk dashboard.
2. Configure production keys in Vercel env vars:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → production publishable key
     (begins `pk_live_`)
   - `CLERK_SECRET_KEY` → production secret key (begins `sk_live_`)
   - `CLERK_WEBHOOK_SECRET` → production webhook signing secret
     (matches the production webhook endpoint configured in dashboard)
3. Configure the production webhook endpoint in Clerk dashboard
   pointing to the production `/api/webhooks/clerk` URL.
4. Configure sign-in/sign-up URL settings, redirect URLs, and any
   appearance / localization overrides.
5. Verify the dev-mode banner is gone on next deploy.

**Where the env vars live:** Vercel project settings → Environment
Variables → Production scope. The dev-mode keys can stay in Preview
scope for ongoing test deployments.

**Cost note:** Clerk's production tier has its own pricing
(free up to a monthly active-user threshold). Worth checking the
plan before the public launch hits.

---

## Language toggle missing on `/account`

> **UPDATED 2026-05-26:** Resolved. The shared `TopBar` component now
> renders `LanguagePicker` next to the user menu on every page that
> uses TopBar — including `/home`, `/pricing`, `/minimind`, and the
> legal pages. (`/account` itself is now just a 307 redirect to
> `/home` since PR #54.) The original gap is closed. Persistence to
> `User.locale` is a separate post-launch question and not blocked by
> this entry. Original entry preserved below for historical context.

The language toggle (EN / RU) was hidden on `/account` during Phase 2
as a holding pattern — see the
"i18n + theme global providers (deferred to post-Phase-3b)" entry
above for full context. The intent at that time was the i18n lift
branch would restore the toggle globally before launch.

**Status now: still missing on `/account`.** Other pages (`/`,
`/screening`) have local toggles. Signed-in users have no way to
change their language preference, and `User.locale` is never written
even though the column exists.

**Pre-launch decision needed:** either

- **Land the deferred i18n lift first** (global LanguageProvider +
  `useLanguage()` hook + persistence to `User.locale`) — restores the
  toggle on `/account` cleanly and addresses the broader per-page
  toggle inconsistency in one pass. Larger scope.
- **Or restore the toggle on `/account` as a holding patch** with the
  local-state pattern used elsewhere, mirroring the partial RU copy
  problem the original hide was working around. Smaller scope but
  inherits the bug.

The i18n lift is the documented preferred path. Holding patch is
acceptable only if the launch timeline doesn't fit the lift.

**Where it lives:** `app/account/AccountClient.tsx` — the toggle was
removed during Phase 2 (see git log for the specific commit). The
"i18n + theme global providers" carry-forward entry above is the
canonical reference for the broader plan.

---

## T&C duplication in signup flow (pre-existing on main, needs pre-launch investigation)

Users testing the sign-up flow report seeing T&C-style content twice —
once between pre-screening and Clerk sign-up, then again after
Clerk sign-in. The duplication is **not caused by the abandoned
`claude/carry-forward-user-fields` branch** (verified: that branch
added zero new T&C surfaces). The behaviour is pre-existing on main.

### What's been ruled out

- **Clerk Legal Acceptance dashboard toggle**: verified OFF in the
  Clerk dashboard, so Clerk's prebuilt sign-up form is NOT rendering
  its own T&C checkbox in addition to ours.

### Likely candidates (uninvestigated)

1. **Disclaimer modal firing twice across the screening → signup →
   landing chain.** The modal uses both a cookie (`mr_disclaimer_acknowledged`,
   1-year, path=/, sameSite=lax) and a DB-column gate
   (`User.disclaimerAcknowledgedAt`) per `app/layout.tsx`. If the
   cookie is missing post-Clerk-flow (e.g. cleared during sign-up,
   or testing in incognito between sessions), the modal could fire
   again post-signup-landing because `disclaimerAcknowledgedAt` is
   never backfilled at sign-up time.
2. **Overlap between the screening's step-5 ConsentScreen and the
   `/sign-up` T&C+Privacy checkboxes.** Both ask for consent-style
   acknowledgement. Topically overlapping content. Two visually
   different surfaces that may register as "T&C twice" to a user.

### Investigation plan (when picked up)

- Reproduce with fresh browser session (clean cookies).
- Walk the chain: `/` (disclaimer modal) → `/screening` (step 5
  consent) → `/sign-up` (T&C checkboxes) → Clerk signup form → first
  landing post-signup.
- Note which surfaces show consent-style content and whether the user
  is asked to re-acknowledge after sign-in.
- If the disclaimer modal IS firing again post-sign-in, add a small
  backfill in the Clerk webhook on `user.created` that sets
  `User.disclaimerAcknowledgedAt` from the cookie value's timestamp (or
  `new Date()` as approximation) so signed-in users don't get
  re-prompted.

**Where to start:** `app/layout.tsx` disclaimer-gate logic + the
existing entries above for screening consent items + `/sign-up`
T&C+Privacy checkbox flow.

---

## i18n.0 — Phase 0 verification (17 May 2026)

**Status: foundation verified working.**

The Footer PoC (branch `claude/i18n-0-footer-poc`) wired `next-intl@4.12`
into a single component (Footer) with EN+RU placeholder translations.
After deploying a temporary `[DIAG-PICKER]` diagnostic to investigate
an initial "cookie not writing" report, Julia confirmed end-to-end on
Preview:

- `mr_locale` cookie write works (value `ru` present in
  `Application → Cookies` with `Path=/`, `Expires 2027`, `SameSite=Lax`,
  `Secure ✓` on the Preview origin)
- Footer renders translated strings server-side after reload
- `useLocale()` returns the correct value
- Early-return guard fires correctly when the picker's current locale
  equals the click target

**Root cause of the original "cookie not writing" report**: observer
error. The first test click hit `components/Screening.jsx`'s **internal
EN/RU toggle** (legacy COPY-block toggle in the Screening header, around
line 280) — not the new Footer language picker. That toggle flipped
Screening's local `lang` state to `'ru'` (its own COPY block) without
writing any cookie or affecting the shared Footer. The diagnostic
removed the ambiguity by displaying `currentLocale` and the cookie-write
result inline; the next click hit the Footer picker correctly and the
cookie wrote as designed.

**Action item for Phase i18n.1 or Phase i18n.2**: remove
`components/Screening.jsx`'s internal EN/RU toggle now that there's a
global Footer picker. Two coexisting language toggles on the same page
is the failure mode that produced this debugging round, and the Screening
toggle is legacy COPY-block plumbing that Phase 2 string extraction will
delete anyway. Removing it sooner (in Phase i18n.1) eliminates the
ambiguity for any subsequent Phase 0/1 testing.

**Phase 0 is ready to merge to main** after this carry-forward entry
+ revert of the `[DIAG-PICKER]` diagnostic land on the branch.

---

## Process — dual-toggle lesson (17 May 2026)

Phase 0 was shipped with the legacy Screening/Landing LangSwitch toggles
still in place, despite the May 17 carry-forward entry explicitly naming
"two coexisting language toggles on the same page" as the failure mode.
Production smoke test surfaced UX confusion consistent with that
failure mode within minutes of going live.

**New rule for future phases**: if carry-forward names a known UX trap,
fix it BEFORE shipping the affecting phase, not after. The cost of
bringing forward a one-line fix is always lower than the cost of
post-production debugging plus reviewer confidence loss.

## Process — stop-hook commits during propose-and-pause (17 May 2026)

The `~/.claude/stop-hook-git-check.sh` Stop hook fires after every turn
that ends with uncommitted changes in the tree and forces a commit before
the agent can pause. This conflicts with the "apply changes → tsc + cold
build → show grouped diff → pause for reviewer approval BEFORE commit"
pattern that i18n.0's diagnostic branch and i18n.1a both followed: in
each case, a commit landed on the feature branch before the reviewer had
signed off on the diff.

**Mitigation already in place**: commits land on the feature branch, no
PR is opened automatically, and the agent's protocol still pauses at the
PR/merge gate (PR is opened only after reviewer approval, merge only
after smoke test). The reviewer retains full control at the PR boundary
even though they lose it at the commit boundary.

**Why this is acceptable**: feature-branch commits are cheap and
reversible (`git reset`, force-push, or just landing additional fixup
commits before PR). The propose-and-pause invariant that matters — "no
unreviewed code reaches main" — is preserved by the PR gate.

**Awareness for future phases**: don't be surprised when commits appear
in the feature branch mid-conversation before approval. If a change
needs to be backed out before PR, do it via a follow-up commit on the
same branch, not by trying to suppress the stop hook. No settings change
proposed; flagging for protocol clarity only.

## Process — sandbox-to-Vercel firewall limits Preview verification (17 May 2026)

Sandbox cannot reach Vercel hosts (`host_not_allowed`). Local-with-stub-Clerk
substitutes for ~21/25 of a typical 25-point Preview checklist. Clerk-
completion paths (`auth().protect()` rewrites, sign-in flows, signed-in
routes) require Julia's manual walkthrough on the real Preview URL. Factor
this into all future verification protocols — don't promise full local
coverage.

## Phase 1c — design decisions locked (18 May 2026)

### Globe icon placement: Footer in 1c, top-right header in 1d

The universal web convention for language pickers is the top-right
header (Airbnb, Booking, Google all do this). In Phase 1c we placed the
discreet globe icon in the Footer because the top-right header is not
yet a shared component — every page renders its own header layout, and
adding the picker to all of them is a separate piece of work that
overlaps with Landing.jsx unification.

Phase 1d will:
- Unify the top header into a shared component (currently each page
  renders inline header markup)
- Move the locale-picker globe affordance from Footer to top-right
- Remove the now-redundant Footer placement

The Footer picker in 1c is functionally complete and discoverable; it
just isn't where users will look first by convention. Acceptable
trade-off for shipping 1c independently.

### Placeholder-content marker: "· en" suffix in dropdown

Six of the eight locales (FR, DE, ES, IT, PL, PT) ship in Phase 1 with
English placeholder bundles — the URL routing works (`/fr/screening`
returns a page), but the strings are still English until Phase 2's
DeepL pass + native-speaker review.

The picker dropdown marks these locales with a low-contrast "· en"
suffix after the native name:
- "Français · en"
- "Polski · en"
- (EN and RU show no suffix — native-quality content)

This is the honest middle ground between:
- Unmarked: clean but user picks Polski expecting Polish, bounces
- Disabled/greyed-out: user can't explore the locale framework at all

Phase 2 will remove the suffix marker on each locale as its DeepL pass
+ native-speaker review lands. The `NATIVE_CONTENT_LOCALES` set in
`components/LanguagePicker.tsx` (renamed from `FooterLanguagePicker.tsx`
in Phase 1d.2) is the source of truth — add a locale code to it when
its content lands and the suffix disappears.

## Phase 1d.1 — skipped: Clerk packaging conflict (18 May 2026)

The `@clerk/localizations` package (which would translate Clerk's
`<SignIn>` / `<SignUp>` / `<UserButton>` form labels into our 8
locales) cannot be installed cleanly against `@clerk/nextjs@5.7.6`.
Clerk's own dep tree pins exact versions that conflict between the two
packages — installing localizations forces duplicate `@clerk/shared`
(2.x + 3.x) and duplicate `@clerk/types` (4.26 + 4.101) into
`node_modules`. This is structural to Clerk's packaging, not something
we caused.

Today's behaviour: every locale shows English Clerk form labels
regardless of UI locale. On RU pages this stands out (Russian page
wrapper + English form); on the 6 placeholder locales it doesn't stand
out yet (whole page is English).

When the natural `@clerk/nextjs` SDK upgrade happens (estimated
9-12 months, sooner if CVE-driven), Clerk's packaging will likely have
resolved. The localizations install becomes free at that point — we
translate all 8 locales in one go.

Trap to remember: `npm install @clerk/localizations` (no version)
resolves to `@latest` which currently points at `4.6.4` — the version
paired with the NEXT Clerk SDK major (v6), not our current v5. The
correct install for v5 is the `@latest-v5` dist-tag (currently
`3.37.5`). But even with the right tag, the exact-pin conflict above
bites. So the dep-tree conflict, not the version-tag confusion, is the
actual blocker — version-tag awareness only matters once Clerk fixes
the upstream packaging.

Not a launch blocker. Not a polish item we'll prioritise against
Stripe / Resend / domain / MiniMind prompt work in the meantime.

## Phase 1d.2 — TopBar is a client component by design (18 May 2026)

The initial 1d.2 draft made `TopBar` a server-async component (mirror
of `Footer.tsx`). During application three pages (Landing, Screening,
MiniMind) revealed a constraint that forced a re-design: each needs
client-state-derived content in its TopBar right slot —

- **Landing**: Sign-in/Account `<Link>` whose `href` and label depend
  on Clerk's `useUser()` hook; `<ThemeToggle />` reads from Landing's
  local `ThemeContext`
- **Screening**: progress indicator driven by internal step state;
  `<ThemeToggle />` reads from Screening's `ThemeContext`
- **MiniMind**: conditional "Start new" button bound to `onStartNew`
  client callback

A server-async TopBar can't accept client-context-dependent or
callback-bound JSX as a prop value rendered inline from a `'use client'`
parent. Options considered:
- Local TopBar-shaped headers on the 3 affected pages — ~90 LOC of
  duplication across 3 files
- Two-row sibling layout — awkward UX
- **Convert TopBar to client component** — ~2 KB on the shared client
  bundle, single source of truth, drops the `topBarSlot` slot-prop
  plumbing on Sign-up and Account (cleanup gain)

Chose the conversion. `TopBar` now has `'use client'`, uses
`useTranslations` instead of `getTranslations`, and is imported
directly by every page (server pages — Terms, Privacy, Sign-in —
render the client component inline; this is fine, server components
can render client components).

`Footer.tsx` stays a server component because its right-side content
is fixed (T&C / Privacy / Contact / picker) — no client-state
dependency. Asymmetry between TopBar and Footer is acceptable and
documented.

Future TopBar surgery (adding new shared elements, restructuring) is
now a single-file change — no risk of 3 local copies drifting.

---

## Security — RLS enabled on all tables (20 May 2026)

**Status: applied to production Supabase project, smoke verified.**

All 10 user-data tables in the `public` schema had Row Level Security
disabled, with the default Supabase grants leaving `anon` and
`authenticated` roles with full SELECT/INSERT/UPDATE/DELETE access via
PostgREST (`/rest/v1/*`). Caught by Supabase Security Advisor; fixed
the same day with manual SQL in the Supabase dashboard.

### Root cause

Prisma migrations do not manage Postgres RLS — `ENABLE ROW LEVEL
SECURITY` is not in Prisma's vocabulary and is never emitted by
`prisma migrate`. Supabase, on the other hand, ships every new
project with PostgREST enabled and grants `anon` + `authenticated`
roles full CRUD on every table in `public` by default. The two
defaults compose into a wide-open state for any Prisma-managed table
until an out-of-band SQL step enables RLS.

### What was fixed

Two SQL blocks ran in a single `BEGIN`/`COMMIT` transaction against
the production project (`mfcdfgratnsjjvprmucc`) via Supabase SQL
editor:

1. `ENABLE ROW LEVEL SECURITY` on all 10 tables — `User`,
   `ScreeningResponse`, `DiagnosticProfile`, `Conversation`, `Message`,
   `SafetyEvent`, `Purchase`, `ModuleProgress`, `RecodeProgress`,
   `Practice`.
2. `REVOKE ALL ... FROM anon, authenticated` on the same 10 tables as
   defence-in-depth — even if Supabase ever changes its RLS default
   semantics, the underlying grants themselves are gone.

The exact SQL is codified at `mindreset-app/db/rls.sql` so a future
disaster-recovery restore from a Prisma migration set can re-apply
it in one step.

### Why the app is unaffected

Prisma connects to Postgres as the `postgres.<project-ref>` role
(visible in the `DATABASE_URL` pooler connection string). That role
carries the `BYPASSRLS` attribute by Supabase default, so RLS
policies and the lack-of-policies-as-deny do not apply to Prisma
traffic. Production smoke after applying the SQL confirmed
sign-in, screening submission, and MiniMind chat all continue to work
unchanged.

### Future note — new tables need this step

Any new table added via `prisma migrate` (or any other Prisma schema
change that creates a new table in the `public` schema) needs a
manual `ALTER TABLE public."<Name>" ENABLE ROW LEVEL SECURITY;`
plus `REVOKE ALL ON public."<Name>" FROM anon, authenticated;`
in the Supabase SQL editor before deploying to production. Append the
new statements to `mindreset-app/db/rls.sql` in the same PR that adds
the Prisma model, so the file stays the canonical reproduction step.

### Exposure assessment

The app never used the Supabase anon key — no `@supabase/supabase-js`
import anywhere in the codebase, no `NEXT_PUBLIC_SUPABASE_*` env vars
ever defined, and all data access is via Prisma's direct Postgres
connection. The project's anon key was never shared outside the
Supabase dashboard owner. Practical exposure window was zero
attackers in possession of the anon key, so no breach occurred and no
UK-GDPR Article 33 notification is required. The Security Advisor
lint was a real defect (the wide-open state was real); the data was
not actually accessed by anyone outside Prisma's authorised
connection.

### Where it lives

- Codified SQL: `mindreset-app/db/rls.sql`
- Audit transcript: this entry
- Production state: applied to project `mfcdfgratnsjjvprmucc` on
  20 May 2026

---

## Admin panel architecture (PRs #79, #80) — 2026-05-31

The `/admin` panel is the operational control surface for the soft-launch
checklist items: support email queue, marketing send, telemetry, promo
codes. Lives at `app/admin/` **outside `[locale]`** because it is internal
tooling, English-only, with no need for i18n or theme.

### Why a separate layout

The customer-facing app mounts `ClerkProvider`, `NextIntlClientProvider`,
`ThemeProvider`, fonts, JSON-LD, and the html shell inside
`app/[locale]/layout.tsx`. The root `app/layout.tsx` is a passthrough.
Routes outside `[locale]` (like `/admin`) therefore have no providers
and no HTML shell.

PR #79 originally placed the admin layout outside `[locale]` but did not
re-mount `ClerkProvider` — the result was a runtime error on every admin
page (the `SignOutButton` Clerk client component panicked looking for
context). PR #80 fixed it by making `app/admin/layout.tsx` self-contained:
it imports `globals.css`, renders its own html/body, and wraps the
children in a fresh `ClerkProvider`.

### Why the email allowlist, not RBAC

`/admin` access is double-gated:
1. **Middleware** (`middleware.ts`) requires a Clerk session — signed-out
   users get redirected to `/sign-in`.
2. **`app/admin/layout.tsx`** then checks the signed-in user's email
   against the comma-separated `ADMIN_EMAILS` env var. Non-admin users
   get a `notFound()` (404), not a 401, so the existence of `/admin` is
   not advertised.

No role column on `User`, no Clerk roles or organisations — just a flat
env-var allowlist. At launch volume (1–3 admins) this is the simplest
secure thing that works. Adding role-based access would mean schema
changes, migrations, a role-management UI, and seed-data — overkill
until there are more than 3 people who legitimately need admin access.

To add another admin: edit the Vercel env var, redeploy. To remove: same.

---

## Stripe webhook idempotency model (PRs #78, #87) — 2026-05-31

Stripe re-delivers webhook events when the endpoint times out or returns
non-2xx. Retries can arrive minutes or days later. Two pre-existing bugs
made retries dangerous:

1. **`handleInvoicePaymentSucceeded` was not idempotent.** It zeroed
   `messagesUsedThisCycle` and `topUpMessagesRemaining` on every call.
   A retry mid-cycle would wipe messages the customer had already used
   and top-up balance they had already paid for.
2. **`handleCheckoutCompleted` did the Purchase write and the credit
   grant in sequence, not in a transaction.** A crash between them left
   a Purchase row with no credit grant; Stripe's retry then deduped
   the Purchase write via the unique `stripeSessionId` constraint and
   skipped the credit grant — customer paid £4.99, got zero messages.

### The model

PR #78 introduced a `StripeEvent` table whose primary key is the Stripe
event ID. The webhook's first DB action is to insert this row. The
unique-key collision (P2002) is the dedup signal: a colliding insert
means another delivery of the same event has already been claimed.

PR #87 fixed the original gap in this model: if a handler **threw**
after the StripeEvent row was claimed but before the work completed,
the row stayed committed and Stripe's retry was silently deduped.
PR #87 added the rollback — on handler error, `StripeEvent` is deleted
(best-effort) so the retry can re-claim.

Topup handler in `handleCheckoutCompleted` was also wrapped in
`prisma.$transaction([...])` in PR #78 so Purchase + credit grant are
atomic.

### Concurrency note

Concurrent deliveries of the same event ID resolve at the StripeEvent
insert: one wins, the other gets P2002 and returns `deduped: true`. If
the winner's handler then throws, its rollback restores the row to the
pre-claim state and Stripe's retry will eventually succeed. If the
rollback also fails (rare DB outage), we return 500 and accept that
Stripe's next retry may collide on the still-present row and skip — the
edge case is preferred over double-processing.

### Where it lives

- Table: `prisma/schema.prisma` model `StripeEvent`
- Handler: `app/api/stripe/webhook/route.ts` POST handler
- Migration: applied manually to Supabase 2026-05-29

---

## Resend Inbound deferral — 2026-05-31

The plan-locked AI support email workflow (`PreLaunch_Plan.md` §4.1)
assumed Resend Inbound was available on the account. It is not — the
Inbound feature is in private beta and access requires explicit
allowlisting by Resend support. Access was requested via support email
on 2026-05-31; expected response 1–2 business days.

Until access lands, `/admin/support` is fed manually via the
`AddTestEmailForm` component (a collapsible form at the top of the
queue page). A server action creates a `SupportEmail` row, fires the AI
categoriser inline, and redirects to the detail page. The admin can
then edit the draft and click Send — full end-to-end loop works without
any Resend Inbound integration.

When access lands, the work to swap manual paste for the real webhook
is small: create the inbound endpoint in Resend Dashboard pointing at
`/api/webhooks/email-inbound`, add `RESEND_INBOUND_WEBHOOK_SECRET` to
Vercel env vars, ship the webhook handler (svix-verified, same pattern
as the existing `webhooks/clerk` route), and delete the
`AddTestEmailForm` import. The `SupportEmail` schema is unchanged —
the test form writes the same rows the webhook would write.

The MX record for `@mindreset.ai` is already pointed at Resend
(`inbound-smtp.eu-west-1.amazonaws.com`), so when access lands no DNS
work is needed. Cloudflare/Namecheap forwarder workaround was
considered and rejected — every alternative either added daily manual
paste friction, bypassed the audit trail, or locked the system into a
parser we would later migrate off.

### Where it lives

- Test-form component: `app/admin/support/AddTestEmailForm.tsx`
- Audit trail of the decision: this entry
- Pending PR: `claude/support-inbound-webhook` (not yet branched)
- Open question: `docs/decisions/open-questions.md` #23

---

## Marketing email consent + unsubscribe model (PRs #85, #86) — 2026-05-31

PECR/GDPR require explicit opt-in for marketing emails and a one-click
unsubscribe link that remains valid for the lifetime of the email.

### Consent

`User.marketingConsent` is a boolean defaulting to `false`. Recipients
for any marketing send are computed live at send time (not pre-
snapshotted) so a user who unsubscribes mid-campaign is honoured for
the rest of the batch — and a user who opts in mid-campaign is NOT
accidentally included (they pick up on the next send).

There is currently no UI surface for users to set `marketingConsent` to
true. This is tracked as launch blocker open-question #24 and resolves
in the upcoming `claude/marketing-consent-signup` PR.

### Unsubscribe

`lib/email/unsubscribe.ts` defines HMAC-SHA256 tokens of the form
`userId.base64url(HMAC(userId, SECRET))`. The endpoint at
`/api/email/unsubscribe` accepts both GET and POST so email clients
pre-fetching links don't break the flow — the HMAC itself is the
authentication, no CSRF protection needed. Deleted accounts: the
`updateMany` call is a no-op rather than an error, never leaking
account existence.

Every marketing email gets two unsubscribe surfaces:
1. **Footer text link** — appended automatically by `sendMarketing.ts`
2. **RFC 8058 List-Unsubscribe header** + `List-Unsubscribe-Post:
   List-Unsubscribe=One-Click` so Gmail / Apple Mail / Outlook surface
   a native Unsubscribe button at the top of the message

### Secret rotation

Rotating `UNSUBSCRIBE_TOKEN_SECRET` invalidates every previously-sent
unsubscribe link. Only rotate on compromise. Document the rotation in
this file if it ever happens, so future "this link doesn't work"
support reads have an explanation.

### Where it lives

- HMAC: `lib/email/unsubscribe.ts`
- Endpoint: `app/api/email/unsubscribe/route.ts`
- Public confirmation page: `app/unsubscribe/[token]/page.tsx`
- Send wrapper: `lib/email/sendMarketing.ts`
- Schema fields: `User.marketingConsent`, `User.marketingUnsubAt`

