# Phase 2 — Line-Level Disposition Plan: Template + First Sample (NO edits performed)

Status: CLASSIFICATION SAMPLE ONLY. No prompt file is changed by this document. The full
corpus disposition (every section of every runtime file) follows this template only after
the owner approves the template and these sample classifications. Nothing marked here is
"decided" — every clinical reduction requires the owner's line review; "meaning appears
similar after summarisation" is NOT treated as methodology-preserved.

Classes: `KEEP_VERBATIM_IN_RUNTIME` · `KEEP_BUT_CONDENSE` · `LOAD_CONDITIONALLY` ·
`MOVE_TO_DOCUMENTATION` · `MERGE_WITH` · `SUPERSEDED` ·
`CONFLICTING_REQUIRES_OWNER_DECISION` · `REMOVE_FROM_RUNTIME_ONLY`.

Template per item: **Source text (exact)** | **Clinical capability** | **Duplicate of** |
**Contradicts** | **Production evidence** | **Proposed retained wording** | **Risk if
removed** | **Latest explicit owner decision**.

---

## Sample A — Shared Core §2 "The Voice" (`00-shared-core.md`)

| # | Source text (exact) | Class | Capability | Duplicate of | Contradicts | Production evidence | Proposed retained wording | Risk if removed | Owner decision |
|---|---|---|---|---|---|---|---|---|
| A1 | "Warm, present, slow, intimate but professional. British English throughout." | KEEP_VERBATIM_IN_RUNTIME | core register | — | — | register held in sessions | unchanged | voice drift | none needed |
| A2 | "Short sentences." + "One request per message." | CONFLICTING_REQUIRES_OWNER_DECISION | pacing discipline | — | `<communication>` "Vary the shape and rhythm… break the pattern" (owner-approved 2026-07-20) | fixed-cadence replies observed 2026-07-21 (trace T1/T4) | OWNER DECIDES: e.g. "Default to short sentences and one ask at a time, but vary shape per `<communication>`" — wording is hers | losing pacing safety on fragile users | 2026-07-20 comms approval did not explicitly repeal this |
| A3 | "The AI asks more than it tells." | CONFLICTING_REQUIRES_OWNER_DECISION | non-directive stance | — | owner's stated goal "AI leads the session"; `<communication>` clinician-leadership | user-must-lead pattern observed (T1, «дальше что?» ×3) | OWNER DECIDES — this line is the single clearest lead/follow policy choice | over-directive AI if removed without replacement | owner's 2026-07-21 chat statement ("i want ai lead") is not yet a recorded decision — needs formalising |
| A4 | "The AI mirrors before it moves." | CONFLICTING_REQUIRES_OWNER_DECISION | attunement-before-intervention | 19 "mirror" instructions corpus-wide | `<communication>` echo-ban (owner-approved 2026-07-20) | echo behaviour observed; matrix A1 | candidate: "Attune before moving; mirror only when repetition does clinical work (see `<communication>`)" — owner reviews | losing attunement principle entirely | 2026-07-20 approval governs echo, not the underlying principle — needs reconciliation, not deletion |
| A5 | Allowed phrasings list ("If you feel ready…", …) | KEEP_BUT_CONDENSE | permission-language palette | overlaps stage-spec exemplars | mild (fixed phrases invite formula) | permission language lands well | keep list, add "references, not scripts — do not cycle them formulaically" (already partly present) | loss of the palette | none |
| A6 | Forbidden phrasings list ("This means…", pet names, spiritual claims…) | KEEP_VERBATIM_IN_RUNTIME | hard voice prohibitions | SC §4 partially | — | respected in sessions | unchanged | prohibition drift | none |

## Sample B — Stage 1 worked examples (`01-stage-stabilisation.md` §11) — classified INDIVIDUALLY

