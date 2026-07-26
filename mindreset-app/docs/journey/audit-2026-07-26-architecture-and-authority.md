# Journey Architecture, Authority & Evidence — 2026-07-26 (part 5)

> **Trigger:** owner rejected part 4 as insufficiently solid — *"doesn't look
> solid, you still didn't run tests, you don't have proof… check communication
> in the coding, how does the system work? who runs sessions with users? who is
> making clinical decisions? how does the system lead the session?"*
>
> **Method:** four parallel read-only agent investigations (turn lifecycle,
> clinical authority, communication pipeline, context/memory), every claim
> required to carry a `file:line` citation; plus **executed** Golden Harness
> runs scoring both the 21-July and 26-July sessions with identical code.
>
> This document supersedes part 4 where they conflict, and **corrects two
> findings from parts 1 and 4** (§7).

---

## 1. Direct answers to the four questions

### Who runs sessions with users? — **Nobody. There is no session.**

There is **no session object and no session table**. `StateSession`
(`schema.prisma:1059`) and `ThemeSession` (`:1141`) exist for the other
products; **no Journey equivalent exists**. The only persistent row is
`RecodeProgress` (`schema.prisma:722`), keyed `userId @unique` (`:725`) — one
row per user, forever.

A "session" is a **read-time heuristic recomputed from scratch on every turn**:
a 4-hour gap in the `JourneyTurn` timestamps (`state/load.ts:44`, duplicated
independently at `router/history.ts:128` and `delayedCheck/signal.ts:30` — three
uncoordinated copies of the same constant). `deriveContinuitySignals`
(`load.ts:105-162`) recomputes `sessionCount`, `daysEngaged`,
`thisSessionMessageCount`, `isSessionResume` every single turn.

**Session start and end are never detected, recorded, or acted on.**
`universal.session_open` is only a label the model may emit
(`stateReport/schema.ts:38`); **no code branches on it**.

### Who makes the clinical decisions? — **The LLM, almost entirely.**

Code owns exactly three things: a keyword crisis scan *before* the call, stage
bookkeeping *after* the reply has already streamed, and tag-stripping.

> **Between "the user's message passed the keyword scan" and "the reply streamed
> to the user", there is exactly one code behaviour: strip private tags.**

| Decision | Authority | Enforcement |
|---|---|---|
| Which practice / which family | **LLM** | **NOT ENFORCED** — code only validates the enum of what the model *claims* it did (`parse.ts:499`, `audit/log.ts:36-54`) |
| Run a practice at all | **LLM** | **NOT ENFORCED** — nothing requires, counts or paces practices |
| Parts work / deep work permitted ("Adult Self required") | **LLM** | **NOT ENFORCED** — rule is prompt-only (`journey-master.md:380`, `:392`); `adultSelfPresent` is read *only* by advancement gates (`stage-gates.ts:214,252,446,534`), never to gate a turn |
| Session may close | **LLM** | **NOT ENFORCED** — there is no close endpoint and no close concept in code to intercept |
| 1–10 stability check before close | **LLM** | **NOT CONSUMED** — `stabilityCheck` is parsed (`parse.ts:331-346`) then read **only by the admin inspector** (`journey-inspect/page.tsx:383,514`) |
| Regression / de-escalation | **LLM (sole)** | Code executes `regress_to_*` unconditionally (`router.ts:80-91`). **No code path ever initiates a regression** — not at intensity 10, not on `aborted_overwhelm`, not on a verifier `ambiguous` |
| Stage advancement — classic lane | SHARED | `router.ts:112-122` + gates; requires model assent (`stage-gates.ts:56-63`) |
| Stage advancement — move lane | **CODE over LLM labels** | `move-based-advance.ts:112-203`; explicitly **no** model assent (`:31-32`) |
| Red flag — keyword | **CODE** (hard, pre-LLM) | `safety/keywords.ts:150-160` → `route.ts:310-334` |
| Red flag — verifier / self-report | CODE-orchestrated | **post-stream** — code itself annotates `_deliveredBeforeFreeze` (`route.ts:672-674`) |
| What the user sees | **CODE** | `reply-processor.ts:133-274`, `parse.ts:69-89` |
| **Clinical safety of the reply itself** | **NOBODY** | **NOT ENFORCED** — the only output checks are tag-stripping and instruction-leak shapes. A warm, fluent, clinically wrong reply passes untouched |

