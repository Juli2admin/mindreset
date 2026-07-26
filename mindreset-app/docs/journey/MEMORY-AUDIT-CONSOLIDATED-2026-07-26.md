# CONSOLIDATED MEMORY AUDIT — findings ledger, plan status, causality

**Date:** 2026-07-26
**Trigger:** owner — *"I need a proper memory audit. You have done [this] earlier but it sounds like an established finding that was never documented. Investigate what we have now. Where is the mapping plan to improve the Journey? Why is memory not working and is it a cause of AI degradation?"*
**Status:** read-only consolidation + gap analysis. No fix implemented.

| Label | Meaning |
|---|---|
| **PROVEN** | Executed code, verbatim citation, or dated document on this branch. |
| **STRONGLY SUPPORTED** | Converging independent evidence, not demonstrated end-to-end. |
| **HYPOTHESIS** | Plausible, undemonstrated. |
| **UNKNOWN** | Not answerable from available material. |

---

# 1. THE OWNER IS RIGHT — AND THE PROBLEM IS WORSE THAN "NOT DOCUMENTED"

**PROVEN.** The memory findings **were** documented — comprehensively — on
**2026-07-21**, five days before they were "discovered" again:

`docs/journey/audit-2026-07-21-runtime-integrity/08-memory-context-integrity.md`
is a complete memory-integrity audit: a 13-row per-item table (storage, caps,
truncation, merge semantics, correction paths, code consumption), six
coexistence verdicts, and four named integrity risks — including, verbatim:

> *"**No correction economy.** Except foreign-file invalidation, nothing the
> user corrects can be structurally retracted — only crowded out or voluntarily
> rewritten."*

That is the central finding of the 26-July forensic memory audit, written five
days earlier. The 26-July audit did not cite it. **The failure mode is not
"never documented" — it is "documented, registered, decided, scoped… and then
never planned, never implemented, and forgotten by the next audit."**

The full chain, dated (all **PROVEN**, documents on this branch):

| Date | Step | Artefact | Outcome |
|---|---|---|---|
| early July | Memory gap first flagged | `execution-rebuild-plan.md:38-40` ("No working memory/plan… continuityNote is optional + truncation-prone"); **PR 12 — Memory/plan** listed | PR 12 checkbox **never ticked**; not built |
| 07-18 | PR M1 #322 "memory attention optimisation" merged | `load.ts` caps (top-5 windows), staleness suffixes, reconfirm nudges | **Attention tuning only** — no correction path, no bounds on note growth |
| 07-21 | Full memory-integrity audit | `…runtime-integrity/08-memory-context-integrity.md` | 13 items, 6 verdicts, 4 risks — **complete diagnosis** |
| 07-21 | Good-session baseline findings | `remediation-plan…/05-recorded-baseline-findings.md:45-65` | *"Memory friction is real and user-flagged"* — tester said **«у тебя короткая память»** during the GOOD session; verdict: *"The measurable problem in THIS session is lead-vs-follow and memory"* |
| 07-21 | Findings registered as decisions | Canon Register `GROUP 4 — MEMORY`, items **M1–M6** | Each marked OWNER DECISION REQUIRED |
| 07-21 | **Owner Decision #8 taken** | Register lines 77-83 | Preserve existing structures; **no new correction tables now**; prepare a **bounded, migration-free fix** for continuity-note overwrite + middle truncation; durable stores for corrected facts / rejected hypotheses / repeated-question prevention / pattern-part invalidation = **"separate future design track"** |
| 07-21 | Remediation PR scoped | Register `### PR D — Memory correction` (line 809) | *"scoped there but **not yet planned line-by-line**, pending this planning round's completion"* |
| 07-22 → | Execution pivoted to the anchor clean-up (B-series) | merge history | **PR D was never planned, never implemented.** The executed roadmap (`05-CLEANUP-ROADMAP.md`) contains **zero** memory items (grep-verified) |
| 07-26 | Degraded sessions; memory findings re-derived from scratch | `FORENSIC-MEMORY-AUDIT-2026-07-26.md` | Re-proves M2/M3/M6 empirically, without citing the 21-07 audit |

