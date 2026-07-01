# The Journey — Execution-Layer Rebuild Plan

**Created 2026-06-30, after a 5-agent systemic audit. Read this before continuing the rebuild.**

## Why this exists

The 8-stage clinical **canon is sound**; the **execution layer** — how the method
reaches the model, and how the model's signals reach the code — is broken in
several compounding ways. Live testing showed: users never advance past Stage 1,
the AI circles/over-abstracts, fixates on the coping mechanism over the root
issue, and emits flat/defaulted clinical signals. Gate unit-tests pass because
they hand-feed the required fields, hiding the gaps.

## Root causes (from the audit)

**Root A — the signal channel is broken.** The hidden state report is emitted
*after* the warm reply under a 1500-token cap, so it's frequently omitted
(measured: `health=no_report stop=end_turn`) or truncated. On any miss the parser
defaults to `{intensity 5, watch, stay}` — in **two** places (`parse.ts` and
`history.ts`, the latter poisoning the gate window on later turns). One missed
report loses that turn's advance decision, readiness tokens, landscape captures,
and formulation. The default is biased to never advance.

**Root B — the executed method (master prompt) is receptive and desynced from the
code (canon + gates).**
- ~30 receptive instructions to ~6 leading; all 10 worked examples hard-code
  `recommendedAction: "stay"`; advancement is only evaluated in Block 1.
- **Every gate 2–8 requires a field the master never tells the AI to emit** (and
  the "do not add fields not in this schema" rule forbids it): `soft_why`,
  `adultSelfAnchorLinked`, `heldEmotionInAdultSelf`, `somaticRelease`,
  `bodyConfirmation`, `selfLoyaltyStatement`, `oneSmallAction`,
  `safetyReorientation`, `dischargeReadiness`. The ladder is impassable past
  Stage 2; discharge is unreachable. (Gates were upgraded in "Bundle B"; the
  matching prompt update "Bundle A" was never shipped.)
- 17 of 20 canonical practices have no firing trigger (capture-only); three
  mandatory rituals (Securing the Part, Safety Reorientation, the stage openers)
  are unenforced.
- No working memory/plan: `readinessTouched` (covered ground) is never surfaced
  back to the AI; `clinicalRead` is written to a field that doesn't exist;
  `continuityNote` is optional + truncation-prone. The anchor is re-injected every
  turn while the root issue scrolls off the 30-message window → structural
  garden-fixation.

**Meta-cause:** two parallel method-systems (the prompt the AI runs, the
code/gates that enforce) drifted apart; nobody owns the emit↔require contract.

## Engineering decisions

- **Report-first** (state report before the reply), not tool-use, for the signal
  channel — minimal change that fixes the measured (position-driven) omission.
  Escalate to forced tool-use only if the diagnostic still shows drops.
- One focused PR per step, in dependency order. Owner (Julia) merges each.
- Schema migrations stay manual (propose SQL in the PR body).

## PR sequence (status)

### Milestone 1 — get a user advancing 1→2→3
- [x] **PR 1 — Report-first.** State report emitted before the reply; mandatory;
      streaming skips the front block; parse + examples updated. Removes the
      omit→`stay` default. Files: `route.ts`, `parse.ts`, `journey-master.md`
      (`<output_format>` + all examples), `assemble.ts` fallback instruction.
      _Merged #192._
- [x] **PR 2 — Stop default poisoning.** Single default source
      (`parseStateReport(null)`; the second literal in `history.ts` is gone);
      the fail-safe default is marked `_defaulted: true` and preserved across
      the audit persist→reload cycle; the intensity/safety gate windows
      (`lastTwoIntensities`, `safetyNoneForLast`) exclude defaulted (no-signal)
      turns so a fabricated `{5, watch, stay}` can no longer block a real
      advance. A real `watch`, and a verifier-set `red_flag` on a defaulted
      turn, still block; day/session counting still includes the turn. No
      `stage-gates.ts` change needed (the fix lives in the helpers it calls);
      no schema migration (`_defaulted` rides inside the existing encrypted
      blob). Files: `schema.ts`, `parse.ts`, `history.ts`.
- [ ] **PR 3 — Close the readiness loop.** Surface each stage's outstanding gate
      criteria into the state block (read-only gate-reasons mode) + a per-stage
      "evaluate advancement each turn" instruction. Files: `assemble.ts`,
      `stage-gates.ts`, `journey-master.md`.
- [ ] **PR 4 — Unblock Stage 2.** Add `soft_why` (+ align `emotion_located`) to
      the readinessTouched vocabulary the AI is given + the move-2 emit
      instruction. Files: `journey-master.md` (+ verify `stage-gates.ts` regex).

### Milestone 2 — whole ladder passable + practices fire
- [ ] **PR 5–10 — Per-stage prompt↔gate re-sync + practice firing**, one PR per
      stage 3→8 (the never-shipped "Bundle A"): drive the gate-required fields,
      add the stage's §8a practice scope + firing trigger + compressed anatomy.
      Fields per stage: 3 (`adultSelfAnchorLinked`, `heldEmotionInAdultSelf`,
      `adultSelfPresent:true`); 4 (`adultSelfOffering`, `adultSelfPresent`); 5
      (`somaticRelease`, `bodyConfirmation`); 6 (`selfLoyaltyStatement`,
      `oneSmallAction`); 7 (`safetyReorientation`); 8 (`dischargeReadiness`,
      `adultSelfThisWeek`). Note `bodyConfirmation` boolean-vs-string mismatch.
- [ ] **PR 11 — Ritual enforcement in code.** Session-open/close detection (4-hr
      boundary already exists) → inject mandatory openers (Internal Consensus @6,
      Identity Reinforcement @8) and closers (Securing the Part @4, Safety
      Reorientation @7). Files: `assemble.ts`, `load.ts`/`history.ts`.

### Milestone 3 — flow like a clinician
- [ ] **PR 12 — Memory/plan + leadership.** Structured surfaced formulation
      (presenting issues / hypotheses / worked / queued / next-move) + a non-anchor
      root-issue slot + covered-ground ledger (aggregate readinessTouched into the
      state block); lead mandate; de-bias examples (≥1 `advance` example); rebuild
      the rupture trap with a leading half; disambiguate "match their language".
      Likely a schema migration (propose SQL).
- [ ] **PR 13 — Cleanups.** Wire or drop `clinicalRead`; fix dangling `<voice>`
      ref; remove dead fallback output-format schema; `bodyConfirmation` type.

## Verification

Each PR: targeted tests + `npm test` from `mindreset-app/`. The real proof is a
live re-test after each milestone (owner runs it; we read the DB via the A/B/D
queries + the `journey/parse-health` Vercel logs).
