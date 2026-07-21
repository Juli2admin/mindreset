# Final Runtime Cleanliness Verdict — Journey (2026-07-21)

Synthesis of documents 01–11. Evidence classes: CONFIRMED (code/prompt/history-verified),
PROBABLE (strong converging evidence, mechanism not directly observed), POSSIBLE,
UNSUPPORTED. NOT PROVEN marked inline.

## The 15 questions

1. **Is the runtime a coherent instruction system?** No. It is 4 simultaneously live
   generations of the method (Clinical Manual [unloaded but self-authoritative] →
   Shared Core + sequential specs → flexible-map header → master operational layer) plus
   gate code enforcing the second generation against the third. CONFIRMED (docs 02/03/04).
2. **Multiple generations active simultaneously?** Yes — 27 verified live contradiction
   pairs; 6 intra-file. CONFIRMED (doc 04).
3. **Later rules layered over earlier rules instead of replacing them?** Yes — 6 of 7
   material owner/architecture decisions were additive; exactly one (formulation_confirmed)
   was ever reconciled, three weeks late. CONFIRMED (doc 03).
4. **Explicitly superseded rules still reaching production:** anchor-as-soothe regime
   (SC §6, S2 ×7); spoken-anchor script (S1 Ex.C); anchor gate in `stage-gates.ts:113,121`
   (owner-retired 2026-07-02, deletion never shipped); pre-`discharge` report schema
   (SC §9); same-session release narratives (S5) vs P1 provisional semantics; sequential
   gate text in all 8 specs vs PR λ. CONFIRMED.
5. **Old examples training cancelled behaviour:** 812 model-voice snippets / 25 worked
   examples in the canon, incl. the exact banned behaviours ("I hear you" ×9 exemplar
   uses, anchor-recall ×24, body-question ×13, validation ×35+), against 16 current-voice
   snippets. 50:1. CONFIRMED (docs 05/07).
6. **Independent sources of truth:** 5 (four prompt generations + gate code). CONFIRMED.
7. **Effective control of visible replies:** canon exemplar mass + the model's own
   stripped prior replies + reply-first architecture; the approved `<communication>` layer
   (0.9%, one day old at test time) ranks last on every contested behaviour. CONFIRMED
   for weights and architecture; PROBABLE for the causal ranking (imitation-over-
   instruction is established LLM behaviour but not directly instrumented here).
8. **Effective control of clinical moves:** model discretion under the flexible-map
   license, bounded only post-hoc by telemetry; code never blocks a move. CONFIRMED.
9. **Effective control of safety:** code (keyword scan pre-LLM; AI red_flag honoured
   unconditionally; Haiku verifier post-stream; freeze). The one genuinely code-owned
   domain. CONFIRMED.
10. **Effective control of progression:** code (two un-reconciled lanes + open-cycle
    guard + anchor-encumbered Stage-1 gate), fed by fields the prompt tells the model to
    withhold (`advance` only at share-back). CONFIRMED.
11. **Is internal analysis upstream of the reply?** No — architecturally impossible:
    single stream, reply tokens first, report after, no pre-reply artefact (removed by
    PR β 2026-07-09), analysis consumers all post-`controller.close()`. The prompt
    *demands* pre-reply reasoning while *forbidding* every mechanism that would evidence
    or enforce it. CONFIRMED (doc 01 §B).
12. **Too large / too duplicated / too contradictory for reliable adherence?**
    92.4k tokens; ~35–40% unique-and-current; 3 copies of the practice system, 2 schemas,
    9 gate statements vs 3 bookkeeping statements; 27 contradictions; behaviour rules
    ~4–5% vs 73.5% method. Size alone: POSSIBLE contributor. Duplication+contradiction:
    CONFIRMED as measured; their causal sufficiency: PROBABLE.
13. **Role overload materially contributing?** 20 roles/turn, 9 nominally pre-reply with
    no slot, 11 post-hoc; the recency slot is spent on JSON emission. Overload is
    CONFIRMED as fact; material contribution to surface failures: PROBABLE (not
    isolable from causes 1–3 without controlled tests).
14. **Best explanation of the observed surface failure:** a combination, ranked below.
15. **Confirmed / probable / possible / unsupported:** see causal model.

## Ranked causal model for "AI like student — I lead, it follows"

