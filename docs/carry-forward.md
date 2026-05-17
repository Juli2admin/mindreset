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

## `User.screeningResult` is never populated — screening → user backfill missing (launch-blocker)

**Status: still a launch-blocker for screening-aware care.** MiniMind
needs the user's screening result (GREEN / YELLOW / RED) to adapt
care level — YELLOW users get slower pacing and more frequent state
checks per the v2.3 prompt's SCREENING SIGNAL section. With this
field null, every user is treated as `screeningResult: none`.

### What was tried

Same abandoned branch as the preferredName work
(`claude/carry-forward-user-fields`, preserved at tag
`archive/preferred-name-backfill-2026-05-17`) attempted Path B1 —
linkage via Clerk's `<SignUp unsafeMetadata={{ screeningId }} />`,
webhook reading `data.unsafe_metadata.screeningId`, backfilling
`User.screeningResult` + `User.screeningResultAt` from the matched
`ScreeningResponse`.

Same Clerk-SDK-metadata-propagation issue blocked it: the metadata
never landed on Clerk's user object in our test runs, so the webhook
saw no `screeningId` to look up. The Path B1 mechanism is **no longer
being pursued**.

### Future approach (to evaluate in a later phase)

The simpler alternative is **cookie-based post-signup link**: a
client-side `useEffect` in a post-Clerk-callback handler that:

1. Detects we just completed sign-up (e.g. by checking
   `useUser().isSignedIn` transitioning to true on the landing page,
   or by routing through a `/sign-up/complete` checkpoint).
2. Reads the `mr_screening` cookie (still present at this point;
   `httpOnly: false` per `/api/screening`).
3. POSTs `{ screeningId }` to a new authenticated `/api/user/link-screening`
   endpoint.
4. Server route validates the user owns the request (Clerk auth) +
   validates the screening exists + `userId IS NULL`, then atomically
   sets `ScreeningResponse.userId = user.id` and copies
   `result` + `createdAt` into `User.screeningResult` +
   `User.screeningResultAt`.

Properties: doesn't depend on Clerk SDK metadata propagation. Cookie
is set on the screening submission and persists across the
sign-up flow on same-device. Cross-device flow degrades gracefully —
no cookie, no link, `screeningResult` stays null, MiniMind treats as
`none`. Acceptable for v1; cross-device can be addressed post-launch
via a "did you already screen?" account-settings flow.

### Where the gap lives

Between `app/api/screening/route.ts` (writes anonymous
`ScreeningResponse` and sets the `mr_screening` cookie) and
`app/api/webhooks/clerk/` (creates User on sign-up). Nothing currently
bridges them.

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
