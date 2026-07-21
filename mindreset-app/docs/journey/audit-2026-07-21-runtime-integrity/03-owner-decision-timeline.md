# Owner-Decision Timeline — Journey Runtime (2026-07-21, history-verified)

Evidence standard: **OWNER** = explicitly recorded (owner-named commit text, locked
decision, dated clinician sign-off). **ATTRIBUTED** = commit claims owner philosophy, no
independent corroboration. **NOT PROVEN** = implementation-only. Every "survives today"
claim was re-verified against current HEAD (grep), not taken from prior audits.

| Date | Decision / event | Status | Replaced what | Old rule removed everywhere? | Where the old behaviour survives today |
|---|---|---|---|---|---|
| 2026-06-09 | Journey runtime ships (per-stage engineered prompts; `recommendedDepth` declared) | — | — | n/a | **`currentDepth` was never wired end-to-end from day one** (`git log -S` zero producers); permanently `'surface'` |
| 2026-06-15 | `<assessment_phase>` added: Stage 1 = wide assessment + share-back milestone (#130) | NOT PROVEN (live-test-driven) | undifferentiated Block 1 | n/a (addition) | live (`journey-master.md:104,220-270,412`) |
| 2026-06-26 | Stage-1 safety guard "B option per owner sign-off" (`stage-gates.ts:88-94`) | **OWNER** | stricter watch-blocking guard | yes | — |
| 2026-06-28 | `formulation_confirmed` removed from Stage-1 code gate (#177) | — | invented gate token | **code yes; prompt NO** — master prompt kept teaching it as the gate signal until 2026-07-19 | reconciled 2026-07-19 (P1 "truth fix") — the ONE reconciled case |
| 2026-07-01 | **OWNER revert** "restore trusted baseline": owner testing showed the execution-layer arc "regressed the AI's clinical behaviour"; + `CLINICAL_MANUAL.md` added ("If code and manual disagree, this manual is right") | **OWNER** | the arc changes | revert clean | **`CLINICAL_MANUAL.md` is never loaded by any code** (grep-verified) — a self-declared authority with no runtime reach, and never updated for next-day anchor change (`:343,685,734` still say "This is your anchor") |
| 2026-07-02 | **Anchor redefinition** (3 commits; "Clinician sign-off 2026-07-02… Julia's original method design"): anchor = positive lived reality, observation-only, NEVER spoken, NOT a stabilising move. Commit **explicitly promised** a follow-up code PR removing `anchor_not_set`/`anchor_identified_token_missing` from the Stage-1 gate | **OWNER** | anchor-as-practice + anchor-as-soothe + anchor gate | **NO — the most-violated decision in the corpus** | (1) `stage-gates.ts:113,121` still enforce both checks — zero commits to that file since 2026-07-01; the promised PR **never shipped** (the later fix `4d08114` on a remediation branch was never merged); (2) `01-stage-stabilisation.md:214` Ex.C still scripts "This is your anchor. The blanket." 4 sections below the same file's ban (`:112`); its `:148` claim "dropped from the gate" is **false vs shipped code**; (3) `00-shared-core.md:187-193` §6 still "recalls it gently whenever intensity rises" (§6 never edited); (4) `02-stage-pain.md` ×7 lines still teach Anchor-recall-on-destabilisation (file untouched since 2026-06-09, loaded every turn since PR λ); (5) deprecated `runtime/stage-01.md:173` "That's your anchor" (dead path, on disk) |
| 2026-07-04 | Journey polish PRs 1–6 ("Julia's plan, 2026-07-04"): time-awareness buckets, PGA loaded verbatim, channel guidance, 38-move vocabulary, `JourneyPattern` model, staleness signals — each marked owner-approved | **OWNER** | scattered practice method | additive | — |
| 2026-07-07 | Move-based advancement lane, 8 "Owner-locked rules (2026-07-07)" | **OWNER** | nothing (parallel lane) | classic gates untouched → two un-reconciled lanes | both live (`router.ts`) |
| 2026-07-09 | PR α: pre-reply `<assessment>` block — "Owner (Julia) accepted the 2–4 second first-byte delay"; Sensitivity Layer "non-negotiable, encoded from Julia's specification" | **OWNER** | reply-first-blind | — | Sensitivity text live (`journey-master.md:850`) |
| 2026-07-09 (same day) | PR β: `<assessment>` output requirement REMOVED (30–44s stalls); questions kept as "silent priming"; max_tokens 1500→2500 | live-test-driven | PR α's enforcement artefact | strip logic retained defensively | **The analyse-before-speak enforcement has been absent ever since**; `journey-master.md:815` now forbids all reasoning tags |
| 2026-07-10/11 | PR γ/θ/ζ/ι: report fields promoted to required; checklist contradictions fixed; `<thinking>` leak strip; panic-keyword narrowing after Julia's session froze 3× post-release | session-driven | — | — | — |
| 2026-07-11 | **PR λ**: all 8 stage specs loaded every turn; stage = "bookkeeping label… NOT capability gates" ("Julia's philosophy" per commit) | **ATTRIBUTED (unverified)** | active-stage-only loading | **NO** — gates/router still enforce sequential model; the 8 specs' own gate sections still shipped | the standing prompt-vs-code contradiction (matrix B1/E1); also **licenses** every stale stage-spec rule (e.g. S2 anchor-recall) for use from any stage |
| 2026-07-16 → 07-17 | "You are a clinician trained deep in this method" identity sentence added (#308) then **reverted next day** (#309) — new failure mode worse than the fixed one (escalated during rupture) | session-driven | — | revert clean | precedent: single-sentence prompt add/remove cycles measurably flip behaviour |
| 2026-07-19 | **Loader fence-extraction fix** (#324): outer fence closed at FIRST inner fence → **~6,101 chars silently truncated in production** — the five silent questions, ALL hard behaviour rules, the worked failure-mode example | — | — | — | **Implication: the Sensitivity Layer's hard rules never reached the model between 2026-07-09 and 2026-07-19.** Any behavioural conclusions drawn from that window tested a prompt missing its enforcement tail |
| 2026-07-19 | P1 release semantics (claim/confirm/invalidate) + open-cycle guard + `formulation_confirmed` truth-fix; P2 closure discipline; P3 task contract; emission reminder (#325-328) | — (curated subset of a remediation branch) | — | **the anchor-gate fix on the same branch (`4d08114`) was NOT in the merged subset** | anchor gate still live |
| 2026-07-20 | **`<communication>` anti-echo section added — "owner-approved wording… owner corrections included verbatim" (#329).** `git log -S` confirms this is the section's ONLY introduction — it did not exist before | **OWNER** | nothing removed — pure insertion over 812 contrary exemplars | **NO** (insertion only) | the 50:1 exemplar mass it contradicts (matrix §A). **Note: it was one day old at the time of the 2026-07-21 test session** |
| 2026-07-20 | Onboarding answers into Journey state block — "owner-approved unfreeze" (#332) | **OWNER** | — | additive, self-retiring render | — |

## Answer to the key question

**When an owner decision changed, was the old rule deleted from all runtime sources, or
was a new layer added over it?** In 6 of 7 material cases, **a new layer was added and the
old rule survived somewhere that still reaches production**:

1. Anchor redefinition (2026-07-02) — survives in 5 places incl. the live gate code and
   the same file's own worked example. The promised deletion PR never shipped.
2. Flexible map (PR λ) — sequential gates, per-stage prohibitions, and 8 gate sections all
   still shipped and code-enforced.
3. Analyse-before-speak (PR α) — removed rather than replaced; no substitute enforcement.
4. Assessment-only Stage 1 — coexists with the flexible-map license and same-turn practice
   triggers.
5. `<communication>` (2026-07-20) — inserted over, not reconciled with, Shared-Core voice
   rules and 812 exemplar snippets.
6. CLINICAL_MANUAL authority claim — never loaded, never revised, self-falsifying.
7. (Contrast) `formulation_confirmed` — the ONE case where the stale claim was eventually
   reconciled (2026-07-19, three weeks late).

*Read-only audit. No fixes proposed.*
