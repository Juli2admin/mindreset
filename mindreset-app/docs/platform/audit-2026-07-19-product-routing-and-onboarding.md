# Audit — Product Routing & Onboarding: Where the Three-Layer Model Was Lost

**Date:** 2026-07-19 (fourth audit; companions: the three Journey audits of the same
date in `docs/journey/`)
**Scope:** read-only. No code, prompt, or canon changes. Audit document only.

---

## 1. Executive verdict

The original three-layer model — MiniMind as reception and ongoing assessment, focused
States/Themes as the middle tier, Journey as the deep programme reached by recognition
— was never dismantled. **It was never finished being connected.** The reception layer's
brain exists and runs today (MiniMind's v2.3 prompt still carries the Surface-only
mandate, pattern detection, and module-suggestion protocol; the `WellbeingSnapshot`
profile updates every 20 messages and is injected into every MiniMind turn). What was
never built is the *connective tissue*: the suggestion has no catalog and no
click-through; the profile is read by no product except MiniMind itself; Journey's
purchase path bypasses the reception layer entirely; and the pilot design routed
testers **directly into Journey at signup**, inverting the funnel the platform was
designed around. The pilot therefore tested Journey on exactly the population MiniMind
was supposed to hold or route elsewhere — which is why the tester reports read as
"wrong product" as much as "wrong method."

Today, the only entity that decides which product a user should use is **the user**
(or, for the pilot, the invitation itself). The only suitability check anywhere is the
Section 0 crisis screen — an *exclusion* instrument, not a needs assessment — and it
gates Journey purchase only against `red` (added 2026-07-11).

---

## 2. Original intended flow (documentary evidence)

From `docs/roadmap/MindReset_Roadmap_v1.md` (15 May 2026):

- Launch ships **"MiniMind live and saleable"**; Journey and S&T are "Coming soon"
  cards — "the other tiers become genuine upsells marketed to existing users rather
  than cold launches" (l. 17-23).
- Locked principles (l. 38-42): **"Recognition before recommendation: users are
  pointed to deeper tiers only after pattern detection has seen genuine need three
  times in seven days"**; "The user discovers next tier — never pushed: tier
  progression mirrors emotional readiness, not calendar time"; "No popup upsells. Ever."
- Phase 3d (l. 133-150): `DiagnosticProfile` periodic updates, memory injection,
  `repeat_state_counter`, "Threshold detection: when same state appears 3+ times in 7
  days, MiniMind raises module suggestion (already in v2.1 prompt)". Noted out of
  scope *then*: "Module suggestion click-through (S&T tier doesn't exist yet)".
- Email sequence 4 (l. 278): "Module suggestion — MiniMind pattern detection has
  flagged a repeating state."

From `lib/minimind/prompt.ts` (v2.3, **live today**):

- l. 24: "Suggest deeper MindReset modules when patterns warrant it."
- l. 256: "You operate at **Surface level only**… You do not enter Blocks 2–8 of the
  MindReset 8-block framework. Those belong to The Journey programme."
- l. 274: "If the user wants deeper work, gently point them toward the relevant module
  or The Journey programme…"
- l. 576-594: "PATTERN DETECTION & MODULE SUGGESTION" — nine state clusters, 3-in-7-days
  threshold, suggestion script with a **`[module name]` placeholder**.
- l. 596-600: medium-lead threshold — suggestions only after a pattern, never at the
  first sign of feeling.

This is the intended model, verbatim, in the current runtime prompt. The reception
layer was designed, specified, and half-shipped.

---

## 3. Current end-to-end flow (code evidence)

```
Landing → /screening (Section 0: exclusion checklist + 0-5 self-ratings
        → classify() → green | yellow | red; ScreeningResponse row;
        cookie-backfill to User.screeningResult)          lib/screening/classify.ts
   → /sign-up (gated on completed screening)               roadmap l.56, carry-forward
   → Clerk user.created webhook → User row
        └─ PILOT PATH: lib/pilot/grants.ts — if invited: creates a completed
           'recode' Purchase (amount 0) → /journey OPEN IMMEDIATELY, and
           upgrades tier to 'extended'                     grants.ts:47-77
   → /home — product cards: MiniMind | Journey | States | Themes
        (self-selection; Journey card flips to "Continue →" if purchased)
   → purchase paths (all self-selected):
        MiniMind tiers (subscription)
        Journey £599/instalment → /api/checkout/create
             ONLY check: screeningResult === 'red' → blocked   route.ts:64-95
        State £29 → /api/states/checkout   (no suitability check)
        Theme £59 → /api/themes/checkout   (no suitability check)
   → product use:
        MiniMind: chat + WellbeingSnapshot updater every 20 user messages
                  (updater.ts via chat/route.ts:44,655-668), memory block
                  injected every turn (loader.ts)
        Journey:  8-stage programme (see docs/journey/ audits)
        States/Themes: 30-day module sessions with own memory tables
```

