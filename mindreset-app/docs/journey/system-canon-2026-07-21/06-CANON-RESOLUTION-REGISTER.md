# Doc 6 — CANON RESOLUTION REGISTER

Owner-reviewable decision register. Every confirmed conflict, duplication,
obsolete instruction, dead field and competing authority from the System Canon
(Docs 1–4), turned into one row Julia can approve. After approval, a developer
should be able to build a clean-runtime branch by **removal and reconciliation
only** — no new behavioural layer.

**This document changes nothing.** No code edited, no prompt edited, nothing
removed, no PR opened.

### How to read a row
Each row has the 12 required fields. Field 6 quotes the **latest explicit owner
decision** as recorded, with date + source and the timeline's evidence grade
(**OWNER** = recorded owner sign-off; **ATTRIBUTED** = commit claims owner
philosophy, uncorroborated; **NOT PROVEN** = implementation-only). Where no
explicit owner decision exists, field 6 and field 8 read **OWNER DECISION
REQUIRED** and no survivor is invented. Impact tags (field 5): `[reply]`
visible reply · `[move]` clinical move · `[mem]` memory · `[safety]` safety ·
`[prog]` progression · `[tel]` telemetry-only.

A survivor is proposed in field 8 **only** where an explicit owner decision
dictates it. "Behaviour-preserving removal" (dead code/fields with zero
readers) needs no *behavioural* decision — only approval to touch frozen code —
and is marked as such.

Source of every code citation: the six evidence agents behind Docs 1–3;
`file:line` is under `mindreset-app/`.

---

# CANON DECISIONS RECORDED 2026-07-21 (owner-approved, authoritative)

These eight decisions were recorded by the owner after reviewing this register.
They supersede the `OWNER DECISION REQUIRED` markers for the mapped rows below.
The runtime is still frozen; recording a decision authorises **planning only**,
not implementation.

1. **Stages** — eight-stage methodology, but stages are a **flexible clinical
   map, not rigid capability gates**. The current stage is the user's primary
   phase; it must not prevent an appropriate move from another stage when the
   user is regulated & oriented, the material has emerged, the move is
   clinically appropriate, the user has not refused the modality/direction, and
   no unresolved cycle makes it unsafe. **Safety, readiness, consent, modality
   and open-cycle discipline remain binding. Stage number alone is not a
   prohibition.**
2. **Anchor** — an internally observed positive lived reality: **not required
   for progression at any stage; never announced as "your anchor"; not
   auto-invoked to soothe/stabilise/close; captured silently; usable only as
   ordinary context when relevant. Remove anchor as a gate requirement across
   Stages 1–8; preserve its internal observational value.**
3. **Reply generation** — **keep reply-first; do not reinstate the assessment
   block; do not merge Extended Thinking; do not add a new reasoning layer.**
   Reassess visible-reply quality after contradictions/exemplars are cleaned.
4. **Assessment & intervention** — assessment precedes intervention
   *conceptually*, not by a fixed session count/stage. Before a practice or deep
   move the clinician must have enough evidence about request, state/regulation,
   desired depth, processing channel, working hypothesis, and purpose. Same-
   session deep moves allowed when readiness is clear. **Keyword-/programme-
   triggered intervention without sufficient understanding is not allowed.**
5. **Body & imagery** — optional channels; offer gently when relevant; **after
   a clear refusal/non-response, switch to another channel immediately and do
   not return unless the user reopens it.**
6. **Consolidation & discharge** — **do not manufacture a wound/pattern/depth.**
   When the user reports no meaningful unresolved problem and evidence supports
   it, consolidation / natural completion / discharge are legitimate; lighter
   support may be offered; the clinician may honestly say deeper work exists but
   no current indication is established. **Do not keep digging merely because
   more stages exist.**
7. **Open cycle** — one canonical definition for all consumers: `open` (active
   process not at a safe stopping point), `closing` (completion begun,
   regulation/closure unconfirmed), `closed` (safe stopping point reached).
   **Both `open` and `closing` block starting a new deep process.** A session
   boundary alone does not convert unfinished → closed; on resume the old cycle
   is remembered as unfinished context but not auto-reopened without a current
   user signal.
8. **Memory scope** — preserve existing memory structures; **create no new
   correction tables / memory architecture**; prepare a **bounded, preferably
   migration-free** proposal to prevent destructive continuity-note overwrite
   and silent middle truncation. Durable stores for corrected facts, rejected
   hypotheses, repeated-question prevention, rejected topics, and pattern/part
   invalidation are a **separate future design track**.

## Mandatory non-destructive safety protocol (applies to every resulting PR)

Immutable production baseline · separate clean-runtime branch · **one bounded
category per PR** · **removal from runtime before deletion from repository** ·
full traceability + rollback · **Golden Harness comparison after every PR** ·
**tester-only exposure behind a runtime switch for behavioural changes** · **no
irreversible migration**.

## Resolution map — every register row marked

