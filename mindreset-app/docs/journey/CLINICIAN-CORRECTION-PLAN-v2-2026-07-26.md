# Correction Plan v2 — Bounded Assessment · Evolving Formulation · Active Progression

**Date:** 2026-07-26 · **Supersedes:** the "Minimum Viable Correction" section of `CLINICIAN-PROMPT-ANALYSIS-2026-07-26.md` · **Status:** plan revision only. No code edited. Nothing authorised.

**Why v2 exists:** the owner accepted the diagnosis but corrected the *correction*. v1 swung from "premature certainty" toward "endless assessment / observation only." Neither matches the method. The target is:

> **Bounded Assessment → Working Formulation → Appropriate Entry Point → Active Clinical Progression → Continuous Reassessment.**

The clinician must **keep moving the case forward**, based on **accumulating evidence**, not premature conclusions. Remove premature *certainty*, not progression.

---

## 0. Honest self-review — which of my v1 changes would harm this

The owner asked directly: *would any proposed change weaken progression or encourage indefinite assessment?* **Yes — three would. I am correcting them.**

| v1 proposal | The problem | Corrected in v2 |
|---|---|---|
| **Reframe `clinicalRead` from "working hypothesis" → "observation + unknowns + confidence"** | Would **remove the active formulation**. The clinician must always hold a live working formulation. Observation-only is the opposite failure. | Keep an **active, single, evolving formulation**. Each turn records its **disposition** (maintain / strengthen / weaken / revise / reject / expand) + **confidence** — not a fresh hypothesis, and not mere observation. |
| **Globalise "go wide before deep / do not commit early / hold hypotheses lightly"** | Would create **indefinite assessment** across the whole journey and stall progression. | Keep "go wide before deep" **bounded to the assessment phase, with explicit exit criteria**. The *global* rule is narrower: **do not restart the formulation, do not announce a new root cause, do not present inference as certainty.** |
| **Delete the per-turn "offer your read aloud" licence** | Over-restricts **active case management** — the clinician *should* reflect and offer an evolving read when it serves. | **Constrain, not delete**: a read may be offered only as an *evolution of the standing formulation* when it serves the user — never as a fresh root-cause announcement. |

**Aligned and kept from v1** (these do not weaken progression): soften the emission reminder (reframe, not remove), make the anchor clinically conditional, add hypothesis **confidence + retraction** + cap the continuity note, add an early-assessment **entry point**, fix the stuck Stage-2 gate. Details below, adjusted to v2.

---

## 1. The five-part target, mapped to concrete mechanisms in the *existing* system

No new architecture, no second prompt. Each stage maps to fields/instructions we already have.