Fields stored but **never consumed by any decision**: `therapeuticMode`,
`nextBestMode`, `cycleCanClose`, `stabilityCheck`, `clinicalRead`,
`patternsTouched`, `continuityNote` (the last three are re-injected into the
prompt but drive no code path). `schema.ts:96-98` *promises* enforcement of the
sensitivity fields — **none of it was ever built**.

### How does the system lead the session? — **It does not.**

1. Every turn is **one stateless streaming LLM call** (`route.ts:399`). There
   are **zero tool definitions** anywhere in `lib/journey` or
   `app/api/journey` — no planner, no agent loop, no iteration.
2. The router (`router.ts:57-145`) is deterministic and non-LLM, but runs
   **after the reply has already streamed** (`route.ts:690-693`). It cannot
   affect the current turn — only the *next* turn's label.
3. The prompt **explicitly tells the model to ignore the stage**:
   `assemble.ts:479` — *"Stage numbers are a bookkeeping label … **NOT capability
   gates**"*; `assemble.ts:198-199` — *"Router's stage label … bookkeeping"*. All
   **8 stage playbooks are loaded every turn** (`assemble.ts:532-544, 618-628`).

So the "clinical engine" is a ledger that writes down where the model says it
went, after it has already gone there.

### How does communication work in the code?

One output stream carries the user reply **and** the `<state-report>`, sharing
**one 2,500-token budget** (`route.ts:68,401`), reply first, report second
(`journey-master.md:609-614`, `:748`). The report is stripped before persistence
(`route.ts:602-613`), so the model **never sees its own past reports** in
history — which is why it stops emitting them, which is why
`emission-reminder.ts` exists (documented lapse: 18 consecutive report-less
turns, output collapsing to 42–160 tokens vs 444–789 healthy).

---

## 2. THE MECHANISM — the output-budget death spiral

This is the strongest finding in the whole investigation and it is proven
entirely from code.

1. `MAX_TOKENS = 2500` is **one budget** for reply + report (`route.ts:68,401`).
2. The prompt mandates **reply first, report second**
   (`journey-master.md:609-614`, `:748`). **Therefore the report is structurally
   the loser: a long reply cannot be truncated by the report; the report is
   destroyed by the reply.**
3. **`continuityNote` has NO inbound size cap** — `parse.ts:383` is a bare
   `copyStringField`, while *every other* free-text field is capped:
   `patternsTouched` 200 chars (`parse.ts:629`), `taskContract` 300
   (`:447`), `stabilityCheck.contextNote` 80 (`:344`). Stored verbatim
   (`save.ts:45,118`).
4. The prompt instructs **additive-only growth**: *"Never delete prior content;
   refine it"* (`journey-master.md:741`), *"Never wipe history; refine it"*
   (`:464`). The emission reminder demands the **full** report every turn
   (`emission-reminder.ts:25`).
5. Render-side truncation (`assemble.ts:427-438`, head 400 + tail 300 over 800
   chars) protects the *input* budget and does **nothing** for the *output*
   budget the note must be emitted into.
6. On truncation, `parse.ts:147-151` requires the closing tag — so a report
   truncated at 95% yields **`null`**, not partial data. The whole report is
   lost.
7. `parseStateReport(null)` returns `DEFENSIVE_DEFAULT`
   `{intensity: 5, safetyFlag: 'watch', recommendedAction: 'stay'}`
   (`parse.ts:91-95,163`).
8. **That fabricated value is then written as clinical fact**: `lastIntensity=5`
   into `RecodeProgress` (`save.ts:44,112-115`) and into the audit row as the
   model's reading (`audit/log.ts:26-31`).
9. `safetyFlag:'watch'` then fails `safetyNoneForLast` (`history.ts:105-109`),
   so an **output-truncation event silently blocks stage advancement**.
10. `moveJustPerformed` / `readinessTouched` vanish, starving the router.
11. **Nothing distinguishes "the model reported 5/watch" from "the parser gave
    up"** — the only disambiguator is a console line (`route.ts:556-572`), not a
    persisted field.

**The longer a user's `continuityNote` grows, the more often their state report
is destroyed, the more often their clinical record is silently replaced with
fabricated data, and the more their progression is blocked.** A self-accelerating
loop with no brake anywhere in the code.