| Row | Governing decision | Canonical survivor (now recorded) | Status | Target PR |
|---|---|---|---|---|
| V1 anti-echo vs mirror | #329 (07-20), reaffirmed | `<communication>` rule wins; mirror exemplars reconciled to it | RESOLVED | PR B |
| V2 validation vs "I hear you" | #329 (07-20) | restraint rule; stock validation removed | RESOLVED | PR B |
| V3 natural conv vs ceremony | D1, D2, #329 | move-announcing + anchor ceremony removed; plain voice | RESOLVED | PR B |
| V4 tentative vs declarative origin | #329, D4 | tentative framing; no declarative in-line diagnosis | RESOLVED | PR B |
| V5 leadership vs ask-more-than-tell | D1, D4, D6 | clinician leads with appropriate moves | RESOLVED | PR B (voice) + PR C (behaviour) |
| V6 digging after "no problem" | D6 | consolidation legitimate; do not manufacture depth | RESOLVED | PR C (+PR B voice) |
| V7 consolidation vs "always underneath" | D6 | natural completion/discharge legitimate | RESOLVED | PR C |
| C1 flexible map vs sequential engine | D1 | flexible map; safety/readiness/consent/modality/open-cycle binding; stage# not a prohibition | RESOLVED | PR C |
| C2 cross-stage moves | D1 | permitted under the 5 conditions | RESOLVED | PR C |
| C3 assessment before intervention | D4 | assessment-first conceptually; same-session deep move when readiness clear | RESOLVED | PR C |
| C4 body/imagery optionality | D5 | optional; on refusal switch channel, don't return unless reopened | RESOLVED | PR C (+PR B voice) |
| C5 practice triggers | D4 | no keyword/programme-triggered practice without sufficient understanding | RESOLVED | PR C |
| C6 foreign-material/parts permissions | D1 | permitted when regulated/emerged/appropriate/not-refused/no-unsafe-cycle | RESOLVED | PR C |
| A1 anchor | D2 | observation-only; remove gate requirement Stages 1–8; never announced; not auto-soothe/close; preserve internal value | RESOLVED | PR B (prompt) + PR C (gate) |
| M1 continuity overwrite/truncation | D8 | bounded non-destructive fix, preferably no migration | RESOLVED (scope) | PR D |
| M2 corrected facts | D8 | out of scope — future design track | DEFERRED | — |
| M3 rejected hypotheses | D8 | out of scope — future design track | DEFERRED | — |
| M4 rejected topics/modalities | D8 | preserve existing modality echo (M4 is already wired) | RESOLVED (keep) | — |
| M5 repeated-question prevention | D8 | out of scope — future design track | DEFERRED | — |
| M6 pattern/part correction | D8 | out of scope — future design track | DEFERRED | — |
| S1 two advancement lanes | D1 | reconcile to the flexible-map readiness model; readiness/safety/consent/open-cycle bind, stage# does not | RESOLVED (principle) | PR C |
| S2 two open-cycle definitions | D7 | one definition (open/closing/closed); open+closing block new deep process; boundary≠closed; resume = remembered, not auto-reopened | RESOLVED | PR C |
| S3 dead `currentDepth` | behaviour-preserving | remove dead `recommendedDepth` branch + inert prompt echo; keep DB column (no migration) | RESOLVED | PR A |
| S4 unused `cycleCanClose` | behaviour-preserving | remove parse handling + emit instruction | RESOLVED | PR A |
| S5 unused `stabilityCheck.score` | D6 (no code reader added) | keep field (inspector uses it); do not code-enforce closure | RESOLVED (keep) | — |
| S6 close/discharge authority | D1, D6 | consolidation/discharge legitimate; Stage-8 clinical evidence; reconcile | RESOLVED | PR C |
| S7 state-report schemas + unreachable fallback | behaviour-preserving | keep Generation A; remove Generation B + unreachable fallback + dead loaders | RESOLVED | PR A |

Also recorded (was Part-2 item, not a row): **reply-first architecture is
canonical** (D3) — no assessment block, no Extended-Thinking merge, no new
reasoning layer.

The exact, line-level plans for **PR A** (behaviour-preserving cleanup) and
**PR B** (approved visible-communication + anchor cleanup) are in
[07-PR-A-AND-B-PLANS.md](07-PR-A-AND-B-PLANS.md). PR C (stage/progression
reconciliation) and PR D (bounded memory fix) are scoped there but not yet
planned line-by-line, pending this planning round's completion.

---

# GROUP 1 — VISIBLE COMMUNICATION

