# Journey Health Audit — 2026-07-26

> **Trigger:** owner report — *"the AI degraded big time, so whatever we are
> doing doesn't help."*
>
> **Evidence base:** a real 25-turn session transcript (RU) for
> `user_3EfVFP02L8njKj2T36EvDAB0Z07` spanning 2026-07-24 → 2026-07-26, plus the
> matching admin-inspector state-report record for all 25 turns.
>
> **Status:** read-only audit. No code changed, no PR opened by this document.

---

## 0. Headline

The degradation is **real, reproducible, and structural**. It is not primarily
caused by the anchor/prompt clean-up PRs.

**The Stage 2 advancement gate is mathematically impossible to pass.** Every
user who reaches Stage 2 is trapped there permanently. The tester has been held
at `stage 2 / surface` for all 25 turns across 3 days and 5 sessions.

Because Stage 2's clinical repertoire is narrow (affect labelling + Soft Why),
a permanently-trapped user experiences exactly what the tester reported in her
own words: **«Мы ходим с тобой по кругу»** — *we are going in circles*. That
complaint is not a perception. It is an accurate description of the runtime
state.

This defect predates the recent clean-up PRs. Those PRs neither caused it nor
could ever have fixed it — which is precisely why months of prompt tuning
produced no improvement.

---

## 1. Root cause — the Stage 2 gate reads a vocabulary the AI is never given

### The mechanism

`lib/journey/router/stage-gates.ts::checkStage2Gate` requires three tokens to
appear in the state report's `readinessTouched` array:

```js
if (!hasToken(/emotion[_-]?named/i))                    → 'emotion_not_named'
if (!hasToken(/emotion[_-]?located|body[_-]?located/i)) → 'emotion_not_located_in_body'
const softWhyTouched = hasToken(/soft[_-]?why/i);       // ← the sealed door
if (!softWhyTouched) reasons.push('soft_why_not_asked_or_answered');
```

The live system prompt defines the **complete permitted vocabulary** for
`readinessTouched` (`docs/journey/runtime/journey-master.md:647`):

```
"anchor_identified", "body_located", "emotion_named", "orientation_present",
"pain_named", "alliance_formed", "observer_seat_touched", "adult_self_present",
"foreign_file_identified", "foreign_file_released", "formulation_confirmed"
```

**There is no `soft_why` token in that list.** The prompt's own emission
checklist (`journey-master.md:795–807`) never instructs the AI to emit one, and
the prompt forbids inventing fields outside the schema. The gate therefore tests
for a token the AI is structurally incapable of producing.

### Where the token went

`soft_why_asked` / `soft_why_answered` were real tokens — but they were defined
in `docs/journey/runtime/stage-02.md`, a **Generation-B per-stage prompt file**
(`stage-02.md:366–370`, and its `recommendedAction` rule at line 357).

That file is **not part of the live prompt**. `lib/journey/prompts/load-spec.ts`
assembles only `00-shared-core.md`, `PRACTICE_GENERATION_ALGORITHM.md`, the
eight `0N-stage-*.md` specs, and `runtime/journey-master.md`. `stage-02.md` is
absent from `main` entirely.

**This is the "two coexisting generations" conflict (Conflict A / roadmap step
4.1) in its most damaging form: the router still belongs to Generation B, while
the prompt is Generation C. The gate reads a vocabulary only the retired
generation ever taught.**

### Proof (executed against the real gate code)

A temporary diagnostic ran `checkStage2Gate` against a **clinically perfect**
Stage 2 user: intensity 3, safety clean, `recommendedAction: 'advance'`,
`emotion_named` + `body_located` + `orientation_present` emitted, and
`stage_2.soft_why_inquiry` performed on 10 separate days.

```
[B] PERFECT USER → passed: false
    reasons: [ 'soft_why_not_asked_or_answered' ]
```

Adding a literal `soft_why` token to `readinessTouched` — a token the prompt
never authorises — is the only thing that opens the gate:

```
[C] WITH soft_why TOKEN → passed: true   reasons: []
```

**Conclusion: Stage 2 → Stage 3 is a sealed dead end for every user of The
Journey.** (Diagnostic file was deleted after the run; it is reproducible from
this description.)

---

## 2. Downstream consequences observed in the real session

The single sealed gate explains nearly every symptom in the transcript.

### 2.1 Repertoire collapse

With the user pinned to Stage 2, the AI's legitimate move set is essentially
`witness_and_reflect`, `affect_labelling_and_somatic_mapping`, and
`soft_why_inquiry`. Measured across the 25 inspector turns:

