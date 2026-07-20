# Step ① Plan — Platform Profile + 4-Step Onboarding Schema (APPROVED)

**Date:** 2026-07-20
**Status:** Plan approved by owner with corrections (see §5). NOT implemented.
No code, no migration run, no PR. Companion docs:
`design-2026-07-20-onboarding-and-routing.md` (architecture),
`audit-2026-07-19-product-routing-and-onboarding.md` (current-state evidence).

---

## 1. Owner's onboarding vision (canonical)

Flow: screening → account creation → **4-step onboarding questionnaire on
the account page** → products. Button-based, < 1 minute, lightweight by
design. Purpose is NOT assessment. Purpose: remove the fear of "I don't
know what to say"; personalise the opening conversation; align
expectations with the methodology; create a meaningful entry point.

**Step 1 — What brought you here today?**
lost_myself · repeating_patterns · dont_know_what_i_want ·
difficult_decision · relationships_not_working · understand_reactions ·
stuck · curious

**Step 2 — Which area of your life feels most affected right now?**
relationships · career_purpose · confidence_worth · family · money ·
boundaries_pleasing · emotional_reactions · several_areas

**Step 3 — How would you prefer to begin?**
direct_practical · reflective_exploratory · guide_me

**Step 4 — What would make today's conversation feel worthwhile?**
whats_holding_me_back · decision_clarity · why_repeating_patterns ·
mine_vs_expected · feel_like_myself · understand_reactions ·
what_no_longer_fits · not_sure

(Codes are storage values; display text lives in i18n bundles.)

**After onboarding:** answers personalise each product's first question,
conversational style, tone, pacing, and entry point. **The first AI
message must NEVER open with "How was your day?" / "How are you feeling
today?"** — it is dynamically generated from the user's choices. The
owner's two worked examples are the fixtures:
- lost_myself + career_purpose + direct_practical + decision_clarity →
  "Looking at your life today, which part feels least aligned with the
  person you believe you are?"
- repeating_patterns + relationships + reflective_exploratory +
  why_repeating_patterns → "What is one relationship pattern that keeps
  returning in your life, even when the people or circumstances change?"

## 2. Schema (Step ① scope)

`WellbeingSnapshot` gains six nullable columns: `onboardingWhy`,
`onboardingArea`, `onboardingStyle`, `onboardingGoal`,
`onboardingCompletedAt`, `onboardingSkippedAt` (codes plaintext — same
precedent as `predominantState`; no free text at onboarding, so nothing
new to encrypt).

New table `PlatformRecommendation`: id, userId (FK cascade), product,
source, ruleKey, reasonEncrypted, createdAt, shownAt?, response?,
respondedAt?, coolOffUntil?; index (userId, createdAt). Writers arrive
in step ④; the table ships in ① so the owner runs migration SQL once
for the whole invisible phase.

Migration SQL draft lives in the session record; additive and nullable
throughout; run-before-merge; rollback = revert deploy (columns
harmless or droppable).

**Dropped from Step ①** (vs the first draft): encrypted free-text ask
fields and `desiredDepth` — superseded by the button codes and the
style question. The user's actual words continue to be captured inside
products (e.g. the Journey task contract).

## 3. Module

New `lib/platform/profile.ts` (+ types + tests): the named access API —
`getPlatformProfile`, `saveOnboarding`, `getActiveProducts` (computed
from Purchase/RecodeProgress/StateSession/ThemeSession — never
duplicated as a column), `recordRecommendation`, `respondToRecommendation`,
and **two typed read projections**: user-facing (onboarding codes,
recommendations + reasons, derived product state ONLY) and internal
(everything). Hidden diagnostics are structurally absent from the
user-facing projection's type; a test pins its field list.

Upsert-on-first-write everywhere: today a WellbeingSnapshot row exists
only after MiniMind use; onboarding must create it for everyone.

Existing MiniMind consumers (loader/updater/chat/export) untouched in ①.

## 4. Ownership, conflicts, privacy (unchanged from approved design)

The user authors the onboarding answers (products never write them; the
user may edit them later from the account page). Exactly one product
authors each hidden-diagnostic signal (MiniMind updater). Journey keeps
its own processingChannel; the profile read API exposes both with
source + recency labels; no cross-writes. Recommendations are
append-only with recorded responses and cool-offs. Never crossing
products or reaching the user: continuity notes, clinical reads,
hypotheses, MII, stage gates, safety flags, risk markers, attachment
weights, regulation capacity, engine notes, transcripts.

## 5. Owner decisions on this plan — LOCKED 2026-07-20

1. **The onboarding serves ALL products** — not Journey-entry-only.
   Asked once at account creation, answers editable later, read by
   every product.
2. **Step 4 wording stays as written** ("today's conversation"). The
   answer is treated as the *initial* focus; products refresh it
   conversationally afterwards (the Journey task contract already does
   this natively). No repeated questionnaires.
3. **Both-genders app.** The platform is not for women only. All new
   copy — onboarding buttons first — must be gender-neutral in every
   locale. For RU this means button labels avoid gendered verb forms
   (no «потерял/потеряла» forks — use nominal or non-past
   constructions). NOTE: this supersedes the older "feminine
   grammatical forms are RU canonical" translation rule for new
   surfaces; it also matches the direction of the recent screening
   gender-neutralisation PRs (#319–#321). CLAUDE.md and
   `i18n-tools/translate-prompt.md` should be updated to reflect this
   when i18n is next touched (step ②).

## 6. Progress on the account page

Owner requirement recorded: user progress lives on the account page
(dashboard v1, build step ⑤). Layout/surface decision deferred to step
⑤ planning; content rules per the design doc §6 ("the user sees what
they said and what they did").

## 7. Consumption map (later steps, planned)

- **③** onboarding context → each product's opening personalisation;
  first-message rule enforced with the two fixtures above. The
  Journey's session-open wiring touches journey-master.md → requires
  explicit owner unfreeze when ③ is planned.
- **④** recommendation rules from why/area/goal (style never routes —
  it only shapes voice).
- **⑤** account-page dashboard v1.

## 8. Tests required before implementation (Step ①)

Code validation (unknown codes rejected, nulls allowed); upsert-on-
first-write for MiniMind-less users; saveOnboarding never clobbers
diagnostic fields; getActiveProducts across purchase/session/expiry
states; recommendation append + response + cool-off; user-facing
projection field-list pin (privacy); regression: existing MiniMind
memory tests unchanged.
