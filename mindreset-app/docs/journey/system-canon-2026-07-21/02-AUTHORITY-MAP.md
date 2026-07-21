# Doc 2 — AUTHORITY MAP: who decides what, and what overrides what

This document records, for each observable Journey behaviour, which component
actually has authority over it in the live runtime, and the precedence when
components disagree. It does not say which arrangement is correct.

---

## 0. The one structural fact that governs all authority

**The model writes prose and a JSON state report. Code decides everything
that persists or moves.** The model has authority over the *words the user
sees*; it has authority over *state and stage only to the extent that code
reads the fields it emits*. A field the model emits that no gate reads changes
nothing (see Doc 3, and the field table in the runtime-integrity audit).

So there are two authority planes:

- **Advisory plane (prompt-driven):** the master prompt + Shared Core + 8 stage
  specs shape the reply and which state-report fields the model fills. This
  plane has **no binding power** over stage movement, freezing, or persistence.
- **Binding plane (code-driven):** the gates, router, safety lanes, and
  persistence layer. Only this plane changes stored state.

---

## 1. Authority by behaviour

| Behaviour | Authoritative component | Binding? | Notes / file:line |
|---|---|---|---|
| **Words the user reads** | the model (Sonnet 4.6), shaped by the master prompt/specs | — | prompt is advisory; code only *strips* private tags (reply-processor.ts) and *substitutes a placeholder* on a detected leak (route.ts:602-605) |
| **Whether the LLM is called at all** | code — the 13 pre-LLM gates | **binding** | route.ts:88-334 |
| **Model & sampling** | code | **binding** | `claude-sonnet-4-6` all stages, temperature unset, max_tokens 2500 (model.ts:12-22; route.ts:399-404) |
| **What system prompt the model sees** | code (`assembleSystemPromptBlocks`) | **binding** | all 8 specs every turn; stage is a label (assemble.ts:532-544,198-200) |
| **Stage advancement** | code — the router's two lanes | **binding** | classic gate needs `recommendedAction:'advance'`; move-based lane does not (§3) |
| **Stage regression / discharge** | code — router | **binding** | AI `recommendedAction: regress_*` is *consumed* by the router (router.ts:80-104) — a rare case where a report field directly drives movement |
| **Freezing (safety)** | code — four lanes | **binding** | only the sync keyword lane acts before the user sees the reply (§2) |
| **What gets stored** | code — persistence layer | **binding** | human reply only; state report never stored on the message; leak-gated (route.ts:593-613) |
| **What the next prompt contains about the user** | code — `renderStateBlock` + `deriveSensitivitySignals` | **binding over rendering**; model authors the *content* echoed | echoed fields (channel, patterns, continuityNote, taskContract, clinicalRead-on-open-cycle) shape the next reply but gate nothing (assemble.ts:151-453; load.ts:378-452) |
| **Closure discipline / "don't close on surface markers"** | the model, self-enforced from prompt text | **not binding** | `stabilityCheck.score < 6` close-refusal lives only in prompt text; no code reads `stabilityCheck` (parse.ts:331-347; closure-discipline.test.ts:35) |
| **Task contract adherence** | the model, from the rendered contract | **not binding** | contract is rendered into the prompt (assemble.ts:168) but nothing routes or gates on it |
| **Practice / move selection** | the model | **not binding** | `moveJustPerformed` is *read back* by the move-based advance lane (move-based-advance.ts:76), the one place a "move" field changes state |

---

## 2. Safety authority — precedence order

Four independent lanes; they do **not** override one another so much as fire at
different times. Precedence *in time*:

1. **Synchronous keyword scan** — the **only** lane with authority *before the
   user sees a reply* on a normal turn. On a hit it replaces the model reply
   with canned crisis text, freezes (`source: keyword_scan`), and the LLM is
   never called (route.ts:310-334). Highest practical authority.