| Signal | Count |
|---|---|
| Turns at `stage 2 / surface` | **25 / 25** |
| `universal.witness_and_reflect` | **24 / 25** |
| `stage_2.soft_why_inquiry` | 11 |
| **`practiceRun` (any practice at all)** | **1 / 25** |
| `universal.rupture_receive` | 4 |
| `adultSelfQualities` ever captured | **never** |
| Intensity range | **5 – 8** (never settles) |

One practice in twenty-five turns, at sustained intensity 5–8, is the clinical
signature of a system that has run out of permitted moves. Every AI reply
degenerates into *reflect + ask one more probing question* — which is exactly
the loop the user named.

### 2.2 Out-of-stage improvisation (safety-relevant)

Sensing the clinical dead end, the model improvised moves from stages the user
has never reached:

- `2026-07-26T09:05:04` — `moveJustPerformed: ["stage_2.soft_why_inquiry",
  "stage_5.origin_voice_mapping"]` — a **Stage 5** move at Stage 2.
- `2026-07-26T09:07:44` — `moveJustPerformed: ["universal.witness_and_reflect",
  "stage_4.first_contact"]`, `therapeuticMode: "parts_work"`,
  `partsTouched: [девочка на лестничной площадке]`, with
  **`adultSelfPresent: false`**.

