# The AI Clinician — Implementation Analysis & Minimum Viable Correction

**Date:** 2026-07-26 · **Against:** `main @ 7ef46ca` (live prompt = 20-July baseline) · **Status:** read-only analysis. No file edited. Nothing implemented.

**Owner's thesis (confirmed by this analysis):** the human instruction *"do not analyse"* was translated too literally. The AI should **analyse deeply in the background** and stay **exploratory in the room**; the 8 blocks and the anchor were meant to be **clinically conditional**, not a universal script the AI runs. This document verifies that against the actual code and prompt, then gives the smallest realistic correction.

Every claim carries a `file:line`. Evidence gathered by three independent read-only code traces.

---

## A. CURRENT PROMPT ASSEMBLY

**1. Main clinician-behaviour prompt:** `docs/journey/runtime/journey-master.md` (voice, moves, output format, examples, traps, the Therapeutic Sensitivity Layer). Loaded by `lib/journey/prompts/load-spec.ts` (`loadMasterPrompt`), split at the `{{STATE_INJECTION}}` token (`assemble.ts:29, 598`).

**2. Full methodology:** `docs/journey/00-shared-core.md` (the constitution) + `docs/journey/PRACTICE_GENERATION_ALGORITHM.md` + the eight stage specs `01-stage-stabilisation.md` … `08-stage-embodiment.md`.

**3. How the two are assembled:** `lib/journey/prompts/assemble.ts::assembleSystemPromptBlocks` (called at `app/api/journey/turn/route.ts:360`) returns **4 blocks**:

| # | Content | ≈ size | Cached |
|---|---|---|---|
| 1 | `sharedCore()` + Practice-Generation-Algorithm + **all 8 stage specs** (`assemble.ts:618-628`, `allStageSpecs()` `:532`) | 251 KB (~62.9k tok) | yes (`:627`) |
| 2 | master prompt **up to** `{{STATE_INJECTION}}` (`:631-635`) | 45 KB | yes (`:634`) |
| 3 | **dynamic state block** `renderStateBlock(state)` (`:636-640`) | 0.8–8 KB | **no** |
| 4 | master prompt **after** the token (`:641-647`) | 40 KB | **no** |

**4. Additional fragments injected:** the per-turn **state block** (block 3, `assemble.ts:151-453`); the **emission reminder** appended to the *last user message* on every call (`emission-reminder.ts:36-44`, `route.ts:397`).

**5. Order:** canon → master-head → **state block** → master-tail; emission reminder rides the last user turn (highest recency).

**6. Fields supplied to the model** (state block): task contract (presenting request + current focus), stage label, depth, processing channel + family guidance, last intensity, session/day counts, anchor text, parts (≤5), foreign files (≤3), signature images (≤5), patterns (≤5), continuity note, open-cycle banner, rejected modalities (this session), settling-check cue.

**7. Approx total:** **≈ 337.8 KB ≈ 84,000 tokens** every turn (measured, byte-identical across the assembler in both the baseline and current trees).

**8. All eight stages loaded every turn?** **YES** — `allStageSpecs()` concatenates specs 1–8 unconditionally (`assemble.ts:532-544, 626`), and the prompt tells the model to ignore the stage number: *"Stage numbers are a bookkeeping label … NOT capability gates"* (`assemble.ts:479`).

**9. Conflicts with the clarified methodology:** yes — the anchor is code-mandatory yet canon-optional (§F); no early-assessment branching exists (§E); the interpretation demand is per-turn and unscoped while the restraint is Block-1-only (§C). Detailed below.

---

## B. CURRENT TURN FLOW (one message, start to finish)