| # | Item | Class | Capability | Duplicate of | Contradicts | Production evidence | Proposed handling | Risk if removed | Owner decision |
|---|---|---|---|---|---|---|---|---|
| B1 | Example A — acute overwhelm ("I'm here. I hear you. You don't have to be calm with me…") | MOVE_TO_DOCUMENTATION | demonstrates regulation-first triage — clinically sound pattern | pattern restated in master `<practice_generation>` hierarchy items 1–2 | "I hear you" is a banned stock phrase (comms, owner-approved 2026-07-20); validation-forward opening | its phrasing class appears in live robotic replies (trace, matrix A2/A3) | keep VERBATIM in the clinical docs (reviewable canon); remove from the runtime prompt only | none clinically (rule survives in master); loses one in-context demonstration of regulation-first | comms 2026-07-20 bans the phrasing; example predates it |
| B2 | Example B — "Quick Return" between-session ritual | MOVE_TO_DOCUMENTATION (candidate KEEP_BUT_CONDENSE if owner wants one portable-practice demo in runtime) | portable self-practice construction — unique demonstration, not stated as a rule anywhere else | partially: practice template SC §5.3 | anchor-phrase step ("I'm not obliged to carry this chaos…") supplies imposed wording — tension with personalisation rule | no live evidence either way | owner choice: docs-only, or a condensed runtime version stripped of fixed phrases | losing the only portable-practice demonstration in runtime | none |
| B3 | Example C — anchor identification ("**Name explicitly** … 'This is your anchor. The blanket.'" + "Why this works: Signature practice run cleanly") | SUPERSEDED | none remaining — demonstrates the exact behaviour the owner banned | — | MASTER §1 "NEVER say 'anchor'…"; same file's §8 (both owner-decided 2026-07-02) | anchor-as-announced behaviour was the 2026-07-02 live-test failure; formula-repetition (10×) observed 2026-07-21 | remove from runtime; keep in docs annotated "superseded 2026-07-02 — retained for history" | none — it contradicts a recorded owner decision | **explicit: clinician sign-off 2026-07-02 (#199/#201)** |

## Sample C — Stage 2 anchor references (`02-stage-pain.md`, 7 sites)

| # | Source text (exact) | Class | Capability | Duplicate of | Contradicts | Production evidence | Proposed handling | Risk if removed | Owner decision |
|---|---|---|---|---|---|---|---|---|
| C1 | §3 "Anchor-Supported Emotional Work — the Stage 1 Anchor is recalled whenever intensity rises. It is the steady reference point of every Stage 2 session." | SUPERSEDED | intensity-response regulation — capability preserved by master practice-generation (regulation/somatic practice on rising intensity) | SC §6 (same regime) | MASTER §1 "NOT a stabilising intervention… not a lever to pull when they wobble" (owner 2026-07-02) | «рука на груди» invoked 10× as soothe in 2026-07-21 session — this regime demonstrably wins over the owner's rule | remove from runtime; the regulation NEED routes to practice generation (already canonical) | none — capability exists in the approved layer | **explicit: 2026-07-02** |
| C2 | §4 "The Anchor is recalled at the first sign of rising intensity — not as a fix, as a return." | SUPERSEDED | same | C1 | same | same | same | same | 2026-07-02 |
| C3 | §8.1 step 1 "**Anchor recall.** Begin with a soft reference to the user's Anchor…" (practice-opening step) | SUPERSEDED + MERGE_WITH §8.1 | opening settle before affect labelling — the SETTLING step is valid; the ANCHOR mechanism is retired | — | 2026-07-02 rule | scripted anchor-openings observed | replace step 1 with "Settle first (brief regulation moment if needed — practice generation)"; **clinical rewording → owner line review required** | losing the settle-first discipline if deleted outright | 2026-07-02 covers mechanism; replacement wording is new — owner must approve |
| C4 | §8.1 step 5 "…and you are here too, with your [anchor]." | SUPERSEDED | closing containment | — | 2026-07-02 | formula-close observed | owner-reviewed rewording (containment without anchor invocation) | losing closing containment | same as C3 |
| C5 | §8.2 step 3 "**Anchor.** Return briefly to the Anchor. 'Stay with [anchor] for a breath.'" | SUPERSEDED | post-inquiry grounding | — | 2026-07-02 | — | owner-reviewed rewording | losing post-inquiry grounding step | same |
| C6 | §8.1 contraindication "do not run if the user has just destabilised (run Anchor recall and Regulation first)" | SUPERSEDED + MERGE_WITH | destabilised-first triage — KEEP the triage, retire the anchor half | master hierarchy item 2 | 2026-07-02 | — | "…(stabilising practice first)" — owner reviews | none (triage preserved) | 2026-07-02 |
| C7 | §9 "The user cannot maintain contact with the Anchor when invited" (abort marker) | CONFLICTING_REQUIRES_OWNER_DECISION | destabilisation detection signal | — | anchor-invitation as a probe is retired; but the SIGNAL (user cannot settle) is clinically real | — | owner decides the replacement abort marker | losing an abort trigger | not covered by 2026-07-02 (that decision addressed soothing, not probing) |

## Sample D — Operational `<examples>` (`journey-master.md`) — classified INDIVIDUALLY

