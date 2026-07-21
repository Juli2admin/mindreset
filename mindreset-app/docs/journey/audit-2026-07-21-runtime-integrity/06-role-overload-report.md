# Role-Overload Report — Journey Runtime (2026-07-21)

Every role the SAME single streamed completion is instructed to perform, per turn.
Timing column: what the architecture actually allows — the completion emits the visible
reply FIRST, then the `<state-report>`; there is no second pass and no pre-reply artefact
(PR β removed the `<assessment>` block 2026-07-09 for latency).

| # | Role | Source instructions | Visible prose? | Hidden state? | Must occur (per prompt) | Actually occurs (architecture) | Compliance checked? | Consequence of failure |
|---|---|---|---|---|---|---|---|---|
| 1 | Natural conversational partner | `<communication>` | yes | — | during reply | during reply | no | robotic voice (observed) |
| 2 | Experienced clinician (register, leadership) | `<communication>`, `<clinical_reading>` | yes | — | before+during reply | during only (no enforced pre-step) | no | student-like following (observed) |
| 3 | Hidden diagnostic observer | `<clinical_reading>`, Sensitivity 5 questions | shapes prose (claimed) | `clinicalRead` | **before reply** | **after reply** (report position) | no | analysis retrospective (confirmed) |
| 4 | Method/move selector (8 moves × 8 playbooks) | `<method>`, canon header, stage specs | yes | `moveJustPerformed` | before reply | during reply, unverified | vocab-validated only (unknown IDs dropped) | wrong/premature moves |
| 5 | Practice generator | `<practice_generation>`, PGA, SC §5 | yes | `practiceRun` | during reply | during reply | orphan-`started` flagged in audit log only | ritual practices, stealth practices |
| 6 | Safety assessor | SC §7, schema `safetyFlag` | can interrupt prose | `safetyFlag`,`redFlagType` | continuous | during+after; verifier (Haiku) runs code-side in parallel | **yes — only role with independent code check** | freeze missed/late |
| 7 | Crisis responder (verbatim script) | SC §7 | yes | `red_flag` action | replaces reply | replaces reply | code freeze honours it | — |
| 8 | Modality detector/honourer | Sensitivity Q3/Q4, hard rule 1 | yes | `modalityRejected` | before reply | after; render-only next turn | no code block on violations | body-question reflex (observed) |
| 9 | Therapeutic-cycle manager | Sensitivity Q5, rules 5–7, STATE cycle banner | yes (don't close) | `cycleStatus`,`cycleCanClose` | before close | prompt-only for close; code uses flag to block *advance* | partially (advance guard only) | stuck-open cycles freeze progression |
| 10 | Memory reader (state block, 92k context) | `<memory>`, STATE header | yes | — | before reply | unverified | no | repetition, re-asking (observed) |
| 11 | Case-formulation writer | `<memory>` continuityNote shape | no | `continuityNote` | after reply | after reply | none (no code reads it) | strategy loss via 800-char render truncation |
| 12 | Stage navigator (which playbook) | canon header | yes | — | before reply | during | no | cross-stage drift at Stage 1 (observed) |
| 13 | Progression recommender | schema `recommendedAction`, `<assessment_phase>` advance rule | no | `recommendedAction` | after | after | gates read it (advisory) | stage starvation (observed: E3 contradiction) |
| 14 | Structured data extractor (user's exact words → ~30 fields) | `<output_format>` captures | no | many fields | after | after | zod-parse; silent drops | landscape gaps |
| 15 | JSON generator (parseable, exact tags) | `<output_format>` strict rules + appended note | no | whole report | after | after | parse fallback `{5,watch,stay}` on failure | turn recorded as hold-biased default |
| 16 | Audit logger (moves, practices, statuses) | practice emission rules, move vocab | no | `practiceRun`,`moveJustPerformed` | after | after | data-quality flags only | invisible clinical work |
| 17 | Closure controller (8-question check, 1–10 score) | Sensitivity rule 8, stabilising-before-closing | yes | `stabilityCheck`,`cycleCanClose` | before close | prompt-only | no | unsafe/blocked closes |
| 18 | Task-contract keeper | STATE contract banner, `taskContract` schema | yes (check route) | `taskContract` | before intervention + before close | unverified | merge-protect on write only | drift from presenting request |
| 19 | Block-1 checklist executor (12 items, "NON-NEGOTIABLE") | `<output_format>` Block-1 focus | no | gate tokens | every turn, after | after | gate starves if skipped | Stage 1→2 never fires |
| 20 | Emission-discipline keeper (report every turn) | appended `<system-note>` (recency-positioned) | no | whole report | after | after | telemetry detected dropout (2026-07-19) | report dropout mid-session |

## Answers

**1. Too many competing roles in one completion?** 20 distinct roles; 9 of them
(3,4,8,9,10,12,17,18, and 2) are *supposed* to happen before or while wording the reply, and
11 are post-reply reporting/extraction duties. The only role with independent code
verification is safety (#6). Every other role is honour-system inside one pass whose FIRST
emitted tokens are the visible reply. The report half alone (~30 schema fields + vocab +
checklist ≈ 9k tokens of machinery) is a full extraction job appended to every
conversational turn.

**2. Roles requiring clinical reasoning BEFORE speech:** 2 (clinician register), 3
(diagnostic read), 4 (move selection), 8 (modality), 9 (cycle), 10 (memory), 12 (playbook
choice), 17 (closure check), 18 (contract check). The prompt demands all nine pre-reply;
the architecture provides no slot for any of them — the reply is the first thing generated.

**3. Retrospective-reporting-only roles:** 11, 13, 14, 15, 16, 19, 20 — none can affect
the current reply by construction; they affect later turns via persistence.

**4. Roles separable without changing the methodology** (analysis only, not a proposal):
the extraction/reporting cluster (14–16, 19, 20) is mechanically independent of wording the
reply; the formulation writer (11) and progression recommender (13) are post-hoc by
definition; safety (6) already runs partly in code. Their *separability* is an architectural
fact; whether to separate them is an owner decision out of scope here.

**5. Roles currently distorting the visible conversation:**
- #5 practice generator (triggers + mandatory logging pull turns into practice shape — C6);
- #19 checklist executor (gate tokens reward emotion-naming/body-locating turns — C4);
- #3 diagnostic observer (silent, so it surfaces as clumsy mid-reply interpretation — A6);
- #10 memory reader under a 50:1 old-voice exemplar mass (imitation pressure — A1–A3);
- #20 emission keeper (the recency-slot note makes the report the most-reinforced duty of
  the whole turn — the single strongest instruction by position, and it is about JSON, not
  the user).

*Analysis only. No new architecture proposed.*