**Admin visibility:** `/admin/pilot` (tester funnel), `/admin/journey-inspect`
(Journey turns). **No surface records or displays a routing decision — because no
routing decision exists to record.**

---

## 4. Exact divergence points

| # | Divergence | Evidence |
|---|---|---|
| DV1 | **Soft-launch inversion was never re-sequenced.** "Coming soon" cards became direct-purchase cards when Block B shipped billing; the upsell-from-recognition sequencing was never wired between them. Journey is sold cold from `/pricing` to any non-red user | pricing/page.tsx:132-187; checkout/create:64-95 |
| DV2 | **Pilot grants invert the funnel.** Invited testers receive a completed Journey Purchase at signup (webhook + /home upsert) — Journey-first, zero MiniMind reception | lib/pilot/grants.ts:6-7,47-77; home/page.tsx:156-158 |
| DV3 | **The suggestion loop is a bridge to nowhere.** The prompt's `[module name]` placeholder has no catalog behind it: `STATE_MODULES` (4) and `THEME_MODULES` (5) exist in code but are never injected into MiniMind's context; no UI carries a suggestion to a module page; no record is kept that a suggestion was made | prompt.ts:592; lib/states/modules.ts:35; lib/themes/modules.ts:36; roadmap l.143-145 ("click-through… out of scope") |
| DV4 | **Cross-product memory does not exist.** `WellbeingSnapshot` (renamed `DiagnosticProfile`; holds `predominantState`, `stateIntensity`, **`channelPreference`**, `activeThemes`, 7-day state counts, `engineNotes`, `riskMarkers`) is read ONLY by the MiniMind chat route (+ account export). Journey infers its own `processingChannel` from zero; MiniMind never learns the user is in Journey; States/Themes keep separate memory tables | grep: `wellbeingSnapshot` consumers = memory/loader.ts, memory/updater.ts, account/export.ts, api/minimind/chat only; journey state/load.ts reads no MiniMind data |
| DV5 | **Journey is product-blind.** `journey-master.md` contains **zero** mentions of MiniMind, States, or Themes. The Journey AI cannot name, recommend, or hand off to any other layer — no step-down exists at prompt, code, or UI level | grep count = 0 |
| DV6 | **Suitability = crisis exclusion only.** Section 0 is the manual's exclusion screen (conditions checklist + 0-5 functionality ratings → green/yellow/red). It captures no request, goals, style, or desired depth. Journey checkout blocks `red` only (since the 2026-07-11 pre-launch fix; before that, nothing) | classify.ts; CLINICAL_MANUAL Section 0; checkout/create:82-95 |
| DV7 | **No platform profile of needs.** `User` model: locale, theme, consent, screening, billing, tier — no presenting request, no goals, no desired depth. The only style/state profile is MiniMind-siloed (DV4) | prisma/schema.prisma:19-94 |

**Dead / orphaned / renamed diagnostic components:** `DiagnosticProfile` → alive as
`WellbeingSnapshot` (rename, not removal); `repeat_state_counter` → implemented as the
loader's 7-day counts (alive); the roadmap's suggestion **click-through** → never
built; `[module name]` placeholder → orphaned (no catalog); preferredName columns →
orphaned (carry-forward, harmless); roadmap's S&T all-access + Journey-as-upsell
sequencing → superseded without replacement; email sequence 4 (pattern-triggered
module suggestion) → not built (Resend unwired).

---

## 5. The ten questions

1. **Can a new user enter Journey without any suitability assessment?** Yes. Any
   green/yellow user can buy from `/pricing` (only `red` is blocked); pilot testers
   are granted Journey **at signup** with no product use at all.
2. **Who or what decides which product the user should use?** The user alone
   (self-selection from /home and /pricing cards) — or, for the pilot, the invitation.
   No system component makes or records a routing decision.
3. **Does MiniMind still perform any diagnostic, onboarding or routing function?**
   Yes — genuinely, but incompletely: Surface-only mandate, pattern detection with the
   3-in-7 threshold, module-suggestion protocol, live WellbeingSnapshot updates every
   20 messages, memory injection every turn. Missing: catalog, click-through,
   recommendation recording, and any consumer of its assessment outside itself.