1. **Data loaded** (`route.ts:139-197`): user row, monthly cap, access, then `loadJourneyState` → `RecodeProgress` + parts(5)/foreign(3)/images(5)/patterns(5) + the full `JourneyTurn` audit log + last-10-turn sensitivity signals + onboarding.
2. **Memory loaded:** continuity note, task contract, patterns, anchors, adult-self qualities, MII — all into the state object.
3. **Analysis before the response:** **none by code.** The only pre-LLM clinical judgement is the crisis keyword scan (`safety/keywords.ts:150`). There is no pre-response planner.
4. **Actual pre-response clinical decision:** **none** — a single stateless streaming call does everything (`route.ts:399-404`), no tools, no second pass.
5. **Stage / route selection:** decided **after** the reply has streamed, by `decideRoute` (`router.ts:57`), which reads the audit log + gates. It can only affect the *next* turn's label.
6. **Response generated:** one `anthropic.messages.stream`, reply first then `<state-report>`, sharing one 2,500-token budget.
7. **Structured output required:** every turn — `intensity`, `safetyFlag`, `recommendedAction`; every substantive turn — `channel`, `clinicalRead`, `moveJustPerformed` (`journey-master.md:618-626`).
8. **Saved after:** assistant message; `applyStateReportToProgress` (continuity note, patterns, task contract, anchors, channel); audit turn; safety verifier; router decision.
9. **What affects the next turn:** everything re-injected via the state block.

**Generated vs stored vs behaviour-controlling** — the crucial distinction:

| | Examples |
|---|---|
| **Generated only** (not persisted) | `clinicalRead`'s effect on *this* reply; `moveJustPerformed` beyond the advance count |
| **Stored, but only re-rendered into the prompt** (no code acts on it) | `continuityNote`, `patterns`, `taskContract`, `processingChannel`, `stabilityCheck`, `channelShiftDetected` |
| **Stored AND controls code behaviour** | `intensity`, `safetyFlag`, `readinessTouched` tokens, `adultSelfPresent`, `mii`, `anchorText`, `parts`, `dischargeReadiness`, the audit log |

**Only stability/safety/progress signals steer code. All the clinical "thinking" (reads, patterns, notes, hypotheses) is prompt-decoration — captured and re-shown, never acted on.**

---

## C. WHY THE AI ANNOUNCES REPEATED "ROOT CAUSES" — ranked direct causes

The prompt is **internally at war**: it contains strong brakes against premature interpretation, but they are *scoped to Block 1* and *buried in the cached prefix*, while the demand to interpret is *unscoped, per-turn, and recency-boosted*.

1. **`clinicalRead` is REQUIRED every turn and is defined as a "working hypothesis."** *"**Working hypothesis.** What seems alive? What pattern, what longing, what stuck place? What old programme might be running?"* (`journey-master.md:55`) + *"**REQUIRED every turn**"* (`:793`). → The model must manufacture an interpretation of "what's underneath" on **every** turn, including turns where the honest read is "not enough evidence yet."
2. **The emission reminder re-injects `clinicalRead` as "REQUIRED every turn" at maximum recency** (`emission-reminder.ts:25`), *after* the 84k-token cached prompt — so the working-hypothesis demand wins on recency and overrides the "hold lightly / go wide" guidance buried in the prefix.
3. **Per-turn licence to voice the read aloud sits right beside the mandatory read:** *"You may **also** offer your read aloud to the user — but only tentatively…"* (`journey-master.md:62`). Once a hypothesis is mandatory internally, this converts it into a per-turn candidate for speech; the hedge is soft.
4. **The share-back mandate:** *"CRITICAL: the share-back must include your **working hypothesis** about the underlying pattern … Put it on the table"* + *"IN THE SAME TURN you MUST emit ALL THREE"* (`journey-master.md:255, 261`). Milestone-gated in *intent* ("roughly 2–4 sessions in"), but the `MUST`/`CRITICAL` force against a vague trigger invites early, confident root-cause declarations.
5. **`patternsTouched` rewards reifying a transient signal into a named, persisted category** the model invents (`journey-master.md:655`).
6. **`moveJustPerformed` (required, feeds the advance router) rewards *doing* an interpretive move** (`stage_5.origin_voice_mapping`, etc.) over plain witnessing (`journey-master.md:626, 806`).
7. **`continuityNote` "working hypotheses" harden across sessions** and are re-fed as *"Prior session notes"* (`journey-master.md:458` → `assemble.ts:417`) — a self-reinforcing loop that Trap 11 (`:408-412`) exists to counter but cannot structurally prevent.