**Observation (STRONGLY SUPPORTED, offered plainly):** the project's own
documentation now exhibits the exact defect the Journey's memory has — findings
are recorded durably, but there is no mechanism that carries them into the next
decision; they are displaced by newer work and must be rediscovered. The owner
noticed this before the tooling did.

---

# 2. WHAT WE HAVE NOW — complete memory-documentation inventory

All on branch `claude/session-handoff-tester-audit-iqukf3` unless noted.

| # | Artefact | Date | What it contains | Status |
|---|---|---|---|---|
| 1 | `execution-rebuild-plan.md` (also on `main`) | early July | First flag of the memory gap; unbuilt **PR 12 — Memory/plan** | superseded, never executed |
| 2 | PR M1 #322 (merged to `main`) | 07-18 | Read-window caps + staleness rendering | **the only memory change ever shipped** |
| 3 | `audit-2026-07-21-runtime-integrity/08-memory-context-integrity.md` | 07-21 | The complete mechanism diagnosis | authoritative; still accurate (re-verified 07-26 against current `main`) |
| 4 | `remediation-plan-2026-07-21/05-recorded-baseline-findings.md` | 07-21 | Memory friction user-flagged **in the good session** | authoritative |
| 5 | Canon Register `GROUP 4` (M1–M6) + **Owner Decision #8** + `PR D` scope | 07-21 | The decision layer + the never-written plan | **PR D unplanned; M2/M3/M5/M6 deferred to a design track that was never opened** |
| 6 | `FORENSIC-MEMORY-AUDIT-2026-07-26.md` | 07-26 | Turn-by-turn empirical instantiation on the degraded session; new findings (§3) | authoritative for the degraded session |
| 7 | `FORENSIC-SYSTEM-HEALTH-REPORT-2026-07-26.md` §1.5 | 07-26 | Memory subsection within the whole-system report | authoritative |

**What does NOT exist (PROVEN, by search of every planning doc):**
- No memory item in the executed `05-CLEANUP-ROADMAP.md`.
- No line-by-line plan for PR D.
- No opened "future design track" for M2/M3/M5/M6.
- No harness metric that measures memory fidelity (repeat-question is the
  closest proxy and does not distinguish the good and bad sessions).

---

# 3. UNIFIED FINDINGS LEDGER

Every distinct memory finding, where it was first established, and whether it
ever reached a plan. "08" = the 21-07 memory audit; "FMA" = the 26-07 forensic
memory audit; "Reg" = Canon Register.

| ID | Finding | First documented | Re-found | Owner decision | In any executed plan? | Label |
|---|---|---|---|---|---|---|
| L1 | No correction economy — nothing a user corrects can be structurally retracted (patterns, parts, notes); only foreign-file release has a real invalidation path | 08 (risk 3; verdict b) | FMA M1/M5 | D8: deferred to future track | **NO** | **PROVEN** |
| L2 | Patterns permanent: `active:false` never written, no delete, dedup by exact `category` string | 08 (per-item row) | FMA M1/M2 | D8: deferred (M6) | **NO** | **PROVEN** |
| L3 | `continuityNote`: unbounded inbound, **full-column overwrite** per emission, head-400/tail-300 render truncation — middle silently invisible | 08 (per-item row; risk 1; verdict c) | FMA M8 | **D8: bounded fix ordered** → PR D scoped | **NO — PR D never planned** | **PROVEN** |
| L4 | Session-boundary amnesia: modality rejections + cycle context reset after any ≥4h gap — *"user rejected body work yesterday is NOT known today"* | 08 (risk 2; M4) | — (missed by FMA) | D8: keep session-scope unless extended | **NO** | **PROVEN** |
| L5 | The model never sees its own past reasoning — full state reports never re-enter context; visible history is its own stripped surface prose (style without thinking) | 08 (risk 4) | 26-07 architecture audit §1.5 | none | **NO** | **PROVEN** |
| L6 | Conclusion/correction asymmetry: conclusions land in permanent **structure**, corrections land in volatile **prose** | FMA (one-line mechanism) — implicit in 08's L1+L3 | — | none | **NO** | **PROVEN** |
| L7 | Category-level divergence: pattern *descriptions* stay faithful to the user; pattern *categories* carry model inference with equal standing; one rejected idea persisted under **three** category labels | **FMA (new)** | — | none | **NO** | **PROVEN** |
| L8 | Correction-guard evaporation: "do not reintroduce" lived only in continuityNote prose, survived six turns, vanished at 12:56:20 | **FMA (new)** | — | none | **NO** | **PROVEN** |
| L9 | `taskContract` steering on model inference: `currentFocus` set to an inference the user had not made (T3), later to a frame she had explicitly rejected (T8), with a render directive to check interventions against it | **FMA (new)** | — | none | **NO** | **PROVEN** |
| L10 | Memory friction was present and user-flagged **in the good session** («у тебя короткая память», repeated question T21) | 05-recorded-baseline | — | none | **NO** | **PROVEN** |
| L11 | Self-reinforcing re-injection: the model's own conclusions (note + patterns) are fed back every turn; no counterweight field exists for observation/uncertainty/withholding | 26-07 internal-analytic audit; mechanism rows in 08 | health report §1.5 | none | **NO** | **PROVEN** (mechanism) |

