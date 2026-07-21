# Recorded Baseline — Objective Metrics on the Real 2026-07-21 Session

Source: the owner's actual production session (25 turns, RU), scored by the golden
harness in **recorded mode** — no model was re-run; these numbers describe the replies
and state reports the production runtime genuinely produced on 2026-07-21. This is the
frozen baseline every later variant is compared against.

Run: `eval/journey/runs/baseline-recorded-2026-07-21/` · git as committed.

## Aggregate

| metric | value | reading |
|---|---:|---|
| mean echo (4-gram overlap, reply vs user) | 0.011 | low — replies rarely repeat the user's 4-grams verbatim |
| restating openings | **9 / 25** | over a third of turns open by restating the user's words |
| concession openings (follows-not-leads) | **3 / 25** | turns 9, 13, 15 — AI opens by conceding it was wrong / apologising |
| stock-phrase total | 3 | «слышу тебя» ×2 (T23/24), «это нормально» ×1 |
| body-question total | 4 | T3 ×2, T7, T18 |
| repeated questions | 1 | T21 |
| anchor-formula invocations | 5 | T2 ×2, T4, T6, T7 (early turns) |
| practice turns | 13 (premature 3) | T1–T3 all carry a practice on the first three turns |
| report-complete rate | 1.0 | all 25 reports had the required fields (these are the real emissions) |
| parse-default fallback rate | 0.0 | no report failed to parse |
| mean reply length | 452 chars | — |

## What the objective data says (and where it refines the audit)

1. **The register is NOT uniformly "robotic-validating."** The reply openings are varied
   and often directly clinician-led — "Стоп. Подожди." (T12), "Работаем." (T17), "Это
   означает вот что." (T18), "Именно. Он тебе не нужен." (T20). The worst-case English
   "I hear you / that sounds" opener the prompt-corpus audit flagged is largely ABSENT in
   this RU session (stock total 3, all mid/late). **The audit's "50:1 exemplar → robotic
   voice" hypothesis is not strongly borne out at the surface of this particular session
   — it remains a corpus-composition fact, but its behavioural effect here is small.**
   CONFIRMED by measurement; the causal claim is downgraded to PROBABLE→POSSIBLE for this
   session.

2. **The load-bearing defect that IS visible mechanically is "follows, not leads."**
   Three turns (9, 13, 15) open with the AI conceding the user was right / apologising —
   exactly the "student, I lead it follows" experience the owner reported. These cluster
   where the user pushes back (annotations: rupture 3/9/19, correction 13). Plus 9/25
   restating openings. This is the strongest surface signal and it aligns with the owner's
   own words, not with the "stock-phrase" framing.

3. **Memory friction is real and user-flagged.** T21 repeats an earlier question; and the
   user herself says «у тебя короткая память» (short memory) mid-session — consistent with
   the audit's memory findings (30-msg stripped history, no cross-turn move memory).

4. **Anchor-formula invocations concentrate early (T2/4/6/7 = 5 total).** Lower than the
   informal "10×" count in the chat audit — the difference is definitional: the harness
   counts anchor-fragment occurrences only in replies once `anchorText` is set in the
   scripted state (from T2), whereas the manual chat count included the opening-ritual
   lines and repeated fragments within a reply. Both are true; the harness number is the
   reproducible one. Still a live instance of the retired anchor-recall regime (matrix C1).

5. **Practices load on every one of the first three turns (premature = 3).** Consistent
   with the practice-generation trigger pressure (matrix C6) — the session opens straight
   into practice rather than assessment.

## Why this matters for the experiment

The recorded baseline reframes the primary question the Thinking experiment must answer.
The measurable problem in THIS session is **lead-vs-follow and memory**, not stock
phrasing. A pre-reply plan (the owner's five questions) targets exactly that: question 2
("what has already been asked or established") attacks the memory/repeat defect, and
questions 3–4 ("hypothesis / single best move") attack the follow-don't-lead defect by
forcing a move-choice before the AI can default to conceding. So the concession-opening
and repeated-question metrics are the ones to watch hardest in the live arms.

## Honest limits of this baseline

- Recorded mode measures ONE real session. It is ground truth for that session, not a
  population. The six synthetic fixtures (pending owner sign-off) exist to test the other
  scenarios (panic, refusal, unfinished parts, ordinary low-intensity).
- The 5 judged metrics (who-leads 1–5, reply quality, unsupported hypotheses, conflation,
  contract relevance) require an LLM judge (API) and are NOT in this offline baseline. The
  "who leads" score is the direct measure of the owner's concern and will be the headline
  number once a key is available.
- The RU lexicon is a first draft (owner may amend); `\b` word-boundaries do not bound
  Cyrillic, so RU patterns use explicit letter-class delimiters (fixed during the build).

## Next objective step (blocked on API access)

Run the live arms (`baseline`, `think-budget-1024`, `think-budget-2048`,
`think-adaptive-low`) with `ANTHROPIC_API_KEY` set. This sandbox exposes no Messages-API
credential to harness scripts, so the live A/B — the core of the Thinking experiment —
must be run wherever a key is available. Commands are in `eval/journey/README.md`; the
runner, arms, metrics, and telemetry are built and typecheck-clean.