**The brakes that exist but are out-scoped:** *"do NOT commit to a working hypothesis early … Let the user show you the whole map first"* — but this is inside `<assessment_phase>`, i.e. **Block 1 only** (`journey-master.md:223`). Trap 11 and Shared Core §4 restrain sharing but not the mandatory internal hypothesis.

---

## D. BACKGROUND ANALYSIS vs USER-FACING BEHAVIOUR

**1. Is the same model asked to analyse and speak in one undifferentiated instruction?** The prompt *does* draw the line — `clinicalRead` is explicitly *"your scratchpad — the code never surfaces it to the user"* (`journey-master.md:793`), reasoning is stripped (`parse.ts:36-48`), and *"Keep your reasoning internal"* (`:84`). **But there is no structural wall:** reply and analysis are produced in **one generation**, so the internal read bleeds into the spoken reply, and only the *aloud* analysis is fenced as provisional — the *internal* hypothesis is mandated every turn with only a light "ready to revise."
**2. Required to include internal interpretation in the response?** Not per turn — but the share-back mandate (`:255`) requires voicing it once, and #3/#4 above make it a standing temptation.
**3. Are hypotheses stored with uncertainty?** **No.** No `confidence`/`uncertainty`/`tentative` field exists in `schema.ts` or `types.ts`. "tentative" appears only as prompt text (`assemble.ts:92`).
**4. Can hypotheses be rejected/retracted?** **No.** Full-tree search: **zero** writes of `active:false` and **zero** `.delete`/`.deleteMany` on `JourneyPattern` or `JourneyPart`. The only retraction anywhere is foreign-file *release* invalidation (`save.ts:380-401`).
**5. Does user correction weaken a prior inference?** **Structurally, no.** If the model re-mentions a rejected `category` while "correcting," `save.ts:434-441` **overwrites the description and bumps `lastConfirmedAt` to now** — a contradiction can *refresh* the pattern as if reconfirmed. Otherwise it just ages out of the top-5 window (still stored). Nothing lowers its standing on contradiction.
**6. Are old hypotheses reintroduced as facts?** They re-render every turn (`assemble.ts:365-400, 410-438`) under uniform "hold lightly / not fact" headers — but with **no per-item confidence and no retraction**, a stale or contradicted hypothesis renders with the *same* framing as a fresh, well-supported one. The model has no structured signal telling them apart.

---

## E. EARLY-STAGE ASSESSMENT — is there an operational intake?

| Assessment | Status | Evidence |
|---|---|---|
| User stability | **split**: intensity **(a) actively gates**; explicit 1–10 **(b) recorded only** | `stage-gates.ts:51-52`; `stabilityCheck` read by no gate |
| Processing style | **(b) recorded label, not a live read** | `processingChannel` is last-write-wins (`save.ts:42,110`), rendered (`assemble.ts:202`); no gate reads it; enum lacks `pragmatic`/`somatic`/`resistant` (`types.ts:8-14`) |
| Self-connection / identity loss | **(c) prompt language only** at intake | concept only in prose (`00-shared-core.md:13`); identity code fields are Stage 5–8 captures |
| Emotional access | **(a) actively used** | `emotion_named`/`body_located` tokens gate Stages 1–2 (`stage-gates.ts:123-124, 164-168`) |
| Readiness for depth | **(c) prompt only; the `currentDepth` code field is a dead wire** | `save.ts:22,116` never assigned; only ever `'surface'` |
| Readiness for parts work | **(c) prompt only for *entry*** | `adultSelfPresent` gates *leaving* Stage 4, not entering parts work |
| Need for stabilisation | **(a) actively used** | regression `router.ts:80-85`; intensity blocks all gates |
| Need for anchor | **(c) prompt only** (and contradicts code — §F) | no code assesses "needs anchor" |
| Local vs systemic problem | **(c) prompt only / effectively absent in code** | no field classifies it |