---

# 4. WHY MEMORY IS NOT WORKING — the consolidated mechanism

Five structural properties, all **PROVEN**, all present in both the good and
degraded sessions:

1. **Nothing can be taken back** (L1, L2). The only structured correction in
   the entire system is foreign-file invalidation. Everything else — a wrong
   pattern category, a rejected part, a mistaken hypothesis — is permanent
   until displaced from the top-5 window by newer material.
2. **The asymmetry** (L6, L3, L8). A conclusion is one emission away from
   permanent structure. A correction has no structure to land in, so it is
   written into a note that is overwritten wholesale each turn, truncated in
   the middle at render, and — demonstrated on 26-07 — evaporates within hours.
3. **Inference wears the user's clothes** (L7, L9). Pattern categories and the
   task-contract focus are model inferences, stored beside verbatim user quotes
   and re-injected with identical standing, including a directive to steer
   interventions by them.
4. **Refusals don't survive the night** (L4). Any ≥4-hour gap resets rejected
   modalities and cycle context. The prompt's "never re-offer" discipline has
   no cross-session substrate.
5. **The model inherits its conclusions but not its reasoning** (L5, L11).
   Every turn it reads its own verdicts (patterns, note) but never the thinking
   that produced them — and its visible reply history is its own reasoning-
   stripped prose. Interpretation compounds; procedure does not.

Net effect, one line (**PROVEN** as mechanism): *memory drifts monotonically
toward the model's interpretations and away from the user's corrections, and
the drift is invisible to the system that produces it.*

---

# 5. IS MEMORY THE CAUSE OF THE AI DEGRADATION?

The honest, labelled answer has three parts.

**(a) The mechanism is not new — so mechanism alone did not cause the change.**
**PROVEN.** Every property in §4 existed on 21 July, and memory friction was
user-flagged in the good session itself (L10).

**(b) Memory *content* is the only thing inside the system that changed.**
**PROVEN.** The system prompt is byte-identical to the good baseline (FULL_SHA
match, executed both trees); runtime code is behaviourally identical on the
clinical path; `MAX_TOKENS`/model/temperature/history-window unchanged. The
accumulated state — note register, pattern dossier, task contract — is the sole
endogenous variable that moved between 21 and 26 July. Its drift is documented
turn-by-turn (FMA §2–3): by the rejection turn the injected memory carried three
structured rows of a claim the user then rejected, a part she had dismissed, and
a contract directing the model toward the rejected root.

**(c) Verdict.** Memory-content drift is the **leading endogenous explanation —
STRONGLY SUPPORTED as a contributing cause, NOT PROVEN as the cause.** Two
exogenous confounders remain open and cannot be excluded from the repository:
server-side model drift (**UNKNOWN**) and the tester's own changed state and
explicit practice rejections (**UNKNOWN**). No controlled run has ever separated
them.