2. **State-report `safetyFlag: red_flag`** (model's own judgement) — freezes
   the **next** turn (`source: state_report`, route.ts:629-636). The current
   reply has already streamed.
3. **Async verifier (Haiku)** — `clear_crisis` freezes the next turn
   (`source: verifier`); `ambiguous` downgrades a `none` audit flag to `watch`
   (route.ts:639-671). Runs after the stream.
4. **Cooldown-lift verifier** — gates the frozen path: only
   `safety_confirmation` lifts; everything else holds (route.ts:259-306).

Cross-cutting rules: **`freezeJourney` is idempotent** — the first freeze wins;
later freezes do not overwrite `frozenAt`/`frozenReason` (freeze.ts:39-46).
Freeze sources actually used: `keyword_scan`, `state_report`, `verifier`. The
`'manual'` source is defined but never invoked (freeze.ts:15; see Doc 3).
Only `clearFreezeForReview` (one call site, the cooldown-lift path) unfreezes
(freeze.ts:81-87; route.ts:265).

---

## 3. Stage-movement authority — two lanes, un-reconciled

`decideRoute` (router.ts:57-145) evaluates in fixed order; first match wins.
Two of its branches can advance a stage, on **different** criteria:

- **Classic gate lane** (router.ts:111-122). Passes only if the per-stage gate
  passes, and every non-Stage-1 gate requires, via `standardGuards`,
  `recommendedAction === 'advance'` (stage-gates.ts:56-63) plus stage-specific
  tokens/state (see the per-stage list in the runtime-integrity audit). **The
  model's `recommendedAction` is a hard requirement here.**
- **Move-based lane** (router.ts:132-142; move-based-advance.ts). Reached only
  if the classic gate fails. Advances on ≥3 qualifying `stage_N.*` moves
  (from `moveJustPerformed`) at intensity ≤5, safety `none`, adult-self ratio
  ≥0.5 — and **explicitly does not require `recommendedAction === 'advance'`**
  (move-based-advance.ts:8-18). It also reads **no anchor field at all**.

Both lanes are live; the divergence is documented in-code as deliberate
(router.ts:129-131). This canon records both and does not declare either the
"real" advancement rule.

Blocking overrides on both lanes: a **frozen** state, an **open cycle**
(router.ts:107-109), and (for Stage 8) discharge-vs-open-cycle
(router.ts:94-104) all take precedence and force `stay`.

---

## 4. Open-cycle authority — two definitions, split consumers

The same underlying `cycleStatus` field is interpreted twice, by different code,
for different consumers (verified: `router.ts` never reads the load.ts value):

- **Definition A — `load.ts`** (deriveSensitivitySignals, load.ts:378-452):
  session-windowed (last 10 turns, 4-hour boundary, reset on resume), true when
  the most recent `cycleStatus` is `open` **or** `closing`. **Consumer: the AI
  prompt** (`state.hasOpenCycle`/`openCycleDescription`, rendered at
  assemble.ts:263).
- **Definition B — `router.ts:76`**: literal last turn only, `open` **only**
  (`closing` does not count). **Consumer: the routing gate** (blocks advance and
  Stage-8 discharge).

They can disagree (e.g. on `closing`, on an omitted last-turn status with an
earlier same-session `open`, or across a session resume). Neither is declared
authoritative here; the fact that the *prompt* and the *router* can hold
different open-cycle verdicts for the same turn is the finding.

---

## 5. Anchor authority — code binds, prompt is split

- **Binding:** the classic stage gates enforce an anchor requirement
  (`state.anchorText` at Stage 1/2/3/4/5/6; `identityAnchor` at Stage 6/7/8;
  plus the Stage-1 `anchor_not_set` / `anchor_identified_token_missing` checks,
  stage-gates.ts:113,121). This is live code. The **move-based lane bypasses it
  entirely.**
- **Advisory / contradictory:** the owner decision recorded for 2026-07-02
  retired the anchor requirement and promised a gate-removal PR; the prompt
  corpus still both retires it (some places) and actively recalls it as a
  soothe/close move (Shared Core §6; stage-spec examples). See Doc 4 (D8) and
  Doc 3. **Both generations are live simultaneously; this canon does not
  adjudicate.**

---

## 6. Declared-but-powerless authority

- **`CLINICAL_MANUAL.md`** is declared "source of truth — if code and manual
  disagree, the manual is right" (owner decision D7). It is **never loaded by
  any code** — zero runtime reach. Its authority is documentary only.
- **The reviewable canon** (`00-shared-core.md` + `01…08` stage specs) is both
  "the document Julia signs off" *and* the runtime source loaded into block 1 —
  so for the specs, review-doc and runtime are the same file. The **master
  prompt** (`journey-master.md`) is what actually runs and is a *separate*
  generation from the specs (see Doc 3's duplication section).

---

## 7. Override summary (what beats what)

| When these conflict… | …this wins in the live system |
|---|---|
| Prompt says "advance" vs classic gate not satisfied | **Gate** (no advance) — unless the move-based lane independently qualifies |
| Classic gate blocks vs move-based lane qualifies | **Move-based lane advances** (evaluated as fallback, same pass) |
| Model reply says calm vs keyword scan hits | **Keyword scan** (reply replaced by canned crisis, pre-stream) |
| Model `safetyFlag: none` vs verifier `clear_crisis` | **Verifier** (freezes next turn; audit flag rewritten to red_flag) |
| Prompt "anchor retired" vs gate code enforcing anchor | **Gate code** (anchor still required on the classic lane) |
| `load.ts` open-cycle (open/closing) vs `router.ts` open-cycle (open only) | **Different consumers** — prompt uses A, router uses B; neither overrides the other |
| `CLINICAL_MANUAL.md` vs code | **Code** (manual is never loaded) |
| Model emits a field vs no gate reads it | **Code** (the emission is inert — audit/echo only) |
| Two prompt generations (e.g. anti-echo vs 812 echo exemplars) | **Neither** — both are in the assembled prompt at once (Doc 3, Doc 4) |
