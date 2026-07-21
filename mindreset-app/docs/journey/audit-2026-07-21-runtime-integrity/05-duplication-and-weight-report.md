# Duplication & Instruction-Weight Report — Journey Runtime (2026-07-21)

All numbers measured on the assembled production prompt (export
`../audit-2026-07-21-runtime-prompt-export.md`): **342,022 chars ≈ 92,438 tokens, 4,558 lines**
(incl. the appended user-message note, 124 tokens). Token estimate = chars/3.7.

## 1. Token distribution by section (measured)

| Section | ~tokens | % | Category |
|---|---:|---:|---|
| Canon header | 482 | 0.5 | method framing |
| Shared Core | 4,412 | 4.8 | method |
| Practice Generation Algorithm (doc) | 2,489 | 2.7 | method (duplicated by master `<practice_generation>`) |
| Stage 1–8 specs | **60,498** | **65.5** | method + worked examples |
| `<clinical_reading>` | 717 | 0.8 | reasoning behaviour |
| `<communication>` | 878 | 0.9 | voice behaviour |
| `<method>` (8 moves) | 3,138 | 3.4 | operational method |
| `<assessment_phase>` | 1,127 | 1.2 | operational method |
| `<practice_generation>` | 3,750 | 4.1 | operational method (3rd copy of practice system) |
| `<traps>` | 1,788 | 1.9 | voice/clinical behaviour |
| `<memory>` | 706 | 0.8 | machinery |
| State block (dynamic) | 1,329 | 1.4 | live data |
| `<examples>` (master) | 2,409 | 2.6 | behavioural examples (current-approved voice) |
| `<output_format>` | 6,079 | 6.6 | machinery (schema, checklist, vocab) |
| Sensitivity Layer | 2,361 | 2.6 | reasoning behaviour + machinery |
| Appended note | 124 | 0.1 | machinery |