| # | Item | Class | Notes (capability / contradiction / evidence / decision) |
|---|---|---|---|
| D0 | Welcome-message rule (don't re-greet) | KEEP_VERBATIM_IN_RUNTIME | unique operational fact; no conflict |
| D1 | Example 1 — reply contains "That's a real place to start from." | CONFLICTING_REQUIRES_OWNER_DECISION | near-identical to the banned stock phrase "That's a real place to be" (`<communication>`, owner-approved 2026-07-20, added AFTER this example). The currently-approved voice examples themselves carry 3 banned-class phrasings (D1/D3/D4) — fix these BEFORE adding any new RU examples, per the owner's no-new-layer instruction |
| D2 | Example 2 — spiritual-vocabulary matching | KEEP_VERBATIM_IN_RUNTIME | register-matching demo; clean |
| D3 | Example 3 — "What I'm curious about—" | CONFLICTING_REQUIRES_OWNER_DECISION | "I'm curious" is on the banned list (2026-07-20); reply otherwise a good analytic-door demo — needs owner-approved rephrase |
| D4 | Example 4 — "That sounds like a lot to grow up around" | CONFLICTING_REQUIRES_OWNER_DECISION | "That sounds…" banned formula; past-material handling otherwise valuable |
| D5 | Examples 5 + 5b — silent anchor capture / later invocation in user's words | KEEP_VERBATIM_IN_RUNTIME | the canonical demonstration of the 2026-07-02 owner decision — the most load-bearing example in the corpus. Note: 5b shows anchor woven into parts-work regulation; verify wording stays inside the "practice does the stabilising" rule at full-corpus pass |
| D6 | Example 6 — rupture: user corrects the read | KEEP_VERBATIM_IN_RUNTIME | restate-correction-as-truth; directly targets the observed rupture failure (T2) |
| D7 | Example 7 — foreign material, agency held | KEEP_VERBATIM_IN_RUNTIME | trap-1 demonstration; clean |
| D8 | Example 8 — "That's the line." | KEEP_VERBATIM_IN_RUNTIME | declarative clinician leadership — the register the owner wants more of |
| D9 | Example 9 — constrained user | KEEP_VERBATIM_IN_RUNTIME | trap-2 demonstration; clean |
| D10 | Example 10 — noticing without inflating | KEEP_VERBATIM_IN_RUNTIME | trap-9 demonstration; clean |

Per the owner's instruction: NO new RU examples are drafted or added in this phase; the
retained-set question (small multilingual set) is queued until every legacy example
corpus-wide has a classification.

## Sample E — The eight per-stage gate sections ("Completion Criteria (code-enforced gate)" ×8)

Uniform classification with one exception:

| Item | Class | Rationale |
|---|---|---|
| S1 §10, S3 §10, S4, S5, S6, S7, S8 gate sections ("Code holds the user in Stage N until ALL of…") | REMOVE_FROM_RUNTIME_ONLY | The gates LIVE IN CODE (`stage-gates.ts`) — the authoritative copy is not the prompt. In runtime these sections (a) contradict the PR λ "bookkeeping, not capability gates" header the model is told to follow, (b) teach the model to withhold `recommendedAction:'advance'` except at share-back (matrix E3 — gate starvation), (c) add 8× boilerplate mass. Capability lost from runtime: none (code enforces; prompt copy is descriptive). They REMAIN VERBATIM in the clinical docs as the reviewable spec of what code must implement. Evidence of interference: E3 + B1 in the contradiction matrix. Owner decision needed only to confirm; no clinical content is altered. |
| S2 §2/§10 gate text containing "`anchorText` set" and anchor-linked criteria | SUPERSEDED (within the above) | The anchor requirement was owner-retired 2026-07-02; the code still enforcing it is a Phase 4 item (frozen), but the PROMPT copy's claim is false either way. |

Cross-cutting note for the full pass (not acted on now): the 9 "Status: draft for
clinical review" headers and the Shared Core's stale drafting end-note are
REMOVE_FROM_RUNTIME_ONLY candidates of the same kind — metadata, not method.

---

## Process for the full corpus (after template approval)

1. Owner approves/edits this template + sample classifications (especially every
   CONFLICTING row — those are hers alone).
2. Full disposition table produced for ALL remaining sections (Shared Core §§1–10, PGA,
   S1–S8 complete, master layer, Sensitivity Layer) — same columns, same evidence
   standard, committed for line review. No file edits until the owner signs off the
   table.
3. Only then: an edit PR that implements EXACTLY the approved dispositions, validated by
   a byte-level diff manifest (every removed/condensed span listed against its approved
   row) and a golden-harness comparison run before any merge.