### 1.1 Bounded Assessment (a real phase — with an exit)
- **What it is:** the opening phase answers a fixed set of questions, then **decides and moves**. It is not an indefinite mode.
- **Exit criteria (the owner's list), made explicit in `<assessment_phase>`:** enough information gathered? presenting problem understood sufficiently? processing style known? is stabilisation actually needed? is the user already capable of deeper work? is the issue local or systemic? is parts work appropriate yet?
- **Rule:** once these are answered *with sufficient confidence*, the clinician **must make a clinical decision and proceed** — assessment closes.
- **Mechanism:** `<assessment_phase>` already exists (`journey-master.md:220-270`) and already contains the share-back milestone (the natural exit). v2 makes the exit **criteria explicit** and adds *"do not remain in assessment once these are answered."*

### 1.2 Working Clinical Formulation (active, single, evolving)
- **What it is:** one standing formulation the clinician **always holds** — the running case picture (`continuityNote` already *is* this: `journey-master.md:454-471`).
- **The change:** `clinicalRead` stops being *"produce a working hypothesis this turn"* and becomes *"state this turn's **disposition toward the standing formulation**"* — exactly the owner's six verbs: **maintain / strengthen / weaken / revise / reject / expand** — plus **confidence** and **what evidence is still needed / current clinical task**.
- **Why this is the crux:** it removes the *restart-every-turn* behaviour (a new root cause per topic) **without** removing the formulation. A new topic updates the standing formulation; it does not spawn a new one.
- **Mechanism:** prompt reframe of `clinicalRead` + the confidence/retraction fields from §1.4 give the six dispositions a real home (weaken/reject become structurally possible, not just prose).

### 1.3 Appropriate Entry Point (capability-based, not ritual-based)
- **The distinction the owner drew:** not *"has the user formally completed Block 1?"* but *"does the user already possess the capacities Block 1 is meant to establish?"*
- **What assessment decides:** stable vs unstable · stabilisation required? · anchor clinically indicated (identity disconnection)? · meaningful identity loss? · local vs systemic? · parts work appropriate yet? → **where the clinician enters the methodology.**
- **Mechanism:** (a) prompt-side, the assessment sets the entry; (b) code-side, the gates must **credit already-present capacity** instead of demanding the ritual token in-window (today they cannot — `stage-gates.ts` only reads freshly-emitted tokens, per Section G of the v1 analysis). A stable, self-aware user should not be forced to perform Stage-1 stabilisation to "earn" Stage 2.

### 1.4 Active Clinical Progression (keep moving)
- **Preserved, not removed.** The clinician continuously evaluates whether the capacities for the **next** block already exist; if yes, move; if not, build them. Progression is driven by **accumulating evidence**, not by premature conclusions.
- **Mechanism:** the progression gates stay — but two are fixed: the anchor requirement becomes conditional (§ below), and the Stage-2 `soft_why` seal is repaired so movement actually works. The move is licensed by *evidence + capability*, not by a fresh root-cause declaration.

### 1.5 Continuous Reassessment
- The standing formulation keeps evolving after the assessment phase closes (§1.2 dispositions apply for the whole journey). Confidence can fall; a hypothesis can be **rejected** and structurally retracted; the entry decision can be revisited if new evidence contradicts it.
- **Mechanism:** the confidence + retraction path (§1.4 schema work) is what makes reassessment real rather than cosmetic.

---

## 2. Revised change set (each mapped to the target, with a progression/assessment stress-test)

The owner's exact question — *would this weaken progression or cause indefinite assessment?* — answered per item.

| # | Change | Weakens progression? | Risks endless assessment? | Net |
|---|---|---|---|---|
| **1** | `clinicalRead` → **evolving-formulation disposition** (maintain/strengthen/weaken/revise/reject/expand) + confidence + evidence-still-needed + current task | **No** — it keeps an active formulation and an explicit "current task," which *supports* movement | **No** — it forbids restarting, not deciding | The core fix |
| **2** | **Bounded assessment**: explicit exit criteria + "decide and move once answered" | **No** — it *forces* a decision point | **No — it is the cure** for endless assessment | Essential guard |
| **3** | **Global rule:** no formulation restart, no new root cause per topic, no inference-as-certainty (narrow — NOT "keep exploring") | **No** | **No** — deliberately excludes "go wide forever" | Replaces the over-broad v1 restraint |
| **4** | Constrain (not delete) the aloud-read licence to *evolution of the standing formulation when it serves* | **No** — keeps active case management | **No** | Corrects v1 over-swing |
| **5** | Emission reminder: reframe to "carry your evolving formulation + disposition," **not** remove `clinicalRead` | **No** | **No** | Keeps the discipline, drops the per-turn-hypothesis pressure |
| **6** | Hypothesis **confidence marker** + **retraction path** (`active:false`) + cap `continuityNote` inbound | **No** — enables weaken/reject/reassess | **No** | Makes §1.2/§1.5 real |
| **7** | Anchor **conditional** (indicated on identity disconnection); drop the anchor gate requirement | **Strengthens** progression (unblocks stable users) | **No** | Removes the sharpest contradiction |
| **8** | Early-assessment **entry point** + gates **credit already-present capacity** | **Strengthens** (a capable user enters deeper) | **No** — bounded by §2.2 | Implements §1.3 |
| **9** | Fix Stage-2 `soft_why` seal + (later) lighten the all-8 load to current+adjacent | **Strengthens** (movement actually works) | **No** | Progression plumbing |

**None of the v2 changes weakens progression or encourages indefinite assessment.** Items 7–9 actively *strengthen* progression. Item 2 is the explicit guard against endless assessment. The two v1 dangers (observation-only, globalised "go wide") are removed.

---

## 3. Files to change (revised; unchanged from v1 in location, changed in intent)

| File / area | Revised conceptual change | Risk | Immediate UX |
|---|---|---|---|
| `docs/journey/runtime/journey-master.md` (`<clinical_reading>`, `<communication>`, `<assessment_phase>`, output-format) | `clinicalRead` → evolving-formulation disposition + confidence + current task; bound assessment with exit criteria + "decide and move"; global "no restart / no new root cause / no certainty"; constrain aloud-sharing | **Low** (prompt) | **Yes** |
| `docs/journey/00-shared-core.md` (§4, §6) | "analyse internally, stay exploratory aloud, hold ONE evolving formulation"; anchor = conditional identity intervention | **Low** | **Yes** |
| `lib/journey/prompts/emission-reminder.ts:24-25` | reframe to carry the evolving formulation, not demand a fresh hypothesis | **Low** | **Yes** |
| `lib/journey/stateReport/schema.ts` + `parse.ts` + `state/save.ts` | add `formulationDisposition` + `confidence`; add pattern **retraction** (`active:false`); cap `continuityNote` | **Medium** | Gradual |
| `lib/journey/router/stage-gates.ts` | anchor requirement → conditional; **credit already-present capacity** (accept prior/established evidence, not only fresh in-window tokens); fix Stage-2 seal | **Medium** (well-tested; changes progression) | Next turn |
| `lib/journey/prompts/assemble.ts` (`allStageSpecs`, state-block render) | render the standing formulation + confidence per item; (later) load current+adjacent stages | **Medium** | Yes when shipped |

## 4. Safe implementation order (unchanged discipline: one commit each, reversible, tester-switch, owner-approved)

1. **Prompt core (items 1–5):** evolving-formulation reframe + bounded-assessment exit + narrow global rule + constrained aloud + emission reframe. *Highest leverage, lowest risk, immediate. This alone should stop "new root cause every turn" without stalling movement.*
2. **Confidence + retraction + note cap (item 6).** Makes weaken/reject/reassess structural.
3. **Anchor conditional (item 7).** Unblocks stable users, kills the contradiction.
4. **Entry point + capability-crediting gates (item 8).** Implements "enter where the capacities already are."
5. **Stage-2 seal + lighten load (item 9).** Most behaviourally sensitive; last.

After each: recorded-harness parity (no key) + a live fixture before/after once a key is available, before the next step.

---

## 5. One-line summary for the owner

v1 traded premature certainty for indefinite assessment. v2 keeps **one active formulation that evolves** (maintain/strengthen/weaken/revise/reject/expand + confidence), keeps **bounded assessment with a real exit**, keeps **capability-based progression** — so the clinician always knows where it is, what the task is, what evidence it still needs, and what comes next, **without** announcing a new root cause every turn.

*Plan only. No files edited. Nothing authorised until the owner approves this v2 direction.*
