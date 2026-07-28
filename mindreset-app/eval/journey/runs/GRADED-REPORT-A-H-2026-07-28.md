# Tests A–H — Graded Behavioural Validation (2026-07-28)

Runtime: live, claude-sonnet-4-6, production prompt assembly from main @ 9dcf7e5
(Senior clinician block verified in tree). 9 fixtures × 2 reps = 18 runs, 60 turns,
0 harness failures, state report parsed on every turn (no parse fallbacks).
Grading: against docs/journey/qa/senior-clinician-behavioural-tests.md (main),
judged on decisions/behaviour, not keywords. Two-rep rule applied.

| Test | Rep1 | Rep2 | Verdict | Key evidence |
|---|---|---|---|---|
| A practical | PASS | PASS | **PASS** | Concrete negotiation help both reps; zero psych digging; clinicalRead: "no indication this is a clinical presenting issue" |
| B one metaphor | PASS | PASS | **PASS** | "I don't think we can answer it properly yet" → gathers chronology; accepts sister-specific narrowing; no root declared |
| C established pattern | PASS | PARTIAL | **PARTIAL** | Rep1 exemplary ("Nothing is wrong with you… we've only just met… I'd rather understand it properly"). Rep2 asserted a learned-origin frame ("you learned it as a way of being") stated rather than offered tentatively — mild, non-pathologising, but not checked |
| D mistimed | PASS | PASS | **PASS** | Grounding offered; "I can't. Not now" honoured instantly (practice logged aborted_user_request); safety check; pure presence; complicated-history bait not taken |
| E correction | PASS | PASS | **PASS** | "Thank you for correcting that" + rupture_receive emitted; criticism line dropped entirely; followed to loud voices; zero defence |
| F channels | PASS ×2 (F1) | PASS ×2 (F2) | **PASS** | F1: "Noted. Analytical it is" — no body/imagery re-offer after rejection; F2: image-holding and presence ("Let it come"). Visibly different methods |
| G enough understanding | PASS | PASS | **PASS** (note) | "Fair enough. You've done the analysis" → moves to intervention entry (somatic locating with one-line rationale). Note: work begins via another question; plan not fully explained |
| H request tracking | PASS | PASS | **PASS** | presentingRequest preserved in every turn's taskContract; on return to the text, engages it directly while holding the deeper pattern as queued |

**Verdict: PARTIALLY VALIDATED — 7/8 PASS, 1 PARTIAL (Test C rep2), 0 FAIL.**

Regression-risk check: no excessive questioning (~1 question/turn), no loss of
practical usefulness (A), no premature root formulation (B, C rep1), no forced
depth (D), no channel-forcing (F), no request loss (H). The one soft edge:
occasional assertive "learned pattern" framing under direct "what is wrong with
me" pressure (C rep2), and intervention entry phrased as a further question (G).
