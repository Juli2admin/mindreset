# Doc 5 — CLEANUP ROADMAP (sequence only)

A proposed **order** for eventual cleanup, with dependencies and risk tiers.
This document proposes **no implementation and no fixes** — only the sequence in
which the work should be approached, and which steps cannot even be *specified*
until the owner adjudicates a coexisting generation. Development remains frozen;
nothing here is authorised by this document.

Two kinds of step appear below:

- **[MECHANICAL]** — behaviour-preserving by construction (documentation that
  matches code to reality, or removal of code proven to have no reader). No
  clinical decision required; only verification.
- **[DECISION-GATED]** — cannot be specified until the owner picks which of two
  live generations is canonical (see Doc 3 §5 and Doc 4 §3). The cleanup here is
  *reconciliation*, and reconciliation direction is the owner's call.

---

## Phase 0 — Ratify the canon (prerequisite for everything)

0.1 Owner reviews this canon set (Docs 1–4) and confirms it as the single
    source of truth for the current system.
0.2 Owner records, per standing conflict (Doc 4 §3, A–I), **which generation is
    canonical** — or explicitly defers each. This is the gate for every
    [DECISION-GATED] step below. No code moves before this.

*Dependency: none. Everything else depends on 0.2.*

---

## Phase 1 — Documentation reconciliation  [MECHANICAL, lowest risk]

Make the code's own comments/schema tell the truth. Zero runtime behaviour
change; makes every later step safer to reason about. Can proceed independently
of the decision-gated work.

1.1 Correct stale doc-strings/comments that misdescribe the code: the
    "Returns 5 blocks / active stage spec" doc-string (all 8, 4 blocks); the
    "~3,200 tokens static" and "~76k" size notes.
1.2 Correct schema comments that claim gate consumption the code does not have:
    `bridgeAchievedAt`, `userGrounded`, and the stale "router does NOT read
    `moveJustPerformed`" note.

*Dependency: Phase 0. Risk: none (comments only).*

---

## Phase 2 — Resolve the NOT PROVEN items  [MECHANICAL — verification, not change]

Before removing anything, close the open evidence gaps from Doc 3 §8 so that
"dead" is proven, not assumed.

2.1 Confirm whether any analytics/admin/export surface reads the
    `JourneyPracticeRun` child fields, the AUDIT-ONLY report fields, or the DEAD
    fields (`therapeuticMode`, `cycleCanClose`, `nextBestMode`).
2.2 Confirm the `originIdentified → originDescription` write-gap is intended-vs-
    accidental (it is currently a dead write-target).

*Dependency: Phase 0. Risk: none (read-only verification). Gates Phase 3.*

---

## Phase 3 — Remove proven-dead / unreachable code  [MECHANICAL, behaviour-preserving]

Only items proven to have **no** reader in Phase 2. Ordered smallest-blast-
radius first. (Removal specifics are out of scope for this roadmap.)

3.1 Unreachable prompt-assembly fallback + the mutual-recursion path, and the
    code only it reaches (`assembleSystemPrompt`, `loadStageSpec` single-active
    path, `loadEngineeredStagePrompt`, `runtime/stage-01/02.md`, `DIVIDER`,
    `STATE_REPORT_FORMAT_INSTRUCTION` — the vestigial Generation-B schema).
3.2 Vestigial constants/branches with no reader: the `'manual'` freeze source;
    the `recommendedDepth` branch (and, if the owner agrees `currentDepth` is
    inert, the depth plumbing).
3.3 DEAD state-report fields confirmed inert in Phase 2.

*Dependency: Phase 2 (proof of no reader). Risk: low — behaviour-preserving if
Phase 2 is clean. Note: the `<assessment>` strip is deliberately retained as a
safety net; it is NOT proposed for removal here.*

---

## Phase 4 — Reconcile the coexisting generations  [DECISION-GATED]