**Verdict:** the system has **no operational intake that branches the path per user.** It gates on intensity/emotion/safety, but there is **no mechanism to decide "this stable, self-aware user does not need the anchor / stabilisation / the full curriculum."** Exactly the gap the owner identified: a stable pragmatic user is put through the same machinery as a severely disconnected one.

---

## F. ANCHOR LOGIC — the central contradiction

- **Defined** three times, inconsistently: `00-shared-core.md:187-197` (§6), `journey-master.md:106-138` (move 1), `01-stage-stabilisation.md:99-124`. State: `anchorText`, **set-once, never overwritten** (`save.ts:101-105`).
- **Mandatory?** **In code, yes** — every classic gate for Stages **1–6** requires `anchorText` (`stage-gates.ts:113, 154, 202, 248, 332, 405`) and Stage 1 also requires the `anchor_identified` token (`:120-126`). A user who never produces an anchor **can never leave Stage 1** on the classic lane.
- **In prompt, optional/conditional:** *"If the user has NOT offered qualifying material after several turns, that is fine. Do NOT chase an anchor"* (`journey-master.md:120`); Stage 1 spec says the requirement was **dropped**: *"**NOT a load-bearing Stage 1 gate** … the `anchor_identified` readiness token are dropped"* (`01-stage-stabilisation.md:106, 148`); token *"being retired"* (`journey-master.md:773`).
- **The stale code contradicts its own canon:** `stage-gates.ts:70-98` header claims "Canon §10 requires: `anchorText` set" — but §10 (`01-stage-stabilisation.md:150-156`) contains **no anchor item**. The code was never updated.
- **Meaning: stabilisation vs identity — the two canon docs disagree.** Shared Core §6 = **both** (*"recalls it whenever intensity rises"* + *"embryo of the Adult Self"*, `00-shared-core.md:193-194`). Master prompt = **identity only, explicitly NOT stabilisation** (*"The anchor is NOT a stabilising intervention … not a lever to pull when they wobble"*, `journey-master.md:110, 138`).
- **Escape hatch:** the move-based lane ignores the anchor entirely (`move-based-advance.ts:112-203`) and runs as a fallback (`router.ts:132-142`) — so whether the anchor is mandatory silently depends on which lane fires.

**This is the single clearest instance of the owner's diagnosis:** a construct meant to be a *conditional identity intervention for disconnected users* is implemented as a *mandatory stabilisation-era completion token for everyone.*

---

## G. STAGE & GATE LOGIC

- **Stage selected:** by `decideRoute` (`router.ts:57`) **after** the reply, via two lanes (classic gate + move-based).
- **Capability gates or labels?** For the **AI**, labels — it is told to ignore them and use any of the 8 (`assemble.ts:479`). For **advancement**, the classic gates are real but partly broken.
- **AI can freely use all stages:** yes.
- **Completion criteria operational or text?** Operational in `stage-gates.ts`, but **two are wrong**: (i) the **Stage 2 gate is unpassable** — it requires a `soft_why` token the live prompt vocabulary never contains, so no user advances 2→3 on the classic lane; (ii) the **anchor gates** contradict canon (§F).
- **Can code detect a user already has an earlier-stage capacity?** **No.** Gates require the tokens to be *emitted in the recent window*; there is no "already established" credit. A capable user must still perform the ritual to produce the tokens.
- **What caused the earlier stage-locking:** the Stage 2 `soft_why` seal + the anchor gate — both **PROVEN by executing the gate**.
- **What prevents building a case before intervening:** nothing forces case-building; the opposite — the per-turn `clinicalRead` + `moveJustPerformed` requirements push interpretation/intervention *every* turn.

---

## H. MEMORY & CLINICAL CASE CONTINUITY