**The discriminating experiment exists and is specified:** run the live harness
twice on the same 21-July user turns — once with the fixture's original state,
once with the current accumulated state. The delta isolates the memory-content
effect; a third arm against today's model isolates model drift. Requires only an
`ANTHROPIC_API_KEY` in a reachable environment. Until it runs, (c) cannot move
from STRONGLY SUPPORTED to PROVEN.

---

# 6. WHERE IS THE MAPPING PLAN TO IMPROVE THE JOURNEY?

**Direct answer (PROVEN): a complete improvement map does not exist.** What
exists is fragmentary, and the memory track stops at a scoped-but-unwritten PR:

| Layer | Plan artefact | State |
|---|---|---|
| Prompt/canon reconciliation | `05-CLEANUP-ROADMAP.md` (phases 0–5) | exists; partially executed **out of order** (per health report §3); **contains no memory work** |
| Memory — bounded fix | Owner Decision #8 + **PR D** scope (Register:809-815) | decision taken 07-21; **PR D never planned line-by-line, never implemented** |
| Memory — correction stores (M2/M3/M5/M6) | "separate future design track" (D8) | **track never opened** |
| Behavioural verification | Golden Harness + mandated "comparison after every PR" (D8 safety protocol) | harness exists off-`main`; the mandate was **not followed** by any subsequent PR |
| Control plane (session, enforcement) | health report §recommendations | findings only — no owner-approved plan yet |

## 6.1 The missing memory map — skeleton for the owner's decision

Design-level only; honours Decision #8 (bounded, migration-free first; new
stores are a separate explicit decision). **Nothing below is authorised or
implemented; sequencing follows the D8 safety protocol (harness comparison per
step, tester-switch exposure, no irreversible migration).**

- **Step 0 — measurement first.** Add memory-fidelity metrics to the harness
  (rejected-frame re-injection count; correction survival across turns/sessions;
  note-growth curve). Without this, no memory change can be verified — the
  existing metrics cannot even distinguish the good and bad sessions on memory.
- **Step M-D (the already-decided PR D):** bound `continuityNote` inbound as
  every sibling field is bounded; replace silent middle-truncation with a rule
  the owner chooses (summarise / append-structured / hard cap); make the
  overwrite non-destructive. Migration-free. *(Precondition: owner picks the
  rule — the Register's M1 question, still unanswered.)*
- **Step M-1 (smallest structural correction):** a retraction path — allow the
  runtime to set `active:false` on a pattern/part when the user explicitly
  rejects it (the field already exists and is already filtered on; no schema
  migration). This converts L1/L2 from permanent to reversible using only
  existing structure.
- **Step M-2 (provenance):** mark stored items as user-verbatim vs
  model-inference at render (L7), so inference stops wearing the user's clothes.
  Render-side only.
- **Step M-3 (the deferred design track, owner decision required):** durable
  corrected-facts / rejected-hypotheses store; cross-session refusal memory
  (L4); repeated-question prevention. This is the "new architecture" D8
  explicitly reserved for a separate decision.
- **Step M-4 (reasoning continuity, ties to the clinician-mode question):** give
  the model a bounded window of its own recent clinical reasoning, and schema
  room for observation/uncertainty/withholding (L5/L11) — the code correlate of
  "reason before technique."

Every step gated on: owner sign-off → harness before/after → tester switch.

---

# 7. ONE-PARAGRAPH ANSWER

Memory findings were fully documented on 21 July (`08-memory-context-integrity.md`),
registered (M1–M6), decided (Owner Decision #8), and scoped into PR D — which
was then never planned or built, while execution pivoted to the anchor
clean-up; the 26-July audits re-derived the same findings without citing them.
Memory "does not work" because the system can record conclusions permanently
but cannot record retractions at all, feeds its own inferences back to itself
with the user's standing, forgets refusals at every 4-hour boundary, and never
shows the model its own reasoning. That machinery is unchanged since the good
session — but with prompt and code now proven byte-identical to the good
baseline, the accumulated memory **content** is the only internal variable that
moved, making memory drift the leading endogenous explanation for the
degradation — strongly supported, provable (or refutable) only by the specified
two-arm live harness run that still awaits an API key.

*Read-only. No fix implemented. No plan authorised without owner sign-off.*