## V1 — Anti-echo rule vs mirror/reflect exemplars
1. **Domain:** visible reply voice — paraphrase/echo of the user's words.
2. **Source A:** the `<communication>` section of `journey-master.md`
   (introduced #329, 2026-07-20).
3. **Source B:** the mirror/reflect exemplars distributed across the 8 stage
   specs + Shared Core (representative: `00-shared-core.md` voice section;
   `01…08` worked examples), sent in Block 1 every turn.
4. **What each instructs:** A bans paraphrasing/echoing and the
   echo→interpretation→question shape. B *models* reflect-and-mirror as the
   method's own voice across many worked examples.
5. **Affects:** `[reply]` `[move]`.
6. **Latest owner decision:** 2026-07-20, `<communication>` section —
   *"owner-approved wording… owner corrections included verbatim"* (#329;
   `03-owner-decision-timeline.md:25`, grade **OWNER**). Timeline note:
   *"pure insertion over 812 contrary exemplars… one day old at the time of the
   2026-07-21 test session."*
7. **Status:** partially shipped (rule inserted; exemplars not reconciled) →
   later-contradicting corpus present.
8. **Proposed survivor:** the `<communication>` rule (latest explicit OWNER
   decision). Contradicting exemplars reconciled to it.
9. **Leaves runtime:** the mirror/reflect exemplar snippets in the stage specs
   that model echoing (exact snippet enumeration is a mechanical pass; the
   files load into Block 1 every turn).
10. **Remains in docs:** the `<communication>` section itself; the specs as the
    reviewable clinical manual (edited, not deleted).
11. **Removal risk:** HIGH — prompt-corpus edit touching clinical voice; every
    reduction is owner-reviewed (a summary that "looks similar" is not proof the
    method is preserved).
12. **Regression tests:** golden-harness `stock-phrase` and `restating-opening`
    metrics ≤ baseline; live-arm who-leads judge ≥ baseline; RU/EN reply corpus
    manually spot-checked by owner.

## V2 — Validation restraint vs "I hear you" exemplars
1. **Domain:** reflexive validation openings.
2. **Source A:** `<communication>` section — bans routine validation and stock
   phrasing ("I hear you / that sounds…").
3. **Source B:** "I hear you / I hear that" modelled as the method's voice
   across ~6 stage docs (prior audit: "9 exemplars : 1 ban"; exact lines are a
   mechanical enumeration).
4. **What each instructs:** A: no stock validation. B: uses it as canonical.
5. **Affects:** `[reply]`.
6. **Latest owner decision:** same as V1 (#329, 2026-07-20, **OWNER**).
7. **Status:** partially shipped (rule in, exemplars not reconciled).
8. **Proposed survivor:** the restraint rule (per #329).
9. **Leaves runtime:** the "I hear you"-class exemplar lines in the stage specs.
10. **Remains in docs:** the restraint rule; edited specs.
11. **Removal risk:** HIGH (clinical voice).
12. **Regression tests:** harness `stock-phrase` metric (EN + RU lexicon) → 0
    on the julia fixture; owner spot-check.

## V3 — Natural conversation vs therapeutic ceremony
1. **Domain:** ritualised openings/closings and move-announcing ("ceremony").
2. **Source A:** `<communication>` section — bans announcing moves; Shared Core
   voice ("nameless AI, plain British English").
3. **Source B:** ceremony patterns in the specs — opening-ritual lines and the
   anchor ceremony (overlaps Anchor group A1).
4. **What each instructs:** A: plain, un-announced. B: scripted ritual framing.
5. **Affects:** `[reply]` `[move]`.
6. **Latest owner decision:** #329 anti-echo covers move-announcing (**OWNER**);
   ceremony-as-such (e.g. opening rituals) has **no explicit owner decision** →
   **OWNER DECISION REQUIRED** for the non-move-announcing ceremony.
7. **Status:** partial (announcing banned; broader ceremony undecided).
8. **Proposed survivor:** move-announcing removed per #329; broader ceremony →
   OWNER DECISION REQUIRED.
9. **Leaves runtime (if approved):** move-announcing lines; ceremony lines only
   if owner decides.
10. **Remains in docs:** the voice rules; specs.
11. **Removal risk:** MEDIUM-HIGH.
12. **Regression tests:** harness reply-quality/who-leads judge; owner review.

## V4 — Tentative hypothesis vs declarative origin statements
1. **Domain:** how causal/origin claims are voiced ("this comes from X" as fact
   vs as offer).
2. **Source A:** `<communication>` section — bans real-time diagnosing.
3. **Source B:** stage exemplars that state origins declaratively
   (the targeted A/B observed declarative origin framing on T14/T20).
4. **What each instructs:** A: don't diagnose in-line. B: models declarative
   "this is her fear, you took it" framing.
5. **Affects:** `[reply]` `[move]`.
6. **Latest owner decision:** #329 (**OWNER**) covers "no real-time diagnosing";
   whether tentative-vs-declarative is fully covered is **partially explicit** →
   OWNER DECISION REQUIRED to confirm the tentative-framing rule.
7. **Status:** partial.
8. **Proposed survivor:** tentative framing where #329 dictates; explicit
   confirmation → OWNER DECISION REQUIRED.
9. **Leaves runtime (if approved):** declarative-origin exemplar lines.
10. **Remains in docs:** the diagnosing ban; specs.
11. **Removal risk:** HIGH (core clinical voice).
12. **Regression tests:** live-arm `unsupported-hypothesis` and `conflation`
    judges ≤ baseline.

## V5 — Intelligent clinician leadership vs ask-more-than-tell
1. **Domain:** who leads the session ("student, I lead it follows").
2. **Source A:** `<communication>` section — bans the
   echo→interpretation→question shape; notes routine validation "lands worst
   with self-sufficient users."
3. **Source B:** the question-ending exemplar shape across specs; the
   concession-opening tendency measured in the 2026-07-21 baseline (3/25 turns).
4. **What each instructs:** A: lead. B: models hand-back-to-user questioning.
5. **Affects:** `[reply]` `[move]`.
6. **Latest owner decision:** #329 leans here (**OWNER**), but "lead vs follow"
   is not a crisp dated rule — owner's "student, I lead it follows" is verbal
   feedback, not a dated decision → **OWNER DECISION REQUIRED** to make it a
   rule.
7. **Status:** no explicit rule (partial via #329).
8. **Proposed survivor:** OWNER DECISION REQUIRED.
9. **Leaves runtime (if approved):** ask-more-than-tell exemplar bias (corpus
   edit).
10. **Remains in docs:** specs.
11. **Removal risk:** HIGH.
12. **Regression tests:** live-arm who-leads judge (headline metric);
    `concession-opening` harness metric ≤ baseline.

## V6 — Repeated digging after the user reports no unresolved problem
1. **Domain:** continuing to probe after the user signals resolution/enough.
2. **Source A:** closure-discipline guidance (P2, #327/#328) in the master.
3. **Source B:** the "go deeper" bias in the specs + the open-cycle machinery
   that keeps a cycle "open" (router.ts:76; load.ts:428).
4. **What each instructs:** A: don't force closure prematurely / respect the
   stop. B: keeps surfacing "what's underneath."
5. **Affects:** `[reply]` `[move]` `[prog]`.
6. **Latest owner decision:** P2 closure discipline shipped as prompt text
   (2026-07-19, curated remediation subset; `03-…timeline.md:24`) — **not
   owner-graded OWNER**, and there is no explicit decision that the AI must
   *stop* on a user "no problem." → **OWNER DECISION REQUIRED**.
7. **Status:** partial (prompt-only, no code reader).
8. **Proposed survivor:** OWNER DECISION REQUIRED.
9. **Leaves runtime (if approved):** none by removal — this is a rule
   clarification, not a deletion (flagged: may need reconciliation not removal).
10. **Remains in docs:** closure-discipline text.
11. **Removal risk:** MEDIUM.
12. **Regression tests:** a fixture where the user reports resolution → reply
    does not re-open; harness `repeated-question` metric.

## V7 — Natural consolidation/discharge vs "there is always something underneath"
1. **Domain:** allowing a session to consolidate/close vs perpetual depth.
2. **Source A:** closure/discharge guidance + Stage-8 discharge gate
   (stage-gates.ts:573-651).
3. **Source B:** the open-cycle "keep going" framing and depth exemplars.
4. **What each instructs:** A: consolidation is a legitimate end. B: implies
   unfinished depth remains.
5. **Affects:** `[reply]` `[move]` `[prog]`.
6. **Latest owner decision:** no explicit decision on the "always something
   underneath" tension → **OWNER DECISION REQUIRED**.
7. **Status:** no owner decision.
8. **Proposed survivor:** OWNER DECISION REQUIRED.
9. **Leaves runtime (if approved):** depends on decision.
10. **Remains in docs:** discharge spec; closure text.
11. **Removal risk:** MEDIUM.
12. **Regression tests:** discharge-scenario fixture; who-leads + reply-quality.

---

# GROUP 2 — CLINICAL METHODOLOGY

## C1 — Flexible clinician map vs sequential stage engine
1. **Domain:** whether stages are labels or gates (the deepest structural split).
2. **Source A:** PR λ prompt framing — "stage = bookkeeping label… NOT
   capability gates"; all 8 specs loaded every turn (assemble.ts:532-544;
   canon header assemble.ts:473-483).
3. **Source B:** the gates + router that enforce a sequence
   (stage-gates.ts all gates; router.ts:57-145; both advance lanes).
4. **What each instructs:** A: lead freely, stage is cosmetic. B: code blocks
   movement until per-stage criteria pass.
5. **Affects:** `[move]` `[prog]`.
6. **Latest owner decision:** 2026-07-11 PR λ — *"stage = bookkeeping label…
   NOT capability gates" ("Julia's philosophy" per commit)*
   (`03-…timeline.md:21`, grade **ATTRIBUTED (unverified)**). No OWNER-graded
   decision resolves the prompt-vs-engine split.
7. **Status:** partially shipped (prompt pivoted; engine sequential) →
   standing contradiction.
8. **Proposed survivor:** **OWNER DECISION REQUIRED** (latest is ATTRIBUTED,
   not explicit; cannot base a survivor on it). This decision **subsumes** A1
   (anchor), C2, S1, S2, S6.
9. **Leaves runtime (if flexible chosen):** the per-stage gate criteria +
   router lanes. **(if sequential chosen):** the "stage is a label" framing +
   all-8-specs loading. Not decidable without the owner.
10. **Remains in docs:** the specs either way.
11. **Removal risk:** HIGHEST — changes the engine's core contract.
12. **Regression tests:** full router gate suite; golden-harness progression on
    the julia fixture; owner review of stage behaviour.

## C2 — Cross-stage clinical moves vs stage-restricted specifications
1. **Domain:** using a Stage-6 move at Stage 1, etc.
2. **Source A:** flexible-map framing + all-8-specs loading (moves from any
   stage visible every turn).
3. **Source B:** per-stage prohibitions inside the specs and the gate sections
   that assume sequence.
4. **What each instructs:** A: any move now. B: this stage forbids these moves.
5. **Affects:** `[move]` `[prog]` `[safety]` (deep work early).
6. **Latest owner decision:** same as C1 (ATTRIBUTED) → **OWNER DECISION
   REQUIRED**.
7. **Status:** partial / conflicting.
8. **Proposed survivor:** downstream of C1 → OWNER DECISION REQUIRED.
9. **Leaves runtime:** per C1 outcome.
10. **Remains in docs:** specs.
11. **Removal risk:** HIGH (safety-adjacent: parts/foreign-material early).
12. **Regression tests:** a Stage-1 fixture must not trigger parts/foreign
    release under the chosen rule; safety-lane behaviour unchanged.

## C3 — Assessment before intervention
1. **Domain:** wide assessment first vs same-turn intervention/practice.
2. **Source A:** `<assessment_phase>` (#130) — "GO WIDE BEFORE YOU GO DEEP";
   Block 1 whitelist.
3. **Source B:** flexible-map license + practice-generation triggers that fire
   a practice in the same turn (premature-practice measured 3/3 on the first
   three turns of the julia fixture).
4. **What each instructs:** A: hold deep moves across sessions. B: intervene now.
5. **Affects:** `[move]` `[prog]` `[safety]`.
6. **Latest owner decision:** #130 is **NOT PROVEN (live-test-driven)**; no
   OWNER-graded reconciliation with same-turn practice → **OWNER DECISION
   REQUIRED**.
7. **Status:** conflicting.
8. **Proposed survivor:** OWNER DECISION REQUIRED (tied to C1/C5).
9. **Leaves runtime:** per decision (practice-trigger timing or the wide-first
   rule).
10. **Remains in docs:** assessment spec; PGA.
11. **Removal risk:** HIGH.
12. **Regression tests:** first-three-turns fixture → practice fires only per
    the chosen rule; harness `premature-practice` metric.

## C4 — Body/imagery optionality
1. **Domain:** whether body/imagery work is offered-optional or pushed.
2. **Source A:** channel-family guidance rendered from `channel`
   (assemble.ts:202-207) + body-oriented exemplars.
3. **Source B:** (owner's method) body/imagery should be optional, not imposed
   — **not encoded as an explicit rule**.
4. **What each instructs:** A: steers toward the detected channel (incl. body).
   B: no explicit optionality rule exists.
5. **Affects:** `[reply]` `[move]`.
6. **Latest owner decision:** none found → **OWNER DECISION REQUIRED**.
7. **Status:** no owner decision.
8. **Proposed survivor:** OWNER DECISION REQUIRED.
9. **Leaves runtime (if approved):** body-pushing exemplar bias (corpus edit).
10. **Remains in docs:** channel guidance.
11. **Removal risk:** MEDIUM.
12. **Regression tests:** body-refusal fixture → reply respects refusal;
    harness `body-question` metric.

## C5 — Practice triggers
1. **Domain:** when a practice is generated/offered.
2. **Source A:** Practice Generation Algorithm loaded verbatim (D9, owner) with
   proactive triggers.
3. **Source B:** assessment-first (C3) + the premature-practice observation.
4. **What each instructs:** A: triggers may fire early. B: hold until assessed.
5. **Affects:** `[move]` `[prog]`.
6. **Latest owner decision:** 2026-07-04 PGA loaded verbatim (**OWNER**,
   `03-…timeline.md:16`); trigger *timing* vs assessment-first is unreconciled →
   **OWNER DECISION REQUIRED** for the timing rule.
7. **Status:** partial (PGA shipped; timing unreconciled).
8. **Proposed survivor:** PGA content stays (owner-approved); trigger timing →
   OWNER DECISION REQUIRED (tied to C3).
9. **Leaves runtime (if approved):** early-trigger conditions only if owner
   restricts them.
10. **Remains in docs:** PGA.
11. **Removal risk:** MEDIUM-HIGH.
12. **Regression tests:** `premature-practice` metric; practice-run parse
    integrity.

## C6 — Foreign-material and parts permissions
1. **Domain:** when parts work / foreign-material release is permitted.
2. **Source A:** flexible-map + PGA make parts/foreign moves available any turn;
   save-path wires them (save.ts:189-487).
3. **Source B:** Block 1 whitelist / assessment-only Stage 1 forbids them early.
4. **What each instructs:** A: available now. B: not until later stages.
5. **Affects:** `[move]` `[prog]` `[safety]`.
6. **Latest owner decision:** no explicit reconciliation → **OWNER DECISION
   REQUIRED** (downstream of C1).
7. **Status:** conflicting.
8. **Proposed survivor:** OWNER DECISION REQUIRED.
9. **Leaves runtime:** per C1/C3 decision.
10. **Remains in docs:** stage specs 4/5.
11. **Removal risk:** HIGH (safety).
12. **Regression tests:** Stage-1 fixture → no foreign-release; Stage-5 release
    semantics (claim/confirm/invalidate) unchanged.

---

# GROUP 3 — ANCHOR

## A1 — Anchor: 2026-07-02 decision vs every surviving enforcement/reference
1. **Domain:** the anchor — definition, gate, and prompt recall.
2. **Source A (the decision):** anchor = observed positive reality, never
   spoken, not a stabilising/soothe/close move; gate checks to be removed.
3. **Source B (surviving contradictions, all live):**
   - Gate: `stage-gates.ts:113` `anchor_not_set`, `:121`
     `anchor_identified_token_missing`; `anchorText` required `:154,202,248,332,405`;
     `identityAnchor` required `:406,478,583`.
   - Move-based lane **bypass**: `move-based-advance.ts` reads no anchor field.
   - Prompt: `00-shared-core.md:187-193` §6 "recalls it gently whenever
     intensity rises"; `01-stage-stabilisation.md:214` Ex.C "This is your
     anchor. The blanket." (and `:148` false "dropped from the gate" claim);
     `02-stage-pain.md` ×7 anchor-recall lines; dead-path
     `runtime/stage-01.md:173`.
4. **What each instructs:** A: observe, never name, don't use to soothe/close,
   don't gate on it. B: the gate hard-requires it AND the prompt scripts naming
   it as a soothe/close move (measured: anchor formula invoked repeatedly in the
   2026-07-21 session).
5. **Affects:** `[reply]` `[move]` `[prog]`.
6. **Latest owner decision:** 2026-07-02 — *"anchor = positive lived reality,
   observation-only, NEVER spoken, NOT a stabilising move"*; commit
   *"explicitly promised a follow-up code PR removing
   `anchor_not_set`/`anchor_identified_token_missing` from the Stage-1 gate"*
   (`03-owner-decision-timeline.md:15`, grade **OWNER**;
   *"the most-violated decision in the corpus"*).
7. **Status:** **never shipped** (code removal) + later-contradicting prompt
   survivals. The remediation fix `4d08114` was never merged.
8. **Proposed survivor:** the 2026-07-02 decision (explicit OWNER). Anchor
   becomes observation-only; gate anchor-checks removed; soothe/close recalls
   removed.
9. **Leaves runtime:** `stage-gates.ts` anchor checks (`:113,121`) and the
   `anchorText`/`identityAnchor` gate requirements **iff** the owner confirms
   anchors should no longer gate (see note); the anchor-recall prompt lines
   (`00-shared-core.md:187-193`; `01-stage-stabilisation.md:214`;
   `02-stage-pain.md` ×7); the dead `runtime/stage-01.md`.
10. **Remains in docs:** the anchor *definition* (observed reality) in the
    specs, corrected to remove naming/soothe framing.
11. **Removal risk:** HIGH — anchor is load-bearing across 6 gates; removing the
    *gate requirement* is a progression change (overlaps C1). Removing the
    *prompt naming/soothe* is lower risk and directly dictated by the decision.
    **Note:** the decision explicitly covers the Stage-1 gate tokens; whether to
    drop `anchorText`/`identityAnchor` as gate requirements at later stages is
    downstream of C1 and may be **OWNER DECISION REQUIRED** for those stages.
12. **Regression tests:** harness `anchor-invocation` metric → 0; gate unit
    test: Stage-1 advance no longer requires anchor tokens; RU/EN replies never
    say "твой якорь"/"your anchor"/"this is your anchor"; router progression
    unchanged except the intended anchor relaxation.

---

# GROUP 4 — MEMORY

*Note: most memory items are gaps (missing mechanism), not duplications. A
removal-only branch can reconcile existing memory logic (M1) but cannot build
new correction stores (M2, M3, M5, M6) without a new behavioural layer — those
are flagged OUT OF SCOPE for the clean-runtime branch and require an explicit
design decision.*

## M1 — Continuity-note overwrite and truncation
1. **Domain:** cross-turn memory carried in `continuityNote`.
2. **Source A:** save — `save.ts:118` full-column **overwrite** (only when the
   model emits the field; else untouched).
3. **Source B:** render — `assemble.ts:427-438` head-400 + tail-300 truncation
   at 800 chars (middle dropped); gated behind `hasHistoricalContent`.
4. **What each instructs:** A: the model must re-emit the whole note or history
   is lost; code never merges. B: long notes silently lose their middle.
5. **Affects:** `[mem]`.
6. **Latest owner decision:** none → **OWNER DECISION REQUIRED** (is
   overwrite-and-truncate intended, or should it append/summarise?).
7. **Status:** no owner decision (behaviour-as-built).
8. **Proposed survivor:** OWNER DECISION REQUIRED.
9. **Leaves runtime (if approved):** nothing by removal; this is reconciliation
   of existing logic, not deletion.
10. **Remains in docs:** the continuity-note prompt instruction.
11. **Removal risk:** MEDIUM (memory fidelity).
12. **Regression tests:** a >800-char continuity fixture round-trips without
    silent middle-loss under the chosen rule; parse/render parity on the julia
    fixture.

## M2 — Corrected facts (no persistence path)
1. **Domain:** a user correcting the AI (e.g. julia T13 "don't confuse my
   facts") persisting into later turns.
2. **Source A:** history replay only (last 30 messages; route.ts:348-352).
3. **Source B:** no state field stores "corrected fact"; nothing survives
   beyond the 30-message window.
4. **What each instructs:** A: the correction is visible only while in the
   window. B: no durable memory of it.
5. **Affects:** `[mem]` `[move]`.
6. **Latest owner decision:** none → **OWNER DECISION REQUIRED**.
7. **Status:** no mechanism (gap).
8. **Proposed survivor:** OWNER DECISION REQUIRED. **OUT OF SCOPE for
   removal-only branch** (building a store = new layer).
9. **Leaves runtime:** nothing.
10. **Remains in docs:** n/a.
11. **Removal risk:** n/a (addition, not removal).
12. **Regression tests:** n/a until designed.

## M3 — Rejected hypotheses (no persistence path)
1. **Domain:** a hypothesis the user rejected not being re-asserted later.
2. **Source A:** history replay only.
3. **Source B:** no field stores rejected hypotheses.
4. **What each instructs:** A/B: no durable memory.
5. **Affects:** `[mem]` `[move]`.
6. **Latest owner decision:** none → **OWNER DECISION REQUIRED**.
7. **Status:** gap.
8. **Proposed survivor:** OWNER DECISION REQUIRED. **OUT OF SCOPE for
   removal-only branch.**
9–12. As M2.

## M4 — Rejected topics/modalities
1. **Domain:** modalities the user rejected being avoided later.
2. **Source A:** `modalityRejected` → `sessionRejectedModalities` → prompt
   (load.ts:435 → assemble.ts:272) — **this one is wired** (echoed, session-
   scoped).
3. **Source B:** it is session-scoped (resets on resume) and echo-only (no gate);
   "rejected topics" beyond modality are not tracked.
4. **What each instructs:** A: within-session avoidance via prompt. B: no
   cross-session memory; no non-modality topic tracking.
5. **Affects:** `[mem]` `[move]`.
6. **Latest owner decision:** none explicit → **OWNER DECISION REQUIRED**
   (accept session-scope, or extend?).
7. **Status:** partially wired (modality only, session only).
8. **Proposed survivor:** OWNER DECISION REQUIRED; the existing modality echo is
   behaviour-preserving to keep.
9. **Leaves runtime:** nothing (keep as-is unless owner extends).
10. **Remains in docs:** the modality-rejection render.
11. **Removal risk:** LOW (keep-as-is).
12. **Regression tests:** modality-refusal fixture → next reply avoids it
    within session.

## M5 — Repeated-question prevention
1. **Domain:** not re-asking an already-answered question (julia T21 repeat;
   «у тебя короткая память»).
2. **Source A:** none — no dedup mechanism; history replay only.
3. **Source B:** `HISTORY_LIMIT = 30` stripped replies; no "asked already" store.
4. **What each instructs:** nothing prevents a repeat.
5. **Affects:** `[mem]` `[reply]` `[move]`.
6. **Latest owner decision:** none → **OWNER DECISION REQUIRED**.
7. **Status:** gap.
8. **Proposed survivor:** OWNER DECISION REQUIRED. **OUT OF SCOPE for
   removal-only branch** (prevention mechanism = new layer; the *prompt* can be
   asked to check, which is reconciliation-adjacent but still additive).
9–12. As M2; harness `repeated-question` metric is the guard if designed.

## M6 — Pattern/part correction paths
1. **Domain:** correcting or retiring a stored `JourneyPart`/`JourneyPattern`.
2. **Source A:** upsert-only writes (`save.ts:189` parts, `:416` patterns) —
   accumulate, never correct/remove.
3. **Source B:** foreign files DO have an invalidation path
   (`releaseInvalidated`, save.ts:380); parts/patterns do not.
4. **What each instructs:** A: parts/patterns only grow. B: no correction/retire.
5. **Affects:** `[mem]` `[move]`.
6. **Latest owner decision:** none → **OWNER DECISION REQUIRED**.
7. **Status:** gap (asymmetric with foreign-file invalidation).
8. **Proposed survivor:** OWNER DECISION REQUIRED. **OUT OF SCOPE for
   removal-only branch** (adding a correction path = new layer).
9–12. As M2.

---

# GROUP 5 — STATE AND PROGRESSION

## S1 — Two advancement lanes
1. **Domain:** stage advancement.
2. **Source A:** classic gate lane — `router.ts:111-122` + `stage-gates.ts`
   (requires `recommendedAction === 'advance'` + stage tokens/state).
3. **Source B:** move-based lane — `router.ts:132-142` +
   `move-based-advance.ts:8-18` (≥3 `stage_N.*` moves, intensity ≤5, safety
   none, adult-self ≥0.5; **does not require** `recommendedAction`; ignores
   anchors).
4. **What each instructs:** A: AI must recommend advance + gate criteria. B:
   accumulate moves, no AI-recommendation needed.
5. **Affects:** `[prog]`.
6. **Latest owner decision:** 2026-07-07 move-based lane, *"8 Owner-locked
   rules"* (`03-…timeline.md:17`, grade **OWNER**) — created the lane but
   *"classic gates untouched → two un-reconciled lanes."* No decision picks one.
7. **Status:** both shipped; conflicting (un-reconciled).
8. **Proposed survivor:** **OWNER DECISION REQUIRED** (D10 created B but did not
   retire A; downstream of C1).
9. **Leaves runtime (per decision):** either `move-based-advance.ts` + its
   router branch, or the classic-gate `recommendedAction` requirement.
10. **Remains in docs:** the 8 owner-locked move rules.
11. **Removal risk:** HIGH (progression semantics).
12. **Regression tests:** router unit suite for the surviving lane on the julia
    fixture; no unintended advance/regress.

## S2 — Two open-cycle definitions
1. **Domain:** what counts as an "open cycle" blocking advancement / shaping the
   prompt.
2. **Source A:** `load.ts:428-433` — session-windowed (last 10 turns, 4h
   boundary, reset on resume), `open` **or** `closing`; feeds the **prompt**.
3. **Source B:** `router.ts:76` — literal last turn, `open` **only**; gates
   **routing**.
4. **What each instructs:** A: broader, session-scoped, prompt-facing. B:
   narrower, last-turn, gate-facing. They can disagree (on `closing`, on omitted
   last-turn status, across resume).
5. **Affects:** `[prog]` `[reply]`.
6. **Latest owner decision:** none → **OWNER DECISION REQUIRED**.
7. **Status:** both live; conflicting; no owner decision.
8. **Proposed survivor:** OWNER DECISION REQUIRED (which definition is
   canonical for each consumer).
9. **Leaves runtime (per decision):** one of the two derivations (or they are
   unified).
10. **Remains in docs:** the cycle-status prompt instruction.
11. **Removal risk:** MEDIUM-HIGH (progression + prompt).
12. **Regression tests:** `open-cycle-guard` unit tests for the chosen
    definition; prompt render parity.

## S3 — Dead `currentDepth`
1. **Domain:** depth tracking.
2. **Source A:** writers set `'surface'` only (start route; router.ts:214,224;
   page default).
3. **Source B:** the only non-surface writer `save.ts:116` `if
   (u.recommendedDepth)` — `recommendedDepth` assigned nowhere (save.ts:22).
4. **What each instructs:** permanently `'surface'`; echoed to prompt
   (assemble.ts:201); read by no gate.
5. **Affects:** `[tel]` (and an inert prompt line).
6. **Latest owner decision:** none — never wired since 2026-06-09
   (`03-…timeline.md:10`) → **no owner decision needed to remove** (dead).
7. **Status:** never shipped (depth wiring).
8. **Proposed survivor:** behaviour-preserving removal — no behavioural decision
   needed, only approval to touch frozen code.
9. **Leaves runtime:** the `recommendedDepth` branch (save.ts:116,22); the
   "Current depth:" prompt line (assemble.ts:201); optionally the `currentDepth`
   column plumbing (schema change — Julia runs migration manually).
10. **Remains in docs:** none required.
11. **Removal risk:** LOW (inert). Schema-column removal needs a manual
    migration (owner-run) — keep the column if migration risk is unwanted.
12. **Regression tests:** recorded-harness parity on the julia fixture
    (identical parsed reports); vitest suite green; typecheck.

## S4 — Unused `cycleCanClose`
1. **Domain:** cycle-close signal.
2. **Source A:** parsed (`parse.ts:371-373`) and stored in the audit blob.
3. **Source B:** read by nothing; the only runtime occurrence is an instruction
   *string* telling the model to emit it (assemble.ts:266); not in the inspector.
4. **What each instructs:** the model emits it; nothing consumes it.
5. **Affects:** `[tel]`.
6. **Latest owner decision:** none → behaviour-preserving removal (dead).
7. **Status:** never shipped (no consumer).
8. **Proposed survivor:** behaviour-preserving removal — approval to touch
   frozen code only.
9. **Leaves runtime:** the parse handling (parse.ts:371-373) and the emit
   instruction (assemble.ts:266).
10. **Remains in docs:** none.
11. **Removal risk:** LOW.
12. **Regression tests:** recorded-harness parity; parse tests green.

## S5 — Unused `stabilityCheck.score`
1. **Domain:** stability/closure gating signal.
2. **Source A:** parsed/clamped (`parse.ts:331-347`); shown in the admin
   inspector only.
3. **Source B:** no gate/router reads it; the "`score < 6` → don't close" rule
   is prompt text, model-self-enforced (closure-discipline.test.ts:35).
4. **What each instructs:** model emits + self-enforces; code never gates.
5. **Affects:** `[tel]` (+ prompt self-enforcement).
6. **Latest owner decision:** none → **OWNER DECISION REQUIRED** *if* the owner
   wants code to enforce closure (that would be a NEW reader = new layer). As a
   pure field it is AUDIT-ONLY, not dead (inspector reads it).
7. **Status:** written-only-audit (not removable without losing inspector
   display).
8. **Proposed survivor:** keep the field (inspector uses it); decide separately
   whether closure should be code-enforced (OWNER DECISION REQUIRED; overlaps
   V6/V7). Do **not** remove.
9. **Leaves runtime:** nothing (keep).
10. **Remains in docs:** closure-discipline text.
11. **Removal risk:** N/A (keep).
12. **Regression tests:** inspector renders `stabilityCheck`; parse-clamp tests.

## S6 — Session close and discharge authority
1. **Domain:** who decides a session closes / a user discharges.
2. **Source A:** code — Stage-8 discharge gate (stage-gates.ts:573-651) +
   router discharge branch (router.ts:94-104) + open-cycle block.
3. **Source B:** prompt — closure discipline (self-enforced) and the
   consolidation/"underneath" tension (V6/V7).
4. **What each instructs:** A: discharge only when the Stage-8 gate passes and
   no open cycle. B: closure is a matter of prompt judgement.
5. **Affects:** `[prog]` `[move]`.
6. **Latest owner decision:** Stage-8 discharge criteria are code canon; no
   explicit decision reconciles prompt-closure with code-discharge →
   **OWNER DECISION REQUIRED** (downstream of C1/V6/V7).
7. **Status:** partial (discharge coded; closure prompt-only).
8. **Proposed survivor:** OWNER DECISION REQUIRED.
9. **Leaves runtime (per decision):** possibly none by removal (reconciliation).
10. **Remains in docs:** discharge spec; closure text.
11. **Removal risk:** HIGH (discharge is terminal/irreversible in progression).
12. **Regression tests:** Stage-8 gate suite; discharge fixture; open-cycle
    block intact.

## S7 — State-report schemas and unreachable fallback
1. **Domain:** the state-report contract + the assembly fallback.
2. **Source A (live):** the master prompt's `<output_format>`
   (`journey-master.md:609-760`) — has `channel`, `clinicalRead`,
   `moveJustPerformed`; matches the emission reminder.
3. **Source B (vestigial):** `STATE_REPORT_FORMAT_INSTRUCTION`
   (`assemble.ts:31-104`) — different shape, no `clinicalRead`/`moveJustPerformed`;
   referenced only at `assemble.ts:693` in the **unreachable** fallback
   (mutual-recursion path assemble.ts:592-594,676,681-694).
4. **What each instructs:** A: the real schema the model emits. B: a stale
   second schema no live path uses.
5. **Affects:** `[tel]` (B is inert).
6. **Latest owner decision:** none → behaviour-preserving removal of the
   vestigial/unreachable material (dead).
7. **Status:** A shipped; B never-shipped-as-live / unreachable.
8. **Proposed survivor:** Generation A (the master `<output_format>`).
   Behaviour-preserving removal of B + the unreachable fallback + the code only
   it reaches.
9. **Leaves runtime:** `STATE_REPORT_FORMAT_INSTRUCTION` (assemble.ts:31-104);
   the `assembleSystemPrompt` fallback + mutual-recursion path
   (assemble.ts:592-594,676,681-694); `loadStageSpec` single-active path;
   `loadEngineeredStagePrompt` + `runtime/stage-01/02.md`; `DIVIDER`
   (assemble.ts:455).
10. **Remains in docs:** the master `<output_format>` schema.
11. **Removal risk:** LOW (unreachable/inert) — but confirm the fallback is
    truly unreachable in every deployment before deleting (Phase-2 verification).
12. **Regression tests:** recorded-harness parity; assemble unit tests; a test
    that a missing master file is handled without recursion (or that the file is
    guaranteed present).

---

# PART 2 — Owner decisions Julia still needs to make

Only these block a clean-runtime branch. Everything else is either dictated by
an existing explicit decision or is behaviour-preserving cleanup.

1. **The structural one (subsumes several):** are stages **labels** or **gates**?
   (C1) — this settles C2, S1 (which advance lane), S2 (open-cycle), C6, and the
   later-stage anchor gate question in A1.
2. **Anchor at later stages:** the 2026-07-02 decision dictates the Stage-1 gate
   and the prompt naming/soothe removal; confirm whether `anchorText`/
   `identityAnchor` should also stop gating Stages 2–8 (A1, tied to C1).
3. **Reply-first vs analyse-before-speak** (V-group / D11 vs D12): the last
   OWNER-graded decision (D11) was silently superseded by a non-owner-graded
   change (D12). Confirm which is canonical. (Evidence input: the approved
   Extended-Thinking experiment.)
4. **Assessment-first vs same-turn practice/intervention** (C3, C5) — trigger
   timing.
5. **Body/imagery optionality** (C4) — offered vs pushed.
6. **Consolidation/closure vs "always something underneath"** (V6, V7, S6) —
   when the AI must stop.
7. **Open-cycle canonical definition** (S2) — if not fully settled by #1.
8. **Memory scope** (M1 continuity overwrite/truncation; and whether M2/M3/M5/M6
   correction stores are wanted at all — noting these are NEW layers, out of
   scope for a removal-only branch).
9. **`stabilityCheck` / closure enforcement** (S5/V6) — keep prompt-only or add
   a code reader (new layer).

Note: the anti-echo voice reconciliation (V1–V5) is **dictated** by the
2026-07-20 `<communication>` decision — no new owner decision is needed to make
the exemplars conform to it, only owner review of each clinical reduction.

---

# PART 3 — Proposed PR decomposition (scope only — not implementation)

### PR A — Behaviour-preserving dead/duplicate cleanup
**Precondition:** Phase-2 verification (Doc 5) proves zero readers; approval to
touch frozen code. **No behavioural owner decision required.**
Scope: S3 (dead `currentDepth`/`recommendedDepth` branch + inert prompt line),
S4 (`cycleCanClose` parse+emit), S7 (vestigial `STATE_REPORT_FORMAT_INSTRUCTION`
+ unreachable fallback + mutual-recursion path + `loadStageSpec` single-active +
`loadEngineeredStagePrompt`/`runtime/stage-01/02.md` + `DIVIDER`), the `'manual'`
freeze source, and the `originIdentified → originDescription` dead write-target
(decide: wire or drop the emission — behaviour-preserving either way).
Explicitly **excluded:** the `<assessment>` strip (retained safety net); S5
`stabilityCheck` (inspector reads it). Guard: recorded-harness parity + full
vitest suite + typecheck. Any DB-column drop is a **manual** migration Julia
runs.

### PR B — Approved runtime prompt cleanup
**Precondition:** owner approval of V1–V5 reconciliation (dictated by the
2026-07-20 anti-echo decision) and A1's prompt survivals (dictated by the
2026-07-02 anchor decision).
Scope: reconcile the mirror/echo, "I hear you", move-announcing, and
declarative-origin exemplars across the 8 stage specs + Shared Core to the
`<communication>` rule; remove the anchor naming/soothe/close recalls
(`00-shared-core.md:187-193`; `01-stage-stabilisation.md:214`; `02-stage-pain.md`
×7; correct the false `:148` claim); delete the dead-path `runtime/stage-01.md`.
**No code behaviour change; prompt text only.** Guard: golden-harness stock-
phrase / restating / concession metrics + owner spot-review of every reduction.

### PR C — Stage/progression reconciliation
**Precondition:** owner decisions #1, #2, #7 above (labels-vs-gates; anchor at
later stages; open-cycle definition).
Scope: reconcile the two advance lanes (S1) to the chosen model; unify the two
open-cycle definitions (S2); apply the anchor gate change (A1, later stages) and
the cross-stage/assessment permissions (C2, C3, C6) per the labels-vs-gates
decision. **Behavioural** — code + gate/router changes. Guard: full router gate
suite + golden-harness progression + live-arm who-leads on the julia fixture.

### PR D — Memory correction
**Precondition:** owner decision #8.
Scope (removal/reconciliation only): reconcile continuity-note overwrite +
truncation (M1) to the chosen rule; keep/extend the wired modality-rejection
echo (M4). **Out of scope (flagged, requires a new behavioural layer — not this
branch):** corrected-facts store (M2), rejected-hypotheses store (M3),
repeated-question prevention mechanism (M5), pattern/part correction path (M6).
If any of M2/M3/M5/M6 are wanted, they are a separate design track, not part of
the clean-runtime-by-removal branch. Guard: continuity round-trip fixture +
recorded-harness parity.

---

*Read-only register. No code or prompt changed; nothing removed; no PR opened.
Survivors are proposed only where an explicit owner decision dictates them;
everywhere else the row reads OWNER DECISION REQUIRED.*