| Clinical-case item | Stored? | Influences next turn? | Verdict |
|---|---|---|---|
| Presenting problem | `taskContract.presentingRequest` | injected (`assemble.ts:171`) | stored+injected, but overwritable |
| Current working focus | `taskContract.currentFocus` | injected (`:173`) | stored+injected |
| Confirmed user facts | scattered captures; **no "facts" store** | partially | **absent as a concept** |
| Model hypotheses | continuityNote / clinicalRead / patterns | injected (note+patterns) | stored+injected; **no code acts on them** |
| **Rejected hypotheses** | **nowhere** | — | **ABSENT** |
| **Alternative explanations** | **nowhere structured** | — | **ABSENT** |
| Secondary themes | flat pattern/image lists, no ranking | injected | **no primary/secondary concept** |
| Central recurring patterns | `JourneyPattern` (top-5) | injected (`:365-400`) | stored+injected; no gate reads it |
| Processing preferences | `processingChannel` | injected (`:202`) | stored+injected; no gate |
| **Refused/ineffective channels** | derived, **session-only, reset on resume** (`load.ts:399`) | injected within session | **evaporates across sessions**; "ineffective" not captured at all |
| Readiness for deep work | intensity/mii/adultSelf/depth | injected | **code-controlling** |
| Progress over time | stage/audit log | injected | **code-controlling** |

**`continuityNote` is the one free-text field with NO inbound cap** (`parse.ts:383` bare `copyStringField`), while siblings cap at 200/300/80 chars. It is **full-overwritten each emission** (`save.ts:118`) and **middle-truncated at render** over 800 chars (`assemble.ts:427-438`) — so a correction written into the middle of a long note is dropped from the prompt while the rows it was meant to correct persist.

---

# REQUIRED CONCLUSION

## 1. Current-system diagnosis (why it behaves like a chatbot, not a clinician)

The clinical machinery **exists and is intact**, but it is wired backwards on three axes:

1. **Interpretation is forced every turn; restraint is optional and out-of-scope.** The AI *must* produce a "working hypothesis" (`clinicalRead`) on every turn, re-demanded at maximum recency by the emission reminder — while the "go wide, don't commit early" brake applies only to Block 1 and is buried in the cached prefix. The result: a new "root cause" nearly every turn.
2. **Analysis and speech are one undifferentiated generation with no wall between them.** The prompt *intends* background analysis + exploratory front, but reply and read are produced in a single call, so the mandated internal hypothesis leaks into the mouth. There is no separate "analyse" pass and no confidence/uncertainty structure to hold a hypothesis as provisional.
3. **The method is a menu, not a case.** All 8 stages load every turn with "ignore the stage number"; there is no intake that branches the path per user; the anchor is code-mandatory but canon-optional; memory can store a conclusion permanently but can never retract one the user rejects — so it circles, amplifies the latest framing, and never builds a coherent, differentiated picture.

The owner's translation-error thesis is **correct and precise**: *"do not analyse"* became *"analyse out loud every turn,"* and the conditional clinical judgement of the manual became a universal script.

## 2. Minimum viable correction (smallest realistic change, existing system only)

No second prompt, no shadow system, no rewrite. Ordered by leverage, prompt-first:

