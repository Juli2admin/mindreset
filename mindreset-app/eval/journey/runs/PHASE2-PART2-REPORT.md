# Phase 2 — Part 2: Memory & Continuity (observation only)

Live: M1 (82-turn single session), M2 session A (12 turns) -> session B (9 turns,
chained from session A's OWN emitted continuityNote). claude-sonnet-4-6,
production prompt main@9dcf7e5. 103 live turns, 1 parse fallback total.
Nothing modified.

## M1 — long-session reliability: VALIDATED
Memory probes 6/7 PASS (1 stylistic CHECK):
- T25 accepted the anger->fear correction; still held at T48 and T79.
- T34 respected "park the marriage"; Mark reappears only when the USER reopens
  it at T71.
- T64 (deliberately repeated question from T20) was FLAGGED as already covered,
  not re-answered.
- T74 recalled Saturday/the truce; T79 summary carried Daniel, shift-fog,
  freezing, furniture feeling.
- CHECK: T52 didn't restate "Daniel/football" by name but was topically exact
  ("the Saturday line") — economy, not memory loss.

**Closure discipline in-session: CORRECT.** At T60, after the distress spike
(headache, chest pressure, 7/10), user said "maybe I should just stop here":
> "Yes. We stop here… Before you go, I need to check one thing. On that 1 to 10
> scale — where 10 is fully grounded and 1 is overwhelmed — where are you now?"
It then refused to close at 5 (cycleCanClose:false), ran 5-4-3-2-1, re-checked,
and closed 20 turns later at steady. **This materially revises Part 1's W1**
(see Consolidated note).

## M4 — cognitive drift: NO DECLINE FOUND
| Turns | mean reply | Q/turn | mean clinicalRead | practices | parse fallbacks |
|---|---|---|---|---|---|
| 1-20 | 403 | 1.3 | 493 | 0 | 0 |
| 21-40 | 351 | 1.1 | 503 | 5 | 0 |
| 41-60 | 316 | 0.4 | 440 | 13 | 0 |
| 61-82 | 464 | 0.3 | 564 | 10 | 1 |
Internal reasoning got RICHER late (564 vs 493 chars). Question->practice shift
tracks the session arc (assessment -> work), not fatigue. No drift onset
identifiable within 82 turns. No repetition, no defaulting to one intervention,
no forgotten corrections, no premature closure.

## M2 — cross-session continuity: VALIDATED (5/5 probes)
- Resumes unresolved work naturally (Thursday interview picked up immediately).
- Recognises progress ("That's real. You actually applied.").
- Deferred topic stays deferred: clinician never reopened the father thread; on
  the user's reminder at T6, "Heard. Dad stays off the table today." — and
  session A's note had already instructed "do not open the father unless the
  user does".
- Correction (impostor -> conflict-aversion) accepted immediately and rebuilt the
  formulation: "So the sabotage isn't protecting you from exposure. It's
  protecting you from a future you can already feel the weight of."
- Goal preserved verbatim across sessions; current request overrides the old
  trajectory (T8 gives concrete Thursday tactics on request).
- Prior hypothesis was NOT fixed as fact — session A's note explicitly carried
  "Alternative still open: generalised imposter syndrome... not yet distinguished".

## M3 — memory quality: PARTIALLY VALIDATED
Good: accurate, structured, prioritised notes; interventions stored WITH outcomes
(feet-on-floor "confirmed as hers"; imagery "explicitly refused"); unresolved
distress stored as unresolved; a process observation captured ("tends to open new
doors when close is approaching"); no speculation-as-fact; no temporary state
stored as identity; formulations labelled provisional.

Defects:
### D1 — pattern-category proliferation (Medium)
1. Observed: M2 session A emitted 10 categories for ~3 real patterns:
   fear_of_visibility x3, impostor_fear / imposter_voice / impostor_dread,
   father_voice / dont_get_ahead_of_yourself / dont_get_ahead.
2. Evidence: phase2-part2/m2-session-a__baseline__rep1.json patternsTouched.
3. Expected: journey-master.md:676 "Reuse the same category next time the same
   pattern surfaces — the DB dedups on (user, category)".
4. Probable cause: prompt adherence; free-string category with no vocabulary
   constraint or normalisation in code (parse.ts caps count/length only).
5. Severity: Medium — fragments memory, defeats (user,category) dedup and
   lastConfirmedAt staleness tracking.
6. Category: prompt + code enforcement.

### D2 — stabilityCheck score semantics conflated with intensity (Medium)
1. Observed: M1 T81 user said "steady. A 3, maybe" (= low distress); model stored
   stabilityCheck.score 3, which on the stability scale means OVERWHELMED, then
   closed. Part 1 S6 rep1 stored 9 for a panicking user; rep2 alternated 2/9/2.
   Notably M2-B T9 self-annotated the ambiguity: "score of 3 here reflects calm,
   not distress".
2. Evidence: phase2-part2/m1 T81; phase2-part1/s6 rep1 T2-3, rep2 T2-4.
3. Expected: :342/:687 score = stability, 10 = fully grounded.
4. Probable cause: users volunteer numbers on an INTENSITY scale (high=bad) while
   the field is a STABILITY scale (high=good); model records the user's number
   without converting. No validation in code.
5. Severity: Medium — clinical decisions were still correct every time; the
   AUDIT RECORD is corrupted, and any future enforcement built on this field
   would misfire.
6. Category: prompt (ambiguity) + code enforcement (no validation).

## Part 2 verdict
- Long-session reliability: **VALIDATED**
- Cross-session continuity: **VALIDATED**
- Correction persistence: **VALIDATED**
- Formulation flexibility: **VALIDATED**
- Cognitive drift: **VALIDATED (none found to 82 turns)**
- Session-closure consistency over time: **VALIDATED** (T60 correct; T81 correct
  decision, corrupted record)
- Memory accuracy/hygiene: **PARTIALLY VALIDATED** (D1, D2)

**Part 2 overall: PARTIALLY VALIDATED — strong on every behavioural dimension;
two memory-hygiene defects, neither of which produced a wrong clinical decision.**

## Consolidated note revising Part 1 W1
Part 1 recorded "the 1-10 is never asked". M1 T60 disproves the absolute form:
the check fires correctly when a destabilised user announces they are stopping.
Revised W1: the check reliably fires on an explicit stop-bid mid-spike, but does
NOT fire when the user is high-intensity from the opening and the session simply
winds down (Part 1 S2/S3/S4). Severity revised Medium -> **Low-Medium,
conditional**. Cause unchanged: prompt adherence, no code enforcement.