4. **Is the presenting request stored anywhere at platform level?** No. Not on `User`,
   not on `WellbeingSnapshot` (predominantState/activeThemes are inferred *state*, not
   request). Inside Journey it exists only as optional `continuityNote` prose
   (audit #2 §5).
5. **Are processing style, readiness and desired depth stored or inferred?** Processing
   style is inferred **twice, in silos**: `WellbeingSnapshot.channelPreference`
   (MiniMind) and `RecodeProgress.processingChannel` (Journey) — never shared.
   Readiness and desired depth: nowhere, in any product.
6. **Can MiniMind recommend Journey, a State, or a Theme?** In principle, yes — the
   prompt instructs it (l. 24, 274, 576-594). In practice it recommends into a void:
   it does not know the nine live modules' names, prices, or indications; nothing
   records the recommendation; no UI carries it to checkout.
7. **Can Journey detect that the user is in the wrong product?** No. The concept does
   not exist in its prompt (DV5), its state, or its code. The closest mechanisms —
   regression and freeze — step *down the stages*, never *out of the product*.
8. **Can the system route a stable existential or practical user away from deep parts
   work?** No, at every layer: purchase has no assessment (DV6), Journey has no
   alternative routes (audits #1–#3) and no product-fit awareness (Q7), and no
   step-down exists (DV5).
9. **Can a Journey user be safely returned to MiniMind without losing continuity?**
   Data survives (both silos persist), but nothing transfers: MiniMind would greet
   them knowing nothing of weeks of Journey work, and no handoff artifact exists in
   either direction. So: returnable, yes; *with continuity*, no.
10. **Which parts of the original three-layer architecture still exist, and which were
    removed or bypassed?** Existing: Layer 1's brain (MiniMind prompt + snapshot +
    threshold data), Layer 2's products (4 States, 5 Themes, live), Layer 3 (Journey,
    live), the crisis screen. Bypassed: the entire recognition→recommendation→
    progression path (direct sales + pilot grants). Never built: catalog injection,
    click-through, recommendation records, cross-product profile, handoffs, step-down,
    admin routing visibility. Removed: nothing — this is an unfinished bridge, not a
    demolished one.

---

## 6. Was the accountant tester misrouted?

**Almost certainly yes — at the platform layer, before any Journey defect applies.**
The pilot path (DV2) granted Journey at signup; the tester brief was to test Journey;
Section 0 would pass a stable, functional adult easily (it screens for crisis, not
fit). Under the original model, this user would have started in MiniMind; his
"meaning and purpose" presentation maps to the Identity-confusion state cluster
(prompt l. 583) and would, at most, have earned a *focused-module* suggestion after
three recurrences — not an entry into an 8-stage trauma-informed parts programme.
Both layers then compounded: routing put him in the wrong product (this audit), and
the product had no repertoire for him once there (audits #1–#3, SM9: the method was
authored for destabilised presentations). For the pilot cohort as a whole, the routing
inversion (B) is the primary explanation; the Journey-side narrowing (A) is what the
misrouted users then *experienced*.

---

## 7. Problem separation

**A. Journey problems affecting suitable Journey users** — the within-arc narrowing,
evidence pressure, closure-against-ritual, channel inversion, canon-code drift:
audits #1–#3 (RC1–RC7, SM1–SM9). These stand regardless of routing and still need
S1–S7.

**B. Platform-routing problems that send unsuitable users into Journey** — DV1 (cold
direct sale), DV2 (pilot grants), DV6 (crisis-only gate), DV5+Q7 (no product-fit
detection or step-down once inside). These are *not* Journey-method problems and are
not fixed by any Journey change.