- **(MVC-1) Reframe `clinicalRead` and globalise restraint — prompt only.** Change `clinicalRead` from a mandated per-turn *"working hypothesis"* to a per-turn *observation + what is still unknown + confidence level*. Move *"go wide before deep, do not name a root until the picture is built, hold hypotheses lightly"* out of `<assessment_phase>` into the global voice rules. Delete the per-turn *"you may also offer your read aloud"* licence (`journey-master.md:62`). Make the share-back genuinely once, evidence-gated, not a standing temptation. *This is the single biggest lever on "root cause every turn."*
- **(MVC-2) Soften the emission reminder — 1 line of code.** Stop head-lining `clinicalRead` as a "REQUIRED every turn" hypothesis in `emission-reminder.ts:25`; keep only the mechanical fields.
- **(MVC-3) Make the anchor conditional — prompt + small code.** Reconcile §6 to the "anchor is data, not a soothe" framing; state anchor is indicated only on identity disconnection. Remove the `anchorText` requirement from the classic gates so a stable user isn't blocked.
- **(MVC-4) Add hypothesis uncertainty + retraction — small schema/code.** Add a confidence marker to patterns/notes; add a `patternInvalidated` path that sets `active:false` so a rejected hypothesis actually drops. Cap `continuityNote` at parse like its siblings.
- **(MVC-5) Add a light early-assessment branch — prompt-first.** Extend `<assessment_phase>` to explicitly read stability / processing style / self-connection / readiness and choose a path: a stable, self-aware user skips stabilisation/anchor ritual; a disconnected user gets them. No new architecture — an instruction plus (optionally later) one `assessedReadiness` field.
- **(MVC-6, later) Lighten the load — medium code.** Load the current + adjacent stage specs rather than all 8, to cut dilution. Fix the Stage 2 `soft_why` seal so progression works.

## 3. Files that must change

| File / function | Why | Conceptual change | Risk | Immediate UX effect? |
|---|---|---|---|---|
| `docs/journey/runtime/journey-master.md` (`<clinical_reading>`, `<communication>`, `<assessment_phase>`, output-format) | source of the per-turn hypothesis demand + out-scoped restraint | reframe clinicalRead; globalise restraint; remove aloud-licence; fix share-back timing | **Low** (prompt, reversible) | **Yes** |
| `docs/journey/00-shared-core.md` (§4, §6, §10) | anchor meaning contradiction; "analyse aloud" vs "analyse internally" clarity | reconcile §6 to identity/data; add explicit "analyse internally, stay exploratory aloud" | **Low** | **Yes** |
| `lib/journey/prompts/emission-reminder.ts:24-25` | recency-boosts the hypothesis demand every turn | drop `clinicalRead` framing; keep mechanical fields | **Low** | **Yes** |
| `lib/journey/router/stage-gates.ts` (anchor checks `:113,120-126,154,202,248,332,405`; Stage 2 `soft_why` `:174`) | anchor mandatory-vs-optional contradiction; unpassable Stage 2 | drop anchor gate requirement; fix the token seal | **Medium** (well-tested; changes progression) | Next turn (progression) |
| `lib/journey/stateReport/schema.ts` + `parse.ts` + `lib/journey/state/save.ts` | no confidence; no retraction; uncapped note | add confidence marker + `patternInvalidated` (`active:false`) path; cap continuityNote inbound | **Medium** | Gradual |
| `lib/journey/prompts/assemble.ts` (`allStageSpecs` `:532`; state-block render) | all-8 dilution; per-item hypothesis framing | (later) load current+adjacent; tag stored items by confidence | **Medium** | Yes when shipped |

## 4. Safe implementation order

Each step is a normal Git commit, testable on the live platform, reversible, tester-switch-able. **No parallel prompt, no shadow architecture, no rewrite.**

1. **MVC-1 + MVC-2 (prompt + 1 line).** Highest leverage, lowest risk, immediate. Verify against the recorded harness (no key needed) that the assembled prompt still loads, and — when a key is available — a live before/after on the fixture.
2. **MVC-3 (anchor conditional).** Prompt reconciliation first, then the small gate change. This unblocks stable users and removes the sharpest contradiction.
3. **MVC-4 (uncertainty + retraction + note cap).** Stops the circling/repeating and the memory drift.
4. **MVC-5 (early-assessment branch).** Prompt-first; makes the path conditional per user.
5. **MVC-6 (lighten load + Stage 2 seal).** Last, because it's the most behaviourally sensitive.

After each step: recorded-harness parity + (once keyed) a live fixture run, before the next. Nothing merges to `main` without owner approval.

---

*Analysis only. No files were edited. No changes proposed here are authorised until reviewed and approved.*