**Honesty note:** this mechanism is proven in code but is **NOT confirmed to
have fired on the tester's logged turns** — her inspector reports are rich and
well-formed, so they parsed successfully. It is a latent, escalating risk that
matches her growth profile (note now 1,082+ chars, previously 2,000+), not a
demonstrated cause of her specific session.

---

## 3. Executed evidence — Golden Harness, both sessions, identical code

Recorded mode, no API key. `21 July` is the real production fixture; `26 July`
was reconstructed from the owner's transcript + inspector reports.

```
21 JULY  echo=0.011  stock=3  body-q=4  rep-q=1  anchor=5  practice=13(prem 3)
26 JULY  echo=0      stock=1  body-q=0  rep-q=1  anchor=1  practice=2(prem 0)
```

| Metric (harness-computed) | 21 July | 26 July |
|---|---|---|
| **Practice turns** | **13 / 25 (52%)** | **2 / 25 (8%)** |
| **Body-oriented questions** | **4** | **0** |
| Anchor invocations | 5 | 1 |
| Stock phrases | 3 | 1 |
| Repeated questions | 1 | 1 |
| Concession openings | 3 (12%) | 1 (4%) |

**Caveat, stated plainly:** the 26-July fixture omits user turns, so `echo` and
`opensByRestating` are **not comparable**. `practiceTurns` derives from the
report; `body-q`, `anchor`, `stock` and `concessionOpening` derive from the
reply text alone and **are** comparable.

**Negative result, reported honestly:** `concessionOpening` — the harness's
mechanical proxy for *"the AI follows instead of leading"* — went **down**
(12% → 4%). It does **not** support that framing of the complaint. The
plausible hypothesis failed the measurement.

**What the measurement does support:** practice rate collapsed 52% → 8%, and
**body-oriented questions fell to zero**. The somatic/procedural mode is gone.
That was part 4's central claim; it is now harness-measured rather than
hand-tallied.

---

## 4. Additional proven defects (not previously reported)

| # | Defect | Evidence |
|---|---|---|
| **A1** | **`modelOverride` is unvalidated, client-supplied.** Any authenticated user can POST `{modelOverride:"<any model>"}` and it reaches the API on the owner's key. The real client never sends it. | `route.ts:105` (no validation) → `:361` → `model.ts:20` |
| **A2** | **Live stream is not leak-gated.** `detectLeak` runs only at persist (`route.ts:593`) and history-load (`:379`). Leaked instruction text reaches the screen in full; only the reload copy is sanitised — the user sees it, refreshes, and it becomes a placeholder. | `leak-detector.ts:104`; nothing inspects `visible` at `route.ts:428-431` |
| **A3** | **Partial `<state-report` tag can leak to screen AND database.** The 14-char lookahead guard is flushed unconditionally at end-of-stream. Agent probe confirmed: `visible = "Warm reply here.\n\n<state-rep"`. | `reply-processor.ts:255-264` vs `:291` |
| **A4** | **Marker matching is exact-literal.** `<state-report >`, `<State-Report>` or `< state-report>` would not terminate the stream — the entire JSON report, including `clinicalRead` and `continuityNote`, would stream to the user. No tolerant matching, no post-stream sweep. | `reply-processor.ts:44,301-303`; `parse.ts:35-36` |
| **A5** | **Unclosed private tag = silent total reply loss** with no error frame; the client renders an empty bubble with `streaming:false`. | `reply-processor.ts:283`; `JourneyClient.tsx:286-292` |
| **A6** | **The emission reminder is injected into the USER message** and is invisible to the leak detector (the hyphen in `system-note` defeats the regex). It contains the literal `<state-report>`, so a mirror-back echo would terminate the visible stream. | `emission-reminder.ts:42,25`; `leak-detector.ts:63` |
| **A7** | **`patterns` are never removed, aged, or deactivated.** `active:false` is never written anywhere in `app/` or `lib/`. Row count grows unbounded; a renamed variant creates a permanent new row. (Prompt exposure *is* capped at top-5.) | `save.ts:416-459`; `load.ts:205-209` |
| **A8** | **Unbounded query every turn** — `journeyTurn.findMany` with no `take`, fetching every turn the user has ever had, just to compute `sessionCount`. | `load.ts:213-217` |
| **A9** | **`currentDepth` is dead state** — `recommendedDepth` is declared and read but never assigned; `currentDepth` is only ever `'surface'`. It is rendered to the model as fact and stamped on every audit row. | `save.ts:22,116`; `router.ts:214,224`; `assemble.ts:201` |
| **A10** | **Move lane can reach discharge without MII.** Three turns tagged `stage_N.*` at intensity ≤5 move the pointer; skipped stages are never marked complete. | `move-based-advance.ts:29-32,76,171` |
| **A11** | **~10,040 tokens re-sent uncached every turn** — block 4 sits after the dynamic state block; only 2 of 4 cache breakpoints are used. | `assemble.ts:636-647` |
| **A12** | **`finaliseTurn` has no top-level try/catch.** If the assistant-message write or `applyStateReportToProgress` throws, the audit row is never written — silently corrupting the session-derivation signals and dropping the turn from every gate window. | `route.ts:509-701`, guard only at `:689-699` |