**C. MiniMind capability gaps** — no module catalog or Journey positioning in context
(DV3); no recommendation recording; no click-through affordance; no presenting-request
capture (it assesses *state*, not *ask* — the same gap audit #2 found in Journey); no
explicit reception/assessment framing in onboarding copy; updater cadence (every 20
messages) means a 50-message free-taster user gets at most 2 profile updates — thin
data for the 3-in-7 threshold.

**D. Missing cross-product continuity** — WellbeingSnapshot unread outside MiniMind
(DV4); two independent channel inferences; Journey/States/Themes memory silos; no
handoff artifact in either direction; no platform-level profile object.

---

## 8. Smallest viable restoration plan (NOT implemented; ordered)

| # | Change | Layer | Notes |
|---|---|---|---|
| P1 | **Pilot process:** stop granting Journey at signup for new testers; require ≥1 week of MiniMind first, Journey by explicit arm assignment | process only | Zero code. Fixes the evidence-generation machine before anything else |
| P2 | **Give MiniMind its catalog:** inject `STATE_MODULES` + `THEME_MODULES` (name, one-line indication) + honest Journey positioning ("deep 8-stage programme for X; not for quick clarity") into the prompt's suggestion section | prompt.ts constant | Turns the existing suggestion protocol from vague to concrete; respects "never pushed" |
| P3 | **Pre-purchase fit step for Journey:** before `/api/checkout/create` allows a `recode` purchase, require a short self-declared fit check (what are you coming for; what depth do you want; Journey-is/is-not copy) stored on `User` (e.g. `journeyFitAckAt` + answers JSON). Not a clinical gate — an informed-choice gate | checkout + one page + 2 fields | The smallest honest answer to "users should not have to self-diagnose": give them the information and record their answer. Conversion friction on a £599 product is a business decision — flag to owner |
| P4 | **Read-only memory bridge:** Journey's state block gains one line from WellbeingSnapshot (channelPreference, predominant state) at Journey start; MiniMind's context block gains one line when a Journey purchase exists ("user is also in The Journey") | loader.ts + assemble.ts | Two render-side edits; no schema change; kills the double-blind channel inference |
| P5 | **Journey product-awareness paragraph:** master prompt learns the platform exists — when the user's ask is outside Journey's method (ties into audit #2 S1 contract questions), the AI may say so and name MiniMind / the relevant module as the better-fitting space | journey-master.md | Enables step-down at conversation level before any UI work |
| P6 | **Record recommendations:** when MiniMind makes a module/Journey suggestion, log it (engineNotes tag or a small table) and surface on /admin | updater/admin | Makes routing observable for the first time |

**Migration/regression risks:** P3 adds friction to the only high-ticket purchase —
owner decision required; keep an explicit bypass for existing purchasers and pilot
grandfathering. P2/P4 grow prompt size (small; MiniMind prompt is uncached — check
cost). P4 shares Article-9-adjacent data across products — same controller and
purpose, but document it in the privacy notice review. P5 must not become an escape
hatch that deflects suitable-but-struggling Journey users (wording review). Regression
surface: access tests (`lib/journey/access.test.ts`, states/themes access tests),
checkout screening-red test, memory-loader tests, pricing-page purchase-state logic.

---

## 9. Full future routing architecture (for later design, after A-fixes and P1–P6)

1. **Reception:** MiniMind gains an explicit (invisible-to-user) assessment posture in
   its early conversations: presenting request, expectation, processing style, desired
   depth, stability — the same contract questions as Journey S1, captured to a
   **platform profile**, not a silo.
2. **Platform profile object** (new table or WellbeingSnapshot promotion):
   presentingRequest, goals, processingStyle, desiredDepth, readiness, activeProducts,
   recommendations[] — written mainly by MiniMind, readable by every product, shown in
   admin.
3. **Recommendation engine = the MiniMind clinician + threshold data** (no new
   classifier): recognition-before-recommendation and never-pushed stay locked;
   recommendations become concrete (catalog), recorded, and actionable (one-tap route
   to the module page with context carried over).
4. **Routed entries:** Journey purchase requires either a MiniMind recommendation or
   the informed self-selection record (P3 grown up); States/Themes stay open-purchase
   with fit copy.
5. **Bidirectional handoffs:** entering Journey imports the platform profile as the
   Block-1 head start; leaving (pause, step-down, discharge) exports a summary into
   the profile so MiniMind continues warm. Same for module completion → MiniMind.
6. **Step-down as a first-class flow:** Journey UI + prompt both able to offer "this
   week in MiniMind instead"; entitlement question (does a paused Journey imply
   MiniMind access?) goes to the owner — currently a Journey-only buyer has no
   MiniMind tier to step down into. **Open product decision.**
7. **Observability:** admin routing dashboard — funnel, recommendations
   made/accepted/declined, fit-check answers, product-fit flags raised inside
   products; the pilot analytics page extends naturally.
8. **Evaluation:** routing fixtures alongside audit #2 §14's clinical fixtures — the
   accountant persona should, end-to-end, land in MiniMind/Theme, not Journey.

---

## 10. Bottom line

Do not redesign Journey for all user types. Journey's fixes (A) serve the users who
belong there; the users who don't belong there must stop arriving there (B), which
requires finishing the reception layer that already half-exists (C) and connecting the
memory the platform already collects (D). The cheapest correct move is P1 — a process
change that costs nothing and immediately changes what the pilot measures.
