# Contradiction Matrix — Journey Runtime (2026-07-21, read-only forensic audit)

Scope: every pair/group of **simultaneously active** instructions that disagree, verified
against the assembled production prompt (export: `../audit-2026-07-21-runtime-prompt-export.md`,
341,561 chars ≈ 92.3k tokens) and current source files. "Runtime order" = position in the
assembled prompt (canon block 1 → master block 2 → state block 3 → master block 4).
"Repetition weight" = measured occurrences in the assembled prompt (this audit's counts).
No side is judged correct unless an explicit later owner decision exists — noted where it does.

Legend: SC = `docs/journey/00-shared-core.md` · S1..S8 = stage specs · PGA = practice-generation
algorithm doc · MASTER = `docs/journey/runtime/journey-master.md` (blocks 2+4) · STATE = injected
state block. All quoted text is verbatim and greppable in the named file.

## A. Voice and communication

| # | Behaviour | Source A (earlier layer) | Source B (later layer) | Runtime order | Repetition weight | Code enforcement | Live symptom (Julia transcript 2026-07-21) |
|---|---|---|---|---|---|---|---|
| A1 | Mirroring | SC §2: "The AI mirrors before it moves." + 19 further "mirror" instructions across SC/S1–S8 | MASTER `<communication>`: "Do not repeat or paraphrase their last message back… Move the conversation forward instead of summarising every turn." | A first (block 1), B later (block 2) | **19 : 1** | None | AI echoes/paraphrases; user must push ("дальше что?" ×3) |
| A2 | Stock phrasing | "I hear you / I hear that" modelled as the method's own voice: SC:209, S1 Ex.A ("I'm here. I hear you."), S2 §6 ("yes, I hear that"), S3 Ex.C ("I hear that she's always there."), S7 ×2 — **9 exemplar uses** | MASTER `<communication>`: bans "I hear you", "That sounds difficult", etc. (**the ban itself is 2 of the 11 total occurrences**) | Exemplars first, ban later | **9 exemplars : 1 ban** | None | Formulaic validation openings |
| A3 | Routine validation | S2 exemplars: "It's allowed" ×5, "makes sense" ×8, "You don't have to" ×22 — validation as required practice steps (S2 §8.1 step 5 "Acknowledge and allow") | MASTER: "Restraint with validation. Routine validation reads as grading the user's emotional performance, and lands worst with self-sufficient users." | Exemplars first | **35+ : 1** | None | Julia (self-sufficient profile) got graded-feeling validation |
| A4 | Reply shape | SC §2: "Short sentences. One request per message." — fixed liturgical cadence | MASTER: "Vary the shape and rhythm of your replies… If your last few replies followed the same shape — break the pattern." | A first | 1 : 1 (but A is reinforced by 812 exemplar snippets in that cadence) | None | Same-shaped replies turn after turn |
| A5 | Ask vs lead | SC §2: "The AI asks more than it tells." | MASTER `<communication>`: "experienced clinician in natural conversation," declarative contrast examples ("Statistic. Is that genuinely how it feels…") | A first | A reinforced by ~all stage exemplars (question-ending) | None | AI never leads; user drives the session |
| A6 | Hypothesis confidence | MASTER `<clinical_reading>`: offer reads "only tentatively" + `<communication>`: "Do not rush to explain the user to themselves" | S3/S5/S7 exemplars deliver confident declarations ("That's the one. She has always been in you."; "Foreign guilt — it isn't yours either.") | Exemplars in block 1, rules in block 2 | exemplars ≫ rule | None | Premature confident interpretation |
| A7 | User's exact words | "use the user's exact words" — **40 occurrences** (SC ×8, output_format ×7, S1 ×4, S3 ×4…) | MASTER: don't echo every turn (repetition only "if it does real clinical work") | Both active | 40 : 1 | None | Verbatim echo experienced as parroting |

## B. Method and depth

| # | Behaviour | Source A | Source B | Runtime order | Repetition weight | Code enforcement | Live symptom |
|---|---|---|---|---|---|---|---|
| B1 | Stage model | S1–S8: sequential blocks, each "Code holds the user in Stage N until ALL of…" — 8 code-gate sections stating "code makes the final call" (8 occurrences) | Canon header + STATE: "Stage numbers are a bookkeeping label… NOT capability gates"; "reach for whichever stage's methodology fits" (PR λ 2026-07-11, explicit later decision) | Both in block 1 (header wraps the specs it contradicts) | 8 gate sections + per-stage "When This Stage Is Active" vs 3 bookkeeping statements | **Code enforces A** (gates + router); prompt asserts B | AI works Stage 2–5 while persisted stage stays 1 (all 25 turns of the test session) |
| B2 | Stage 1 scope | S1 §5/§6: Deep **prohibited**; "Do not do parts work… even if the user is naturally drawn to it"; S2 §5, S3 §5 likewise ("Deep — prohibited" ×3 in S1–S3) | Canon header: "If the user is doing foreign-material release work (Stage 5), use the Stage 5 playbook even if the router still labels them Stage 1." | Same block | 3 explicit prohibitions vs 1 license | None on the prompt side | Parts-work + foreign-material release ran at persisted Stage 1, intensity 6–7 (trace moments 3–6) |
| B3 | Assessment pacing | MASTER `<assessment_phase>`: "GO WIDE BEFORE YOU GO DEEP. Hold deep moves (3–8)… across 2–4 sessions"; Block 1 practice whitelist ("Do NOT offer in Block 1: parts work, foreign material release…") | Canon header: all 8 playbooks usable now; MASTER `<practice_generation>` proactive triggers fire practices "in the SAME turn" | Interleaved | ~equal statement counts; triggers more operationalised | None | Deep work in session 1, day 1 |
| B4 | Formulation-before-intervention | `<assessment_phase>`: share-back milestone must close Block 1 before Block 2+ work | Proactive practice triggers + canon flexible map act immediately | — | — | Gate reads `formulation_confirmed`+`advance` (code) but nothing blocks deep *prompt* behaviour before it | Deep work before any share-back |
| B5 | Depth semantics | STATE renders "Current depth: surface" every turn | Same state block simultaneously renders an open **Deep** cycle: "Deep somatic release happening — black cloud exhaled…" | Same block, 20 lines apart | — | `currentDepth` never written by any code path (see code-vs-prompt authority doc) | Model told depth=surface while doing deep work |

## C. Modalities and practices

| # | Behaviour | Source A | Source B | Runtime order | Repetition weight | Code enforcement | Live symptom |
|---|---|---|---|---|---|---|---|
| C1 | Anchor as soothing move | SC §6: "The AI recalls it gently whenever intensity rises in any later stage: 'Take a moment with [anchor]'"; S2 §3/§4/§8.1 step 1 "Anchor recall" as REQUIRED practice step; "Take a moment with" ×9; anchor-recall instructions ×24 | MASTER §1 (owner decision 2026-07-02): "The anchor is NOT a stabilising intervention… NOT the AI's move when the user destabilises… NOT what you invoke at session close"; S1 §8 rewritten to match | SC/S2 exemplars in block 1; rule in blocks 1(S1 §8)+2 | **24 : ~6** | None | AI invoked «рука на груди» formula **10×** in one session as a soothe/close move |
| C2 | Saying "anchor" | S1 Ex.C (still in runtime): "**Name explicitly** (step 4). 'This is your anchor. The blanket.'" + "Why this works: Signature practice run cleanly" | MASTER §1: "NEVER say 'anchor', 'your anchor', or 'that's your anchor' to the user. NEVER announce…"; S1 §8 (same file, earlier section): capture is "observation, not practice anatomy" | **Same file** contradicts itself: §8 (revised 2026-07-02) vs §11 Ex.C (pre-revision, never updated) | 1 : 2, but Ex.C is a full worked demonstration | None | — (not observed this session; standing risk) |
| C3 | Retired anchor gate | S2 §2: "Stage 1 has closed cleanly (`anchorText` set…)" — anchor as Stage-1 exit condition | S1 §10 (2026-07-02): "anchor requirement dropped from the Stage 1 gate"; MASTER output_format: `anchor_identified` "being retired in an upcoming code change" | Both in block 1 | — | `stage-gates.ts` still requires anchor (fix `4d08114` never merged — see timeline doc) | Stage 1→2 gate historically blocked |
| C4 | Body-question reflex | S2 §3: "'Where do you feel this?' is the most-repeated question of this stage" + 13 body-locating exemplars; `body_located` is a gate-required readiness token (checklist item 5) | MASTER trap 5: "Body-obsession… Asking 'what's in your body?' three turns in a row interrupts every other channel"; Sensitivity hard rule 1: modality rejection is once-and-stop | Exemplars first | 13 : 2 | `modalityRejected` is render-only; no code blocks a body question | Repeated body-location questions (sensitivity layer's own INCORRECT example describes this) |
| C5 | Cognitive-user handling | S1 §7 / S2 §7 / S3 §7: cognitive user → "gently shift focus from thought to body" (three stage specs) | MASTER `<communication>`: match texture; MASTER channel guidance: cognitive → narrative "+ invite body location so it doesn't stay in the head" (softer) | — | 3 : 1 | None | Cognitive/self-sufficient user pushed toward body |
| C6 | Practice frequency | MASTER: "Most of the journey is conversation, listening, reflection"; practices "only when it would actually serve" | MASTER `<practice_generation>` 10-step hierarchy + 8 proactive same-turn triggers + "Practice emission — mandatory… If anatomy ran, log it" | Same section contains both | hierarchy+triggers dominate operationally | Audit-log discipline (orphan `started` flagged) pushes toward practice-shaped turns | Premature/ritual practices; "Ничего. Это и есть «дальше»" filler-practice loop |
| C7 | Imagery imposition | SC §4 + trap 6 + S1/S3 prohibitions: never impose imagery (17 statements) | PGA §8 example logic + S5 worked flows are image-led scripts; landscape triggers fire on any signature image | — | 17 rules vs ~dozens of image-led exemplar lines | None | — |

## D. Memory and reasoning

| # | Behaviour | Source A | Source B | Runtime order | Repetition weight | Code enforcement | Live symptom |
|---|---|---|---|---|---|---|---|
| D1 | Continuity note role | MASTER `<memory>`: "your running case formulation… Read it carefully… strategic clinical thinking… Never wipe history; refine it" | Render truncation: `assemble.ts` head+tail-truncates the note to 800 chars before the model sees it (middle silently dropped) | Instruction in block 2; truncation upstream of render | — | **No code reads the note** (router/gates/closure never consult it) | Mid-note strategy silently lost; repetition across sessions |
| D2 | Reasoning upstream of reply | `<clinical_reading>` + Sensitivity Layer: five questions "MUST" be answered "before you write your reply" — analysis should steer speech | Sensitivity Layer same section: "**No `<assessment>` block. No `<thinking>` block… reasoning stays in your working memory only**"; single streamed completion emits reply FIRST, report after | Same section asserts both | — | No pre-reply artefact exists or is checked; the enforced artefact (PR α `<assessment>`) was removed by PR β 2026-07-09 for 20–30s latency | clinicalReads correctly diagnose ruptures **after** the reply that caused them |
| D3 | Corrected hypotheses | MASTER: "Today's signal can revise yesterday's hypothesis… formulation follows the user" | `patternsTouched` DB rows re-render every session ("use to recognise, not to name") with no correction/deactivation mechanism (see memory-integrity doc) | — | — | Patterns dedup+bump only; no retirement path verified | Rejected reads can resurface |
| D4 | State report purpose | Prompt frames report as the clinician's live intelligence ("The stage-advancement router reads this; leaving it null costs the user real progression") | Architecture: report is generated after the reply; affects **later turns only** | — | — | Router consumes it next-turn | "Smart analytics underneath, dumb reply on top" |

## E. State machine and governance

| # | Behaviour | Source A | Source B | Runtime order | Repetition weight | Code enforcement | Live symptom |
|---|---|---|---|---|---|---|---|
| E1 | Stage = gate vs telemetry | 8 per-stage code-gate sections ("code makes the final call") + real gate code | Canon header/STATE: "bookkeeping label… NOT capability gates" | — | 8 : 3 | Code = gates (authoritative); prompt = telemetry claim | Persisted stage 1 under Stage-5 work |
| E2 | Progression lanes | Classic gates: require `recommendedAction:'advance'` + stage-specific tokens | Move-based lane (PR 4b): ≥3 qualifying `stage_N.*` moves, intensity ≤5, adultSelf ≥50% — no `advance` needed | Both live in router | — | Both enforced; different criteria, un-reconciled | Neither lane fired in the test session |
| E3 | Advance signal | `<assessment_phase>`: emit `advance` "ONLY when the share-back milestone has fired" (Block-1 focus section repeats it) | S2–S8 gates each require `recommendedAction:'advance'` for their own stage exit — the model was told to withhold it except at share-back | Both in prompt | — | Gates read the field the prompt suppresses | Post-Block-1 stages structurally starved of `advance` |
| E4 | Open cycle vs close | STATE: "Do NOT close this session while the cycle is open" + Sensitivity rule 6 | No code-side session-close concept; open cycle also feeds the advance guard — same flag blocks progression | — | — | Cycle guard blocks stage advance (code); close is prompt-only | Cycle stayed open; stage frozen; close discipline held only by prompt |
| E5 | Release semantics | P1 (2026-07-19): release is PROVISIONAL until later-turn confirmation; STATE renders "(PROVISIONAL — not yet confirmed…)" | S5 worked examples narrate releases completing in-session ("Stage 5 is now close to closing") | Rule in blocks 2/3; exemplars block 1 | exemplars vs 1 rule | `releaseClaimedAt` vs `releasedAt` split enforced in code | Correctly held provisional this session (rule won here) |
| E6 | Depth field | `JourneyDepth` type + STATE renders it + S1–S3 depth-permission sections | No writer: nothing populates `recommendedDepth`; router resets depth; field frozen at `surface` | — | — | Dead field (code) | "Current depth: surface" rendered during deep work (B5) |

## Summary counts

- 27 distinct contradiction pairs/groups verified as simultaneously active.
- The later/approved layer is the **minority voice in 21 of 27** (by repetition weight or exemplar mass).
- 6 contradictions are **intra-file** (a revised section coexisting with its own pre-revision
  examples or gates): C2 (S1 §8 vs §11), B1 (canon header vs the specs it introduces),
  C3 (S2 §2 vs S1 §10), C6 (`<practice_generation>` self-tension), D2 (Sensitivity Layer
  self-tension), B5/E6 (state block self-contradiction).
- Code enforces the OLD sequential model (gates) while the prompt asserts the NEW flexible
  model — the single largest structural disagreement (B1/E1).

*Read-only audit. No side adjudicated except where an explicit owner decision is cited
(2026-07-02 anchor; 2026-07-11 PR λ). No fixes proposed.*
