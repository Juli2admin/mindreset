# Journey runtime-mechanism audit — 2026-07-21

**Trigger:** Julia's live session (25 turns). Persisted `currentStage` stayed `1`
and `currentDepth` stayed `surface` for the entire session, while the AI performed
Stage 2 somatic mapping, Stage 4 parts contact, and Stage 5 origin-voice mapping +
symbolic return. This audit establishes whether that is intended, and traces the
complete runtime mechanism.

**Method:** four independent read-only forensic passes (reply-generation sequence,
stage-authority code map, source-of-truth doc comparison, repeated-defect history)
plus a faithful export of the exact assembled production prompt. No product code,
prompt, gate, or doc was changed. No fix proposed.

**Companion file:** `audit-2026-07-21-runtime-prompt-export.md` (Deliverable 1 —
the exact 341,561-char / ~92,300-token assembled system prompt).

---

## VERDICT (summary — full reasoning at the end)

1. **Is `currentStage` intended to control clinical work or merely describe it?**
   Contradictory by construction. The Clinical Manual, the stage specs, and the
   gate code treat it as **controlling** (strictly sequential, completion-gated).
   The runtime prompt (PR λ, 2026-07-11) treats it as **merely describing** ("a
   bookkeeping label … NOT capability gates"). Both ship simultaneously. As-built
   it does neither cleanly: it does not control (the gates never fire) and it does
   not describe (it froze at 1 while Stage 5 work ran).

2. **Did the AI violate the intended method by entering Stage 4–5 work?**
   Against the **Clinical Manual** (the self-declared source of truth): **yes** — it
   ran parts work, foreign-material work, and a symbolic return with none of the
   documented prerequisites (Adult Self built in Stage 3, parts met in Stage 4, all
   7 MII criteria, the 48-hour stability gate), much of it at intensity 6–7 which
   the method's own safety model treats as above the ceiling for deep work.
   Against the **runtime prompt it actually received**: **no** — it did exactly
   what the dominant flexible-map instruction told it. **The violation is the
   product's, not the model's.** The model faithfully followed contradictory
   instructions and obeyed the louder voice (a 92k-token prompt that repeatedly
   says "you lead, reach for any stage").

3. **Or did the progression system fail to record legitimate movement?**
   Also true — simultaneously, under the other philosophy. Under the flexible-map
   reading the movement was legitimate and the pointer failed to record it (three
   independent blockers, below). Under the sequential reading the movement was
   *illegitimate* (skipped safety gates). The progression system is trapped between
   the two: it enforces sequential gates that a flexible-map clinician's output can
   never satisfy.

4. **Is the visible-reply problem caused by the stuck stage, prompt contradictions,
   reply-generation architecture, or multiple causes?**
   Multiple, and **not** the stuck stage. Causes: (a) the visible reply is emitted
   *before* the `<state-report>`/`clinicalRead` in a single completion, so this
   turn's clinical read cannot inform this turn's reply, and there is no pre-reply
   assessment step (PR β removed it); (b) prior `<state-report>`s are stripped from
   conversation history — only distilled fields survive; (c) the `continuityNote`
   that holds "what we already covered" is read by no gate/router/closure code, is
   middle-truncated, and nothing instructs the AI to voice it; (d) the method's
   trauma-informed reflect-and-ask register does not flex for a regulated,
   direction-seeking user.

5. **Which previously implemented fix did not solve the problem, and why?**
   Several. The most important: the one **direct** fix for the stuck Stage-1 gate —
   removing the still-live anchor requirement (commit `4d08114`, 2026-07-19) — was
   **written but never merged**. See Deliverable 6.

6. **Single deepest root cause:**
   **The flexible-map pivot (PR λ, 2026-07-11) was a prompt-only change.** The
   progression engine (gates, `currentStage`/`currentDepth` semantics, the
   move-based lane), the Clinical Manual, and the stage specs were never re-derived
   to match it. The product now ships two contradictory clinical philosophies — a
   sequential, safety-gated progression engine and a flexible-map clinician prompt —
   that were never reconciled. Every symptom in this audit (stuck stage, dead depth
   field, repetition, "the AI follows") is downstream of that one unreconciled split.

---

## Deliverable 1 — exact complete runtime prompt

Exported to `audit-2026-07-21-runtime-prompt-export.md`.

- **Assembled by:** `assembleSystemPromptBlocks(state)` — `lib/journey/prompts/assemble.ts:589-651`.
- **Size:** **341,561 characters ≈ 92,300 tokens**, 4 system blocks (exact order):
  1. **Block 1 [CACHED] — 251,418 chars (73%):** canon header + Shared Core +
     Practice Generation Algorithm + **all 8 stage specs** concatenated
     (`assemble.ts:618-628`, `532-544`).
  2. **Block 2 [CACHED] — 45,093 chars:** master prompt up to the state-injection token.
  3. **Block 3 [dynamic] — 4,899 chars (1.4%):** the per-turn state block
     (`renderStateBlock`, `assemble.ts:151-453`) — the **only** place `currentStage`,
     `currentDepth`, task contract, continuity note, patterns, anchor, cycle status live.
  4. **Block 4 [dynamic] — 40,151 chars:** master prompt after the state token
     (examples, output-format, state-report schema).
- The four cached blocks are **identical across all 25 turns**; only Block 3, the
  user message, and the appended reminder vary per turn.
- **Not part of the system prompt:** the `STATE_REPORT_REMINDER` is appended to the
  **last user message** at API-call time only (`emission-reminder.ts:24-44`); never persisted.
- **Structural observation:** the persisted clinical position (`currentStage` /
  `currentDepth`) occupies ~2 lines inside a 4,899-char block that is 1.4% of a
  92k-token prompt, and is explicitly labelled "bookkeeping … NOT capability gates."
  The prompt structurally de-emphasises the very field the progression system treats
  as authoritative.

---

## Deliverable 2 — reply-generation sequence

Driver: `app/api/journey/turn/route.ts`. Order per turn:

1. Auth → rate-limit → body parse → screening/deletion/access/$-cap gates (`route.ts:89-195`).
2. `loadJourneyState(userId)` (`route.ts:197`; `state/load.ts:164-332`).
3. Frozen-for-review and synchronous keyword red-flag branches return canned copy
   with **no LLM call** (`route.ts:223-334`).
4. **Persist the user's encrypted message BEFORE the LLM call** (`route.ts:338-345`).
5. Load last 30 messages, decrypt, leak-mask (`route.ts:348-389`; `HISTORY_LIMIT=30`).
6. `assembleSystemPromptBlocks(state)` (`route.ts:360`).
7. `appendEmissionReminder(...)` — reminder added to the final user message of the
   **outbound array only** (`route.ts:397`; `emission-reminder.ts:36-44`).
8. **One single streamed completion:** `anthropic.messages.stream({system, messages})`
   (`route.ts:399-404`; `MAX_TOKENS=2500`). The human reply **and** the
   `<state-report>` (which contains `clinicalRead`) are one output text.

**Answers to the seven questions:**

1. *Info before the visible reply:* the full assembled system prompt (all prior
   distilled state — continuity note, task contract, patterns, anchor, cycle status),
   plus the clean reply-only conversation history, plus the current user message with
   the emission reminder appended.
2. *One completion or two?* **One** streamed completion produces both the reply and
   the state-report. (A second model call, `runJourneyVerifier`, is a safety
   classifier over the user message, run **after** the reply; it does not produce
   `clinicalRead` or the reply — `route.ts:620-622`.)
3. *When is `clinicalRead` generated?* **After** the visible reply, within the same
   completion — the output format mandates reply first, `<state-report>` after
   (`journey-master.md:609-614,817-827`; parser `stateReport/parse.ts:140-153`;
   streamer stops at `<state-report>` — `streaming/reply-processor.ts:236-243`).
4. *Can the reply use this turn's `clinicalRead`?* **No.** The reply is the first
   thing emitted; there is **no** pre-reply `<assessment>`/`<thinking>` step
   (explicitly removed, `journey-master.md:815`; PR β dropped it for latency —
   `route.ts:406-415`). The model's *unserialised* reasoning shapes the reply, but
   the `clinicalRead` artefact is produced downstream and cannot be consumed by the
   same-turn reply.
5. *Which prior artefacts are in context?* Assistant history messages are **stripped
   human replies only — no prior `<state-report>`, no prior `clinicalRead`**
   (`route.ts:606-613`; strip at `parse.ts:140-154`). Prior clinical intelligence
   reaches the model **only** as distilled state-block fields: `continuityNote`
   (`load.ts:310` → `assemble.ts:410-439`), `taskContract` (`load.ts:325-327` →
   `assemble.ts:168-178`), a single prior `clinicalRead` **only** via
   `openCycleDescription` (`load.ts:432` → `assemble.ts:268-270`), and the landscape
   captures (parts/foreign/patterns/images).
6. *What is removed from history before the next turn?* The `<state-report>` block
   (and any `<assessment>`/`<thinking>`) is removed before persistence
   (`route.ts:522,606-613`; `parse.ts:129-154`). The emission reminder is never
   stored. Leaked/empty replies are masked/placeholdered.
7. *Order of parse/save/render:* **render first** (streamed to the user as deltas
   arrive), **then** parse the state-report, **then** persist the assistant reply,
   **then** apply state to progress/landscape, **then** write the encrypted audit
   row, **then** run the router (`decideRoute`/`applyRouteDecision`). The router —
   the only thing that can move `currentStage` — runs **last, after the reply already
   went out** (`route.ts:442-495,522,606-700`).

**Implication for the repetition symptom:** the reply is generated with no access to
this turn's own assessment, and with no prior state-report in history — only the
head/tail-truncated continuity note. When "we already asked X" is not in that
truncated note, the model can and does re-ask it, then correctly flags the rupture
in the state-report it writes *afterwards* (exactly what happened in Julia's session).

---

## Deliverable 3 — stage authority map

| Authority | Influences model? | Blocks an intervention? | Telemetry only? | Changes prompt? | Changes access/progression? | Authoritative when disagreeing |
|---|---|---|---|---|---|---|
| `currentStage` | Weakly, and framed as *ignore-as-gate* (`assemble.ts:196-200,479`) | **No** — gates nothing the model may do; all 8 specs load regardless | Copied to every audit row (`stageAtTurn`) | Yes — one "bookkeeping label" line | **Yes** — router cursor: which gate runs, +1 target, regression floor, Stage-8 discharge (`router.ts:94,112-135,210-227`) | For progression bookkeeping: `currentStage`. For clinical method: the model's per-turn choice |
| `currentDepth` (surface/middle/deep) | Cosmetic prompt line only | No | **Yes — inert** | Yes (`assemble.ts:201`) | **No** | — **DEAD FIELD:** the only writer (`save.ts:116`) reads `recommendedDepth`, which **nothing populates**; router resets it to `surface` on every advance/regress (`router.ts:214,224`). Pinned to `surface` for life; no gate reads it |
| Classic stage gates | No (run after reply) | **Yes** — advancement | No | No | Yes | Requires `recommendedAction:'advance'` (`stage-gates.ts:56-63,108-111`) **plus** last-2 intensity ≤5 **plus** per-stage MII criteria |
| Move-based lane | No | Advancement (parallel) | No | No | Yes | Fires only if ≥3 recent turns have `stage_N.*` moves at ≥ target, intensity ≤5, safety none, adultSelfPresent ≥50%; **ignores** `recommendedAction` (`move-based-advance.ts:31,47-50,155-196`) |
| `recommendedAction` | No (not rendered back) | Gate input | Persisted | No | Regression: near-authoritative (`router.ts:80-91`). Advance-classic: necessary-not-sufficient. Advance-move: ignored | Split |
| `readinessTouched` | No | Gates Stages 1–2 only (`stage-gates.ts:116-126,158-177`) | Yes | No | Yes (Stage 1–2) | — |
| Stage playbooks in prompt | **All 8, every turn** (`assemble.ts:532-544`) | No | No | Yes | No | — |
| Cross-stage permission | **Yes — explicit** (`assemble.ts:479,483,199`) | Removes all stage gating on method | No | Yes | No | Model judgment is "the final call" (`assemble.ts:483`) |
| Intensity limits (≤5) | Sees last reading only | **Yes** — both gate lanes | No | Yes (last reading) | Yes | Gate math authoritative; model sees only `lastIntensity` |
| Adult-Self (`adultSelfPresent`) | No (boolean not rendered) | **Yes** — Stage 3/4/6/7 gates + move lane | Yes | No (only `adultSelfQualities` prose shown) | Yes | — |
| Cycle status | `hasOpenCycle` renders a "do not close" block (`assemble.ts:263-271`) | **Yes** — an open cycle on the last turn blocks **advance + discharge on both lanes** (`router.ts:76,95-97,107-109`) | `cycleCanClose` is telemetry (read by no code) | Yes | Yes | Router reads only `cycleStatus==='open'` on the last turn |
| Release guards | Provisional/confirmed rendered (`assemble.ts:341-347`) | Stage-5 gate needs `releasedAt` (confirmed), not a claim (`stage-gates.ts:330-358`; `save.ts:289-374`) | Partly | Yes | Yes | Confirmed-across-time release authoritative |

**Why the stage stayed at 1 for all 25 turns — three independent, each-sufficient blockers:**
1. **Classic gate:** the AI emitted `recommendedAction:"stay"` on every turn; the
   classic gate hard-requires `"advance"` (`stage-gates.ts:56-63`). Also, the Stage-1
   gate still requires an anchor token that canon dropped (Deliverable 6, defect E).
2. **Move-based lane:** the deep work ran at **intensity 6–7**, above the lane's ≤5
   ceiling; and `adultSelfPresent` was emitted on only ~1 of 5 calm-tail turns,
   below the 50% ratio (`move-based-advance.ts:155-196`).
3. **Open-cycle guard:** the therapeutic cycle was **open** across the deep work;
   an open cycle blocks **both** advancement lanes outright (`router.ts:107-109`).

`currentStage` is authoritative for *the record of progression and access to
discharge*; the **model's per-turn playbook choice is authoritative for the actual
clinical position**. The persisted stage is designed to *lag and follow* the model
(the move lane advances the pointer *because* the model did higher-stage moves) — so
it structurally cannot represent the live clinical position, only trail it.

---

## Deliverable 4 — source-of-truth contradictions

Four "voices," two philosophies:

- **Sequential:** `CLINICAL_MANUAL.md` (self-declared source of truth), the stage
  specs (`01/04/05-*.md`), and `journey-master.md`'s `<assessment_phase>`.
- **Flexible map:** `journey-master.md`'s method/memory layers, and `assemble.ts`.
- **Hybrid:** `00-shared-core.md` (any order in prose, but code-enforced 48h gate).

| Question | Sequential voices say | Flexible voices say | Contradiction |
|---|---|---|---|
| Stages sequential or a map? | "Only then can the client safely enter Block 3" (`CLINICAL_MANUAL.md:875`); "proceed to Block 5 only if…" (`:1785`) | "NOT a sequence of fixed gates" (`journey-master.md:11`); "Stage numbers are a bookkeeping label … NOT capability gates" (`assemble.ts:479`) | **YES (central)** |
| Stage 1 assessment-only? | "Deep Level — Prohibited in Block 1 … parts work or reparenting" (`CLINICAL_MANUAL.md:162-174`); "No deeper work is permitted in this stage" (`01-*.md:17`) | "use the Stage 5 playbook even if the router still labels them Stage 1" (`assemble.ts:479`) | **YES** |
| When is parts (Stage 4) work allowed? | Only after Stage 3 closes, Adult Self reproducible ≥2 days (`04-*.md:25-30`) | A move "available every turn" when a part surfaces (`journey-master.md:104,158`) | **YES** |
| When is foreign-material (Stage 5) allowed? | Only after all 7 MII + 48h (`05-*.md:29`; `CLINICAL_MANUAL.md:1945-1961`) | Available any turn the user names outside material (`journey-master.md:173-176`) | **YES** |
| When is symbolic return allowed? | Adult Self (St 3) + parts met (St 4) + 7 MII + 48h + not within 48h of prior deep release (`05-*.md:19,29,184,190`) | No stage prerequisites (`journey-master.md:185`; `assemble.ts:479`) | **YES** |
| Reach across stages before persisted advance? | Forbidden; "waits for Block 2+" (`journey-master.md:251`) | "not a constraint … Use what serves" (`journey-master.md:470`); "the final call" (`assemble.ts:483`) | **YES** (incl. inside `journey-master` itself) |
| What do surface/middle/deep control? | Redefined per-block with different meanings (`CLINICAL_MANUAL.md:108-176,1459,2011,2923`) | One global definition only in `journey-master.md:380`; persisted `currentDepth` **undocumented** — no doc says what it controls | **YES (gap)** |

**`journey-master.md` contradicts itself:** its method layer says the 8 moves are
"available every turn" (`:104`) and the stage marker is "not a constraint … Use what
serves" (`:470`), while its `<assessment_phase>` forbids parts/foreign/integration
in Block 1 and says depth work "waits for Block 2+" (`:244-251`).

**Three additional concrete doc bugs found:**
- **Anchor self-contradiction:** Stage-1 §8 says do not name the anchor / capture by
  observation (`01-*.md:101-114`); the same spec's Worked Example C still runs the
  scripted 4-step anatomy and says "Name explicitly … 'This is your anchor'"
  (`01-*.md:207-216`), violating the master prompt's "NEVER say 'anchor'"
  (`journey-master.md:112`).
- **Gate-token drift:** `anchor_identified` is "retired / no longer a gate token" in
  the Stage-1 spec (`01-*.md:106,148-153`) but still listed "GATE-REQUIRED" in
  `journey-master.md:773`.
- **`redFlagType` enum mismatch (latent safety-parse gap):** `journey-master.md:630`
  requires `panic_severe`/`dissociation_severe`/`flashback_in_progress` and says bare
  `panic`/`dissociation`/`flashback` "will be parsed as junk" — but the fallback
  schema in `assemble.ts:54` (and `00-shared-core.md:250`) still emits the bare forms.

---

## Deliverable 5 — transcript-to-runtime trace (7 moments)

All moments ran at **persisted `currentStage:1 / currentDepth:surface`**, with the
same cached canon (all 8 specs, "bookkeeping label" framing) active. Move labels
are the AI's own `moveJustPerformed`; Manual-compliance is judged against the
sequential source of truth.

| # | Moment | Move (self-reported) | Intensity / safety | Permitted by runtime prompt? | Advanced? Why not | Complies with Clinical Manual? |
|---|---|---|---|---|---|---|
| 1 | Somatic anchor | `universal.practice_somatic` | 2 / none | Yes (Stage 1 stabilisation) | No — `stay`; anchor just set | **Yes** — this is Stage 1 work |
| 2 | Somatic contrast (husband entering) | `stage_2.affect_labelling_and_somatic_mapping` | 3–4 / none | Yes (flexible map) | No — `stay`; <3 qualifying move turns | Borderline — Stage 2 affect work at persisted Stage 1 |
| 3 | Staircase girl introduced | `stage_4.first_contact` | 6 / none | Yes (flexible map) | No — intensity 6 > 5 | **No** — parts work (Block 4) prohibited until Block 3 complete (`CLINICAL_MANUAL.md:162-174`) |
| 4 | Father's death / mother's collapse | `stage_2.soft_why_inquiry` (origin) | **7 / watch** | Yes (flexible map) | No — safety=watch, intensity 7 | **No** — Block 1 prohibits "trauma memories; childhood material; deep emotional excavation" |
| 5 | Foreign-material hypothesis | `stage_5.origin_voice_mapping` | 6 / none | Yes (flexible map) | No — intensity 6 > 5; open cycle | **No** — Block 5 requires Block 4 complete + 7 MII + 48h; none met |
| 6 | Symbolic return of maternal fear | `stage_5.symbolic_return` + `foreignFileReleased` (provisional) | 5→4 / none | Yes (flexible map) | No — open cycle; adultSelf ratio <50% | **No** — the exact Stage-5 contraindications (no Adult Self built, no parts integrated, no 48h) were all present (`05-*.md:190`) |
| 7 | Release + session close | `universal.session_close`; `releaseClaimedAt` stamped (provisional) | 3 / none | Yes | No — session ended at Stage 1 | Partial — provisional-release discipline was correct; close-with-open-cycle was guarded |

**Cross-cutting observation (safety):** from moment 3 onward the AI ran work the
Manual prohibits at Stage 1, **at intensity 6–7** — above the ≤5 regulation ceiling
that *both* gate lanes and the Manual treat as the limit for deep work — with no
Adult Self built and no 48h stability gate. The flexible-map prompt has no such
ceiling, so it permitted the descent because the material was "alive." Whether that
is acceptable is a clinical-governance decision; this audit only records that the
runtime permitted what the method's own safety model contraindicates.

---

## Deliverable 6 — repeated-defect history

The git history is heavily squashed (`456e9a9`, 2026-07-12, folded the whole Journey
execution layer in one commit), so pre-squash PR labels in code comments (PR 4b, PR λ,
PR κ, #177–#184) exist only in comments + the `docs/journey/*` audit series, not as
separate commits. Verified against current `HEAD`.

| Date | Event | Outcome | Still present in `main`? |
|---|---|---|---|
| 2026-06-19 | First audit: gates check fields no code populates; "user stays in Stage 4 forever; nobody knows why" (`audit-2026-06-19.md:191`) | Diagnosis only | Yes (the class of bug) |
| 2026-06-23 | Design-vs-delivery: "70 turns, 1 logged practice" — AI runs deeper than state records | Diagnosis only | Yes |
| 2026-06-26→28 | #177 removes `formulation_confirmed`; handoff claims "'stuck at Stage 1' … fully fixed" (`SESSION_HANDOFF.md:150`) | **Contradicted 2 days later**; removed one token, kept the anchor requirement | — |
| 2026-06-30 | 5-agent audit: "users never advance past Stage 1"; Root A (report emitted after reply → omitted/truncated → parser default `{5,watch,stay}` "biased to never advance"); Root B (gates 2–8 require un-emitted fields → ladder impassable past Stage 2) | Milestone 1 (St 1→2) shipped; **Milestone 2/3 never built** (`execution-rebuild-plan.md:124-146`) | Milestone 2/3 still missing |
| 2026-07-07 | **PR 4b — move-based lane introduced.** Rationale verbatim: "the router stayed at Stage 1 while the AI ran textbook Stage 6/7 work" (`move-based-advance.ts:9-18`) | **Compensating workaround, not a fix**; inherits arc-only assumption (`stage_N.*` only) | **Present & live** (`router.ts:132-142`) |
| 2026-07-11 | **PR λ — all 8 specs every turn; stage = "bookkeeping label."** | **Licenses cross-stage work by design**; creates the standing prompt-vs-router contradiction | **Present & live** (`assemble.ts:195,479`) |
| 2026-07-02 | Canon §10 drops the anchor requirement; master marks `anchor_identified` "retiring" — **gate code never updated** | Canon–code contradiction created | **Still live** — `stage-gates.ts:113,121` still require the anchor |
| 2026-07-19 | Three audits re-diagnose everything as still-present: anchor gate contradiction (RC6/A2), asymmetric router "downward/hold bias" (A3), `continuityNote` "read by no code" (A9/§4), move-lane un-sticks "only … the arc" (A4) | Fixes proposed, **none implemented** ("per restrictions") | Yes |
| 2026-07-19/20 | Remediation split: branch `claude/journey-remediation` **fixes the anchor gate** (`4d08114` deletes `stage-gates.ts:113,120-121`); a curated subset re-packaged as #325–#329 merged | **The anchor-gate fix was NOT in the merged subset** | `4d08114` **NOT in `main`**; anchor gate still live |

**Per-defect status now:**
- **A. Stage 1 stuck while AI works deep** — still possible. Classic ladder past
  Stage 2 never completed; Stage-1 anchor gate still blocks; asymmetric router holds;
  move-lane only rescues arc-shaped sessions.
- **B. Move-based advancement** — present; symptom-level pointer-nudger, not a fix.
- **C. Cross-stage / premature deep work** — present **by design** (PR λ).
- **D. AI running beyond persisted stage** — present; prompt-vs-router never reconciled.
- **E. Anchor/gate inconsistency** — **fixed in `4d08114`, fix never shipped.**
- **F. State/continuity not shaping the reply (repetition)** — largely present;
  `continuityNote` read by no gate/router/closure and middle-truncated
  (`assemble.ts:427`); `clinicalRead` consumed only as open-cycle description; the
  P3 task-contract (#327) is *rendered* but nothing routes or gates on it.

**Why prior fixes did not hold:** #177's "fully fixed" was contradicted in 2 days;
the 2026-06-30 rebuild was completed only through Milestone 1; PR 4b is a compensator;
PR λ softened the prompt while creating the core contradiction; and the single direct
fix (`4d08114`) was written but never merged. **No prior fix addressed the root split
between the sequential engine and the flexible-map prompt — several audits named it
(F6, RC-series) and it was never resolved.**

---

## Final verdict — full reasoning

**1. Control or describe?** Both are wired in and they conflict. The Manual + specs +
gate code intend `currentStage` to **control** (sequential, completion-gated). PR λ's
prompt intends it to **describe** ("bookkeeping … NOT capability gates"). Shipping both
means it does neither: the gates require milestones a flexible clinician never emits, so
they never fire (no control), and the pointer freezes while real Stage-5 work runs (no
accurate description).

**2. Did the AI violate the method?** Yes against the Clinical Manual — parts, foreign
material, and symbolic return with none of the documented prerequisites, at intensity
6–7. No against the prompt it received, which is dominated (92k tokens) by "you lead,
reach for any stage, stage numbers are not gates." **The model obeyed the loudest,
most repeated instruction. The fault is the contradictory product, not the model.**

**3. Or did progression fail to record legitimate movement?** Both, depending on the
philosophy applied. The movement was "legitimate" under the flexible-map prompt and the
telemetry failed to record it (three blockers); it was "illegitimate" under the
sequential Manual (skipped safety gates). The progression system is trapped between the
two.

**4. Cause of the visible-reply problem:** reply-generation architecture + prompt
contradictions, **not** the stuck stage. Reply precedes the state-report; no pre-reply
assessment; prior reports stripped from history; the continuity note that would prevent
repetition is truncated and consumed by nothing; and the register does not flex. The
stuck stage does not gate the register (all 8 specs load regardless), so it is not the
cause — it is a parallel symptom of the same root split.

**5. Which fix failed and why:** the anchor-gate removal (`4d08114`) — the one change
that would let a stable non-arc user leave Stage 1 through the classic gate — was
written on 2026-07-19 and **never merged** (the shipped subset #325–#329 excluded it).
Earlier "fixes" (#177, the Milestone-1 rebuild, PR 4b, PR λ) each addressed one surface
and left the root split intact; two of them (PR λ, PR 4b) deepened it.

**6. Single deepest root cause:** **an unreconciled dual source of truth.** The method
was authored sequential (Clinical Manual, specs, gates, MII, 48h transitions). On
2026-07-11 the *prompt* was pivoted to a flexible map (PR λ) without re-deriving the
progression engine, the gates, `currentStage`/`currentDepth` semantics, or the Manual to
match. The runtime now simultaneously runs a sequential safety-gated engine and a
flexible-map clinician that structurally cannot satisfy those gates. Every symptom —
the stuck stage, the dead `currentDepth`, the repetition, and Julia's "the AI follows"
feeling — is a downstream consequence of that one split, which multiple prior audits
named and no prior fix resolved.

---

*Audit is factual and read-only. No fix proposed, no prompt drafted, no PR opened,
per the request. The exact prompt export is the companion file.*