| Rank | Cause | Supporting evidence | Contradicting evidence | Confidence | Further evidence needed |
|---|---|---|---|---|---|
| 1 | **Reply-generation order** (analysis structurally downstream; no plan artefact upstream of wording) | doc 01 §B (architectural proof); T1/T2/T5 traces — 25 competent clinicalReads that describe each failure only after it happened; PR α→β history (the enforcement artefact existed and was removed for latency) | none found | **CONFIRMED mechanism; PROBABLE as top-ranked contributor** | A/B test: reinstate any pre-reply artefact (even minimal) and compare sessions |
| 2 | **Contradictory instruction generations + exemplar imitation** (50:1 old-voice mass; 24:1 anchor; 19:1 mirror; 13:1 body) | doc 04 (27 pairs), doc 05 (ratios), T3 (anchor formula 10× — an owner-banned behaviour executed by the legacy regime), T4 | `<communication>` was 1 day old at test — its potential under equal weight is untested | **CONFIRMED presence; PROBABLE dominant for voice failures** | re-test after the comms layer has equal demonstration weight (owner decision) |
| 3 | **Memory loss** (30-msg stripped history; reports never re-enter; note overwrite + 400/300 truncation, read by no code; rejections reset each session; no correction paths) | doc 08; "я уже/опять" ×6 in transcript; re-asking observed | some repetition is normal clinical practice | **CONFIRMED mechanisms; PROBABLE for re-asking/conflation specifically** | instrument: log when a re-asked question's answer existed in dropped context |
| 4 | **Prompt size / attention dilution** (92.4k; behaviour rules 4–5%) | doc 05; PR λ +24k tokens with robotic behaviour persisting afterwards | large prompts can adhere well when internally consistent — size is confounded with causes 2 | POSSIBLE-to-PROBABLE (not separable from cause 2 in current data) | ablation: same content de-duplicated/de-contradicted at smaller size |
| 5 | **Role overload** (20 roles; recency slot spent on emission duty) | doc 06 | report emission demonstrably coexists with good replies on healthy turns | POSSIBLE | separate-pass extraction test |
| 6 | **Model capability** (Sonnet 4.6 everywhere; temperature default ~1.0; planned Opus fidelity testing never done; `modelOverride` unvalidated) | doc 01 step 7 | the same model produces the excellent clinicalReads — capability is demonstrably present in-system | POSSIBLE (minor); UNSUPPORTED as primary | single-variable model swap test |
| — | Provider cache serving stale prompts | ruled out (byte-prefix keying, doc 09 §4) | — | UNSUPPORTED | — |
| — | Loader truncation TODAY | fixed 2026-07-19, regression-pinned | — | UNSUPPORTED now — but CONFIRMED that 2026-07-09→07-19 production lacked the hard rules, contaminating that window's "we changed it and it didn't work" evidence | — |

**Critical historical note on "we changed it many times — didn't work":** two of the most
important prior fixes never actually reached the model as intended — the Sensitivity
Layer's hard rules were silently truncated in production for their first ~10 days (loader
fence bug), and the anchor-gate deletion promised on 2026-07-02 was never merged. At least
part of the "fixes don't work" history is CONFIRMED to be "fixes were not actually live."

## Owner decisions required later (NOT proposals — open questions surfaced by facts)

1. Which generation of the method is canonical — sequential specs, flexible map, or a
   reconciled single text? (5 sources of truth today.)
2. Should stage-spec worked examples remain runtime prompt content, given the measured
   50:1 imitation pressure against the approved voice?
3. Reinstate an analyse-before-speak step (PR α class) at some latency cost, or accept
   reply-first permanently?
4. All-8-specs-every-turn (PR λ) — keep, or conditionally load? (Owner-attributed
   philosophy vs measured dilution; classified CANNOT-DETERMINE.)
5. The retired anchor gate in `stage-gates.ts` — ship the deletion that was promised
   2026-07-02?
6. `CLINICAL_MANUAL.md` authority claim — revise, retire, or load?
7. Session-close authority — should `cycleCanClose`/`stabilityCheck` gain the code
   consumers the schema documents, or be dropped from the schema?
8. `modelOverride` exposure and the never-run Opus fidelity test.

*End of forensic audit. Read-only throughout: no code, prompts, gates, practices, memory
or state were changed; no fixes proposed beyond naming the open decisions; no PR opened.*