---

## 5. Corrections to my earlier audits

**Correction 1 — the Stage-2 seal does NOT cause the thin repertoire (part 1,
F1; repeated in part 4 §5.3).** I claimed being sealed at Stage 2 restricted the
model to a two-move repertoire. **That was wrong.** `assemble.ts:479` explicitly
tells the model stage numbers are *"NOT capability gates"*, and all 8 stage
playbooks load every turn (`assemble.ts:532-544`). The model can and does use
Stage 4/5 moves at Stage 2 — the 21-July *good* session did exactly that
(`origin_voice_mapping` ×5, `symbolic_return` ×5, `first_contact` ×2). The seal
is still a real defect for progression bookkeeping and discharge, but it is
**not** the cause of the repertoire collapse.

**Correction 2 — out-of-stage parts work is by design, not drift (part 1, F2).**
I flagged `stage_4.first_contact` at Stage 2 as a safety violation caused by
degradation. The 21-July good session shows the same pattern. The genuine
finding is narrower and stands: **"Adult Self required for parts work" is
prompt-only with zero code enforcement** (`journey-master.md:380` vs
`stage-gates.ts:214,252,446,534` which read `adultSelfPresent` only for
advancement).

---

## 6. What this means for "run the methodology like a professional clinician"

The methodology says The Journey *"is a clinical reasoning system"* and
*"clinical reasoning always comes before technique."* The architecture
implements neither:

- **There is no session** — so there is nothing to lead, pace, open or close.
- **There is no clinical supervisor** — the only in-turn code behaviour is
  tag-stripping.
- **There is no reasoning representation** — every schema field stores a
  conclusion; none stores uncertainty, observation state, or the decision to
  withhold (part 4 §4, unchanged and reinforced by this trace).
- **The one mechanism that does accumulate is unbounded** and actively degrades
  the record it accumulates into (§2).

The gap is not a prompt gap. **The system has no clinical control plane at all.**

---

## 7. Recommended order (nothing authorised by this document)

**Tier 0 — stop the bleeding (small, mechanical, high value):**
1. Cap `continuityNote` at parse (`parse.ts:383`) as every sibling field already
   is. Single-line class of fix; directly de-risks §2.
2. Persist a `reportParseFailed` flag so a defensive default is never
   indistinguishable from a real clinical reading (`parse.ts:91-95`,
   `audit/log.ts:26-31`).
3. Validate `modelOverride` against an allow-list (A1).
4. Run `detectLeak` on the live stream, not only at persist (A2).

**Tier 1 — build the missing control plane:**
5. A real session record (open/close/last-activity), so closure, pacing and the
   1–10 discipline become interceptable at all.
6. In-turn enforcement of the invariants already written in the prompt:
   Adult-Self precondition for deep work; stability-check-before-close;
   modality switch after rejection.
7. A code-side regression floor (intensity threshold / repeated overwhelm) that
   does not depend on the model emitting a token.

**Tier 2 — restore clinician mode:**
8. Reasoning fields in the schema (`stillObserving`, `whatIDontKnowYet`,
   `hypothesisConfidence`, `withholdReason`) so restraint is expressible.
9. Merge the Golden Harness to `main`; make a recorded-mode parity check
   mandatory on every prompt/gate change, and a live run mandatory once a key is
   provisioned.