Each step is blocked on the matching Phase-0.2 decision. They are ordered so
that the **subsuming** decision is taken before the ones it contains, to avoid
reconciling a sub-part in a direction the larger decision later reverses.

4.1 **The subsuming decision — flexible map vs sequential engine (Conflict A,
    D14).** This governs 4.2–4.4. Until the owner fixes whether stages are
    labels or gates, the sub-reconciliations below cannot be specified without
    risking rework.

4.2 **Anchor: retire vs enforce (Conflict B, D8).** Downstream of 4.1 (an
    anchor requirement only means something within a gated model). Covers the
    gate checks *and* the prompt survivals (Shared Core §6, stage examples)
    together, so the two do not drift again.

4.3 **The two advance lanes (Conflict H, D10).** Downstream of 4.1 — whether
    two lanes should exist at all depends on the map-vs-engine decision.

4.4 **The two open-cycle definitions (Doc 2 §4).** Downstream of 4.1/4.3 —
    which consumer's definition (prompt vs router) becomes canonical follows
    from how routing is meant to work.

4.5 **Analyse-before-speak vs reply-first (Conflict C, D11/D12).** Independent
    of 4.1; a latency-vs-fidelity call. (The separately-approved Extended-
    Thinking experiment is the evidence input for this one; it stays out of
    production until decided.)

4.6 **Anti-echo vs echo exemplars (Conflict D, D19).** Independent of 4.1; a
    corpus-reconciliation call over the specs. Large surface; the owner must
    review every clinical reduction (per the standing rule that "methodology
    preserved" is not established merely because meaning looks similar after
    summarisation).

4.7 **Closure discipline and task contract (D17 P2/P3).** Decide whether these
    remain prompt-only self-enforcement or gain a code reader. Downstream of
    4.1 (both are engine questions).

*Dependency: each on its Phase-0.2 decision, plus the intra-phase ordering
above. Risk: HIGH — these change clinical behaviour; each needs the golden
harness (already built) as the before/after guard.*

---

## Phase 5 — Documentary authority  [DECISION-GATED, low code risk]

5.1 Decide the standing of `CLINICAL_MANUAL.md` (Conflict G): either give it
    runtime reach or retire its "source of truth" claim. Doc-level, but it is a
    stated owner authority, so it is the owner's call.
5.2 Decide the fate of the un-authored owner layers (the ten continuous
    questions; the five silent questions now unenforced) — author, encode, or
    formally shelve.

*Dependency: Phase 0. Risk: low in code, high in method.*

---

## Dependency summary

```
Phase 0 (ratify + per-conflict decisions)
   ├─ Phase 1 (doc reconciliation)            [independent, do early]
   ├─ Phase 2 (prove NOT PROVEN) ─ Phase 3 (remove dead code)
   ├─ Phase 4 (reconcile generations)
   │     4.1 map-vs-engine ─┬─ 4.2 anchor
   │                        ├─ 4.3 advance lanes ─ 4.4 open-cycle
   │                        └─ 4.7 closure/contract
   │     4.5 reply-first   [independent]
   │     4.6 anti-echo     [independent]
   └─ Phase 5 (documentary authority + un-authored layers)
```

## Sequencing rationale

- **Nothing behavioural moves before Phase 0.2.** The whole point of the freeze
  is that the system currently runs two answers to several questions; picking
  the canonical answer is a prerequisite, not an implementation detail.
- **Mechanical work (1–3) first** because it is behaviour-preserving and shrinks
  the surface the harder decisions must reason over — fewer vestigial paths to
  account for when reconciling generations.
- **The subsuming decision (4.1) before its parts** because anchor, lanes, and
  open-cycle are all facets of "is the stage a label or a gate"; specifying them
  first risks reconciling in a direction 4.1 later reverses.
- **Every Phase-4 step is guarded by the golden harness** (recorded + live
  arms already built) so any behavioural reconciliation has an objective
  before/after, not an impression.

This roadmap proposes order and dependency only. It specifies no change, writes
no fix, and authorises no work.
