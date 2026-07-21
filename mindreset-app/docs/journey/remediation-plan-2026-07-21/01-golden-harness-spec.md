# Golden-Session Evaluation Harness — Specification (Phase 5, build-first)

Status: SPECIFICATION ONLY. Nothing is built by this document. No production file changes.
Owner approval required on: fixture set, metric definitions, judge rubric, cost ceiling.

## 1. Purpose

Establish a measured baseline of the CURRENT production runtime on representative
transcripts, and enable controlled comparison of isolated experimental variants
(prompt-set changes, thinking configs, model swaps) with the same fixtures and metrics.
Also closes the "was the fix actually live?" gap permanently (loader-bug lesson): every
run records the exact assembled prompt bytes it used.

## 2. Location and files affected

All NEW files. Zero production files modified.

```
mindreset-app/eval/journey/            ← new directory, committed (NOT scripts/, which is gitignored)
  fixtures/
    julia-2026-07-21.json              ← owner's real session (25 turns, RU) — from the transcript already in hand
    cognitive-analytical.json          ← synthetic, drafted for owner approval before use
    panic-intervention-worse.json      ←   "
    body-imagery-refusal.json          ←   "
    unfinished-parts-process.json      ←   "
    rupture.json                       ←   "
    ordinary-low-intensity.json        ←   "
  lib/
    runner.ts                          ← replay engine (imports PRODUCTION assembly path read-only)
    variant.ts                         ← variant definition + resolution
    metrics-mechanical.ts              ← counted metrics (regex/lexicon, EN+RU)
    metrics-judged.ts                  ← LLM-judge metrics (blind, order-swapped, rubric)
    report.ts                          ← per-run JSON + markdown diff table
  runs/                              ← gitignored output dir (JSON + md per run)
  README.md
package.json: ONE dev-script entry "eval:journey" (the only shared-file edit; flagged for approval)
```

The runner imports `assembleSystemPromptBlocks`, `appendEmissionReminder`,
`createProcessorState/ingestChunk/finaliseStream`, `splitReplyAndReport`,
`parseStateReport` from `lib/journey/**` — read-only imports; no route, no DB, no
production code path is modified or exercised for writes.

## 3. Fixture format

```jsonc
{
  "id": "julia-2026-07-21",
  "locale": "ru",
  "description": "...",
  "stateTimeline": [            // scripted JourneyState per turn (v1 = scripted-state replay)
    { "turn": 1, "state": { /* full JourneyState literal */ } },
    { "turn": 9, "state": { /* updated: anchor captured, open cycle, ... */ } }
  ],
  "turns": [
    { "user": "<verbatim user message>",
      "annotations": { "answersQuestion": "what-alone-means", "isRupture": false } }
  ],
  "expectations": {             // optional per-fixture assertions (e.g. rupture must be received)
    "mustNotClose": [12, 13], "ruptureTurns": [3]
  }
}
```

- **Julia fixture**: built from the recovered 2026-07-21 transcript + Inspector state
  reports (state per turn reconstructed from the reports — the same reconstruction used
  for the prompt export). Owner reviews it once for accuracy.
- **Six synthetic fixtures**: drafted (RU for user-voice realism, one EN), 8–15 turns
  each, and submitted for owner sign-off BEFORE any baseline run. They encode the named
  scenarios: cognitive/analytical user; panic + intervention-made-worse; body/imagery
  refusal; unfinished parts process; rupture; ordinary low-intensity conversation.

## 4. Replay model (v1: fixed-script, scripted-state)

- User turns are FIXED (replayed verbatim regardless of AI replies) → deterministic,
  comparable across variants. Conversation history accumulates the variant's own replies
  (stripped, as production does) so self-imitation effects are reproduced.
- JourneyState per turn comes from the fixture's `stateTimeline` (NOT from re-running
  save/gates) → isolates prompt+model behaviour from state-machine behaviour; the state
  the model sees is identical across variants. (v2, later, may add live-pipeline mode
  and an LLM-simulated user for "who leads" dynamics; out of scope now.)