**Aggregates:**
- Clinical method + stage playbooks (canon): **~73.5%**
- Communication/voice/reasoning behaviour (`communication`+`clinical_reading`+`traps`+Sensitivity's behavioural half): **~4–5%**
- State/output machinery (`output_format`+`memory`+state block+note+Sensitivity's schema half): **~10%**
- Operational method (moves, assessment, practice generation): **~8.7%**
- Master behavioural examples (the *approved* voice): **2.6%** — vs stage-spec exemplar dialogue embedded in the 65.5%.

## 2. Exemplar-dialogue mass (the decisive imbalance)

- Italic-quoted model-voice snippets (`*"…"*`) in **stage specs: 812**.
- In the **master layer (incl. its 13 contrast examples): 16**.
- Ratio of old-voice demonstration to current-voice demonstration: **≈ 50 : 1**.
- 25 full worked examples live in the stage specs; 10 (plus 3 communication contrast pairs)
  in the master layer.

An LLM imitates demonstrations more reliably than it obeys abstract rules. The corpus
demonstrates the pre-2026-07 voice ~50× more than the approved voice.

## 3. Rules stated multiple times (semantic duplication)

| Unique behavioural requirement | Copies in runtime | Versions | Most-frequent wording | Latest approved version | Version the model will imitate |
|---|---:|---|---|---|---|
| Practice families (5-family list) | **3** (SC §5.1, PGA §4, MASTER `<practice_generation>`) | near-identical | SC/PGA wording | MASTER (adds family discipline) | any — consistent |
| Practice generation order | **3** (SC §5.2 7-step, PGA §5 pseudo-code, MASTER 10-step hierarchy) | **divergent** (MASTER inserts Block-1 constraint + body-activation ranking; SC/PGA lack them) | SC/PGA 7-step | MASTER 10-step | SC/PGA (2 copies, earlier, simpler) |
| Alternative rule (switch modality on refusal) | **3** (SC §5.6, PGA §11, MASTER) | consistent | — | MASTER (+`modalitySwitched` emission) | consistent |
| Personalisation rule (user's exact words) | **40 occurrences** | consistent, over-weighted | "user's exact words" | — | over-applied → echo |
| Anchor protocol | **2 regimes**: soothing-recall (SC §6 + S2 ×24 refs) vs observation-only (S1 §8 + MASTER §1) | **contradictory** | soothing-recall (24 refs + "Take a moment with [anchor]" ×9) | observation-only (owner, 2026-07-02) | **soothing-recall** — confirmed live: «рука на груди» invoked 10× in the 2026-07-21 session |
| Red-flag protocol | **2** (SC §7 verbatim script + PGA §9 list) + vocab entry | consistent | — | SC §7 | consistent |
| State-report schema | **2** (SC §9 vs `<output_format>`) | **divergent**: SC §9 lacks `discharge` in `recommendedAction`, lacks `clinicalRead`, `moveJustPerformed`, `taskContract`, sensitivity fields; field names differ (`readinessTouched` semantics) | — | `<output_format>` | risk of SC-era emissions |
| Stage-gate semantics | **9** (8 per-stage "code-enforced gate" sections + SC §9 "Gates are code-enforced") vs 3 "bookkeeping" statements | contradictory | gate version (9) | bookkeeping (PR λ 2026-07-11) | gate framing, while header licenses cross-stage work — worst of both |
| Depth permissions | 3 per-stage "Deep — prohibited" tables vs flexible-map license | contradictory | prohibition | flexible map | mixed |
| Body-location question | 13 exemplars + gate token + checklist item vs trap 5 + hard rule 1 | contradictory | exemplars | trap 5 / hard rule 1 | exemplars (body reflex) |
| Validation formulas | "It's allowed" ×5, "makes sense" ×8, "You don't have to" ×22, "I'm here" ×9, "That sounds" ×7 vs restraint rule ×1 | contradictory | exemplars | `<communication>` restraint | exemplars |
| Session close ritual | SC §10 (closing practice + offer) vs MASTER stabilising-before-closing (1–10 score) vs Sensitivity rule 6/8 (closure check) | 3 overlapping protocols | — | Sensitivity 8 (2026-07-19 closure discipline) | blend |
| "Status: draft for clinical review by Julia" | **9 files** carry draft-status headers into production runtime | metadata noise | — | n/a | tells the model its constitution is a draft |

## 4. Obsolete / superseded material still shipped every turn

1. **S1 §11 Example C** — full pre-2026-07-02 anchor anatomy incl. "This is your anchor."
   (banned verbatim by MASTER §1). Same file's §8 documents the revision; the example was
   never updated.
2. **S2 §2 gate text** — "Stage 1 has closed cleanly (`anchorText` set…)" — retired
   requirement (S1 §10, 2026-07-02).
3. **SC §6 anchor-recall regime** — superseded by MASTER §1; still the constitution's wording.
4. **SC §9 state-report schema** — pre-`discharge`, pre-`clinicalRead` version of the schema.
5. **SC end-note** — "The next document to draft is `01-stage-stop.md`" — drafting-era
   scaffolding shipped to the model every turn.
6. **9 draft-status headers** and per-spec "Status: draft for clinical review" lines.
7. **S5 worked examples** narrating same-session release completion — superseded by P1
   provisional-release semantics (2026-07-19).

## 5. Uniqueness estimate

- Genuinely unique, non-duplicated, non-contradicted instruction content: the master
  operational layer (~19k tokens) + one copy of the practice system (~2.5k) + Shared Core
  constitution minus superseded sections (~3.5k) + state block (1.3k) ≈ **26–28k tokens**.
- Stage-spec content that is unique *clinical* method (not duplicated framing, not worked
  examples, not per-stage boilerplate repeated 8×: "When This Stage Is Active", "Status",
  gate sections, watch-for repeats): estimated **~25–30% of the 60.5k stage tokens**.
- **Approximate share of the 92k-token prompt that is unique and currently-approved:
  ~35–40%.** The remainder is duplication (3× practice system, 2× schema, 8× boilerplate),
  superseded regimes, or exemplar mass that demonstrates the cancelled voice.
  (Estimate; the split between "unique clinical method" and "boilerplate" inside stage
  specs was sampled, not exhaustively tagged — see NOT PROVEN note.)

NOT PROVEN precisely: the exact token count of duplicated-or-contradictory material
(requires sentence-level tagging of all 8 stage specs). The 3× practice system, 2× schema,
9-gate duplication, and 812:16 exemplar ratio are exact measurements.

*Read-only audit. No deletions recommended in this document.*
