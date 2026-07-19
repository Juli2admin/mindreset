# Journey Remediation — Verification Report (2026-07-19)

**Branch:** `claude/journey-remediation`
**Source-of-truth audits:** `audit-2026-07-19-clinician-narrowing.md`,
`audit-2026-07-19-runtime-clinical-decision-pathway.md` (+ `.json`),
`audit-2026-07-19-original-method.md`,
`docs/platform/audit-2026-07-19-product-routing-and-onboarding.md`.
**Scope guard:** Journey only. MiniMind, platform onboarding/routing, States & Themes,
pricing untouched. Journey remains a deep transformational product; suitable users may
be cognitive, non-visual, numb, practical, narrative, somatic, visual or mixed
processors.

---

## 1. Implementation checklist (change → confirmed finding)

| # | Phase | Change | Finding(s) | Status |
|---|---|---|---|---|
| C1 | 1 | Master prompt: correct obsolete "Without all three, the Block 1→2 gate will not fire" (`formulation_confirmed`); demote to signal token in checklist item 10 + token list | RC7 / B10 | pending |
| C2 | 1 | Stage 1 gate: remove `anchorText` + `anchor_identified` requirements; anchor becomes clinically indicated, never a progression blocker | RC6 / SM7 / A2 | pending |
| C3 | 1 | Anchor semantics aligned across canon: master §1 anchor move gains indication list (freeze, loss of self, numbness, disconnection, destabilisation, no internal support); stage-01 §8 note; CLINICAL_MANUAL Block 1 STEP 5 + §14 marked with owner-directed method revision note | SM7 / F5 | pending |
| C4 | 1 | Master token list: `anchor_identified` moved from GATE-REQUIRED to signal; "being retired" phrasing resolved; stray `<purpose>` reference fixed | RC7 | pending |
| C5 | 2 | Session task contract: `taskContract` {presentingRequest, expectedHelp, currentFocus, completionCriterion} — schema field, parser validation, merge-not-erase persistence (new `RecodeProgress.taskContractEncrypted`), state-block render, master-prompt inference + closure check instructions | RC2 | pending |
| C6 | 3.1 | Remove standing cognitive→body redirects: `CHANNEL_FAMILY_GUIDANCE.cognitive` (assemble.ts:143), master channel-selection line, stage-01 §7 scoping, stage-02 §7 softening, Example 3 annotation | RC4 / B2 / SM4 / F2 | pending |
| C7 | 3.2 | Remove per-turn emotion/body evidence quota: Block-1 checklist reworded to emit-when-observed; delete "nearly every turn" expectation; conditionalise affect→somatic-mapping trigger | RC3 / B1 | pending |
| C8 | 3.3 | `NEXT_BEST_MODES` expansion: continue_assessment, clarify_task, stay_cognitive, stay_narrative, stay_current_mode, explore_parts, cognitive_belief_work, contain, pause_step_back (+ existing modes retained) | RC4 / A5 | pending |
| C9 | 3.4 | Durable working preferences/refusals: `workingPreferenceNoted`/`Cleared` emissions, merge+cap persistence (new `RecodeProgress.workingPreferencesEncrypted`), rendered every turn, survive session boundaries | RC4 / A7 / RC11 | pending |
| C10 | 4 | Route-first adaptive method: master practice-generation rewrite (identify route → adapt task), numb/low-access route added, hierarchy items 5-6 de-reflexed, narrative family widened to structured inquiry (belief examination, sentence deconstruction, pattern comparison, values/identity clarification, cause-and-effect mapping) | RC1(partial) / B3 / SM3 / SM4 | pending |
| C11 | 5 | Practice history rendered into context: last runs (name, family, recency, status, outcome), `practiceRun.outcome` emission + `JourneyPracticeRun.outcome` column | audit#2 §4 ("stored but never shown") | pending |
| C12 | 5 | Practice repertoire report: `docs/journey/practice-repertoire-report-2026-07-19.md` (operational / missing / restorable / needs-Julia); manual-grounded exemplar titles added to generation guidance only where authored guidance suffices | SM3 / F3 | pending |
| C13 | 6 | Release semantics: `releasedAt` = provisional claim; new `releaseConfirmedAt` (user-confirmed across time); `releaseConfirmed`/`releaseInvalidated` emissions; Stage 5 gate requires confirmation; invalidation reopens; false-release + contradicted-completion tests | A8 / B6 / RC5 | pending |
| C14 | 7 | Progression: open-cycle guard on both advance lanes (no advancement while activation unresolved); stage-map flexibility language consolidated; no regress-on-vocabulary (verified already true) | RC5 / A4 / fixture I | pending |
| C15 | 8 | Closure: 8-question internal close check in master; request/focus check added to not-close conditions; "do not close merely because release language / practice completed / identity statement / calmer tone"; safe-stopping-point protocol; Shared Core §10 closing widened to fit session mode | RC5 / B6 / B11 / P1-P6 pathways | pending |
| C16 | 9 | Decision boundaries: Shared Core §4 reworded (no advice/prescription; belief-and-part examination around decisions permitted); Trap 2 append; stage 06/07/08 prohibitions scoped to impulsive/urgency; no full decision-facilitation methodology claimed | DF1 / SM8 / F8 | pending |
| C17 | 10 | Journey inspector: render taskContract, working preferences, therapeuticMode/nextBestMode, cycle status, provisional vs confirmed release, practice outcome | observability gap (audit #2 §13.9) | pending |
| C18 | fixtures | Behavioural fixtures A–I as deterministic tests (gates, merge, render, parse, prompt-content) | brief | pending |

---

_Sections 2+ (findings fixed, files changed, before/after, tests, limitations,
migration note) are completed at the end of implementation — see below._