- Each run stores: variant config, git SHA, the FULL assembled system blocks (byte
  capture per turn — the was-it-live guarantee), raw model output, visible reply,
  parsed report, timings, usage.
- Repetitions: n=3 per fixture per variant (variance estimate). Model default
  `claude-sonnet-4-6` unless the variant overrides.

## 5. Variant definition

```jsonc
{ "name": "baseline",
  "promptRoot": null,              // null = production docs/journey; or a directory of alternate prompt files
  "thinking": null,                 // null | {"type":"enabled","budget_tokens":N} | {"type":"adaptive","effort":"low"}
  "model": null,                    // null = production default
  "maxTokens": null }               // null = production 2500
```

`promptRoot` override lets Phase 2 candidates be tested without touching
`docs/journey/`. The baseline variant is byte-identical to production assembly.

## 6. Metrics (all reported per turn + per fixture + aggregate)

Mechanical (counted; EN+RU lexicons, owner may amend):
1. **Echo/paraphrase score** — n-gram (≥4-gram) overlap of reply with the user's
   previous message, normalised; plus count of replies opening by restating.
2. **Stock-phrase count** — lexicon: EN "I hear you", "That sounds", "That's a real
   place", "I'm curious/wondering", "Let's stay with that"; RU «Я слышу», «Это
   нормально», «Это имеет смысл», «Похоже, что», «Побудь с этим» (+ owner additions).
3. **Repeated-question count** — question-similarity (normalised token overlap ≥0.6)
   against all prior AI questions in the fixture.
4. **Body-question frequency** — count of body-location prompts (RU «в теле», «где ты
   чувствуешь», EN "in your body", "where do you feel") per turn and per session.
5. **Premature-practice count** — practices offered before turn N of a first session /
   before formulation confirmed (from fixture annotations) + practiceRun emissions.
6. **Anchor-formula invocations** — occurrences of the fixture's anchor text used as a
   soothe/close move (the C1 defect; measured 10 in the baseline session).
7. **State-report completeness** — required fields present, parse success rate,
   DEFENSIVE_DEFAULT fallback rate.
8. **Latency** — time-to-first-visible-byte, total turn time.
9. **Tokens/cost** — input/cached/output split per turn; $/session at current pricing.

Judged (LLM judge on `claude-opus-4-8`, effort high; blind to variant name; each pair
judged twice with A/B order swapped; rubric shipped with the harness for owner review):
10. **Unsupported hypothesis declarations** (confident interpretation without user
    material) — count + severity.
11. **Narrative conflation** — mixing distinct user narratives/persons.
12. **Task-contract relevance** — 1–5: does the reply serve the fixture's contract?
13. **Who leads** — 1–5 per turn: did the AI advance the work or wait for the user?
    (User-push markers like «дальше что?» in fixed scripts count against.)
14. **Visible-reply quality** — 1–5 holistic clinician-register score against the
    `<communication>` contract.

No silent caps: any turn dropped/failed is listed in the report.

## 7. Baseline + comparison protocol

1. Owner approves fixtures + lexicons + rubric.
2. Run baseline (current production runtime) — 7 fixtures × n=3.
3. Freeze baseline report as `runs/baseline-<date>/` (committed summary, raw gitignored).
4. Any experiment (Phase 1 variants, later Phase 2 candidates) runs the identical
   fixture set; report shows variant-vs-baseline per metric with variance.
5. Cost estimate per full run (7 fixtures ≈ 80 turns × 3 reps ≈ 240 completions; canon
   cached after first turn per fixture): ≈ $4–8 model spend per variant + ≈ $2–4 judge
   spend. Ceiling subject to owner approval.

## 8. What the harness does NOT do (boundaries)

- Never writes to the database; never calls the production route; never modifies
  `docs/journey/**`, `lib/**`, `app/**`.
- Does not exercise route-level safety code (keyword scan/verifier/freeze) — the panic
  fixture measures the MODEL's clinical handling; route-level safety is separately
  covered by existing code paths and is out of scope here (noted, not hidden).
- Runs only on explicit invocation (`npm run eval:journey -- --variant=...`); nothing
  scheduled, nothing in CI, nothing in the build.