This violates the method's central safety rule. The Architectural Update states
Adult Self is a **structural safety requirement** and that without it the system
must not proceed into *parts work, childhood material, emotional scenes,
corrective experiences, or identity reconstruction*. The live master prompt says
the same (`journey-master.md:380`: *"Middle (parts work, foreign material)
requires Adult Self present"*).

**No code enforces it.** The gates govern the stage *label*; nothing constrains
which moves the model may perform. The final turn of the transcript opens
childhood-origin material — *«Когда ты впервые помнишь это чувство…»* — at
intensity 6, with no Adult Self established, in a session the user had already
ruptured twice.

This is the highest-severity finding in this audit. It is a methodology-fidelity
and user-safety issue, not a quality issue.

### 2.3 Imposed constructs and rupture

Because the AI could not advance, it kept re-entering the same two symbolic
images (камень, девочка у окна). The user rejected both explicitly:

- *«ну ты прям как меня программируешь… это тупое вообще какое-то»*
- *«Оставь девочку в покое, пожалуйста… ты не анализируешь, как клинический
  психолог, ты херню занимаешься»*

The AI's own `clinicalRead` concedes it: *"I imposed the construct and kept
returning to it."* Shared Core §4 forbids imposed imagery. Six to seven distinct
ruptures occur in 25 turns, including a session abort at intensity 8
(`stabilityCheck: {score: 3, contextNote: "refused_at_close"}`) and the user
saying *«я не знаю, для чего ты тогда мне нужна»*.

### 2.4 Additional (legitimate) blockers

Two further gate conditions also fail for this user — last-two intensities ≤ 5
(hers are 6, 6) and `recommendedAction: 'advance'` (always `'stay'`). These are
**clinically correct** refusals: she is genuinely activated. They are noted so
that fixing the `soft_why` token alone is not mistaken for a complete fix.

---

## 3. Reconciliation — what was done vs what the plan required

The System Canon (`system-canon-2026-07-21/`, unmerged on this branch) set two
rules above all others:

> *"Nothing behavioural moves before Phase 0.2"* — the owner ratifies the canon
> and decides, per conflict, which generation is canonical.
>
> *"Every Phase-4 step is guarded by the golden harness … an objective
> before/after, not an impression."*

Neither was honoured.

| Merged to `main` | Roadmap class | Required guard | Actually done |
|---|---|---|---|
| #340 PR A0 clean-runtime | Phase 3 (dead code) | Phase 2 proof-of-no-reader first | ran ahead of Phase 0/2 |
| #341 B1a Stage-1 anchor truthfulness | Phase 1 (docs) | mechanical | ✅ |
| #342–#347 B1b Stage 2–5 anchor removal | **Phase 4.2 — HIGH RISK, gated on 4.1** | golden harness before/after | ❌ none; 4.1 never decided |
| #344 / #346 stock-wrapper + example de-anchoring | **Phase 4.6 — corpus reduction** | owner review of every clinical reduction | ❌ no behavioural check |
| #354 Unit 1 §6 rewrite | **Phase 4.2 anchor** | golden harness before/after | ❌ none |
| #325 P1 / #326 P2 / #327 P3 | **Phase 4.7 — behavioural** | golden harness before/after | ❌ none |
| #322 M1 memory, #328 emission reminder, #329 comms register | behavioural (prompt/context) | — | structural verification only |
| #348–#351 cap/telemetry | out of scope (ops) | — | ✅ correctly scoped |

**The Golden Harness — built specifically to catch behavioural regression —
exists only on this audit branch (`mindreset-app/eval/journey/`). It has never
been merged to `main` and was never run against any of the merged changes.**
Every green check the owner approved was a *unit test* (structure), never a
behavioural check.

**Phase 0.2 — the subsuming map-vs-engine ratification — was never taken.** The
work jumped straight to the high-risk Phase-4 reconciliations. Section 1 of this
document is the direct cost of that omission: the router and the prompt now
belong to different generations, and no amount of prompt editing can reconcile
them.

### Still unmerged (work that exists but is not on `main`)

- The entire System Canon (Docs 1–10) and the Canon Resolution Register
- The 12-document runtime audit + the 4,580-line live prompt export
- The Golden Harness and the recorded baseline
- Unit 2 (Adult-Self ⟂ Anchor decoupling) — drafted, paused

---

## 4. Findings, ranked

| # | Finding | Severity | Status |
|---|---|---|---|
| **F1** | Stage 2 gate unpassable — `soft_why` token does not exist in the live prompt vocabulary. All users trapped at Stage 2 permanently. | **CRITICAL** | **Proven by execution** |
| **F2** | Parts work / childhood material performed with `adultSelfPresent: false` at Stage 2. No code enforces the Adult Self safety precondition. | **CRITICAL (safety)** | Proven from inspector |
| **F3** | Clinical repertoire collapse — 1 practice in 25 turns at intensity 5–8. | HIGH | Measured |
| **F4** | Imposed imagery (камень, девочка) repeatedly re-entered after explicit user rejection; violates Shared Core §4. | HIGH | Transcript + AI's own clinicalRead |
| **F5** | Router/prompt generation split (Conflict A) is live and unreconciled; gates govern labels only, not model behaviour. | HIGH | Proven (F1 is an instance) |
| **F6** | 8 behavioural PRs merged with no behavioural verification; harness never on `main`. | HIGH | Merge history |
| **F7** | Anchor clean-up PRs may have thinned the regulation repertoire further. **Unproven** — no before/after exists. | MEDIUM (hypothesis) | Not established |

Note on F7: the anchor PRs remain a *plausible contributing* factor to F3, but
this audit found no evidence that they are the primary cause, and it declines to
assert one without a baseline comparison.

---

## 5. Recommended sequence

Ordered by leverage. No work is authorised by this document.

1. **Fix F1.** Smallest correct fix: add `soft_why_asked` / `soft_why_answered`
   to the live `readinessTouched` vocabulary and to the emission checklist in
   `journey-master.md`, matching what `checkStage2Gate` already tests for. Add a
   gate test asserting a clinically-complete Stage 2 user passes.
2. **Add a permanent regression test class:** for every stage gate, assert that
   an ideal user *can* pass it using only tokens the live prompt authorises.
   This defect class — gate tests a vocabulary the prompt cannot emit — must be
   made structurally impossible to reintroduce.
3. **Fix F2.** Enforce the Adult Self precondition in code: refuse/flag
   `therapeuticMode: parts_work` and `stage_4.*` / `stage_5.*` moves when no
   Adult Self is established. Prompt text alone has demonstrably failed.
4. **Merge the Golden Harness to `main`** and make a behavioural run mandatory
   for any prompt/gate change. Requires a provisioned `ANTHROPIC_API_KEY` in an
   environment that can reach the API.
5. **Take Phase 0.2** — the map-vs-engine decision — before any further
   reconciliation work, including Unit 2.
6. Only then resume the anchor clean-up (Units 2–4).

---

## 6. Answer to the owner's question

*"Whatever we are doing doesn't help"* — correct, and now explained.

The clean-up work was tuning the wording of a prompt while the router held the
user in a stage with a two-move repertoire and a sealed exit. No edit to §6, to
the anchor rules, or to any stage spec could have released her, because the
blocker was a token mismatch between the gate and the prompt — invisible to
every unit test we ran, and invisible to a code review that reads either side
alone.

The tester was not experiencing a degraded personality. She was experiencing a
system that had run out of legal moves.
