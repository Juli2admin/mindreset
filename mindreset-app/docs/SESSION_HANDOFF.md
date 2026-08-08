# SESSION HANDOFF — 2026-08-08

**Read this BEFORE CLAUDE.md.** Most recent operational state.
Supersedes the prior handoff (2026-06-28, archived in git).

This document records **settled facts and decisions only**. Anything not
written here is not settled. If something below contradicts an older
document, this document wins.

---

## TL;DR — where we are

Journey **Closing** is complete and live on `main`. Two PRs landed:

- **#365 — Clinician Working Memory.** Merged (`d65ae91`).
- **#366 — Activated Closing Phase 2, measurement-first.** Merged (`0d935f8`).

The stability-score migration has been **run successfully in production**
(four nullable columns on `RecodeProgress`, verified: all four present,
zero rows populated at the time of the run).

A post-merge cleanup pass followed; see *Post-merge cleanup* below.

---

## PR #365 — Clinician Working Memory (merged)

The background clinical analysis is **private working clinical memory**. It
informs the Clinician's reasoning and is never surfaced to the user.

- **BP-A closed.** The `StateReportForSensitivity` narrowing that silently
  dropped the return path is fixed. The analysis now actually reaches the
  Clinician.
- **BP-D closed.** The fabricated `intensity = 5` / `safetyFlag = 'watch'`
  defaults are gone. Absent values read as absent, not as invented clinical
  facts.
- **BP-E remains open and SEPARATE.** It did not block #365 and does not
  block Closing. It is not in scope for any Closing work.

---

## PR #366 — Activated Closing Phase 2 (merged)

### The failure this closed

On **2026-08-08 08:49** the Clinician ended a session in which intensity
reached **6 on eleven turns**, with **no stability measurement ever taken**.
Its own state report recorded *"closing gently without forcing a stability
number she hasn't offered"*, and `claimsClosure` was false, so the closure
guard was never called. Every enforcement layer ran **after** the reply had
already streamed.

### Measurement-first semantics (settled)

Two different questions, answered by two different things:

| Question | Answered by |
|---|---|
| Does this close require a **current stability measurement**? | **historical destabilisation** in this session |
| Is this person **stable enough to close**? | the user's **own current reported score** |

**Historical destabilisation means "measurement required". It does NOT mean
"currently activated".** A session that spiked earlier and has genuinely
settled must be able to close normally. `ClosureRoute` is an **outcome** of
the measurement, never an input to entry.

- **Threshold remains 6.** Unchanged.
- **An ordinary close does not enter Activated Closing.** When no measurement
  is required there is no process entry at all.

### The Closing flow

Five reachable states. Not every path visits every state.

```
NONE
  -> AWAITING_INITIAL_SCORE
  -> DELIVERING_STABILISATION
  -> AWAITING_POST_SCORE
  -> CLOSED  /  INCOMPLETE
```

- An explicit **`session_exit` is the user's decision to leave**. There is
  **no second confirmation question** — asking someone to confirm a decision
  they have already made re-opens it.
- **Score ≥ threshold → successful close** (`CLOSED`).
- **Stabilisation is bounded.** Below threshold with rounds remaining runs
  another round; **rounds exhausted below threshold → `INCOMPLETE`**.
- **First non-answer → one re-ask.** **Second non-answer or refusal →
  `INCOMPLETE`.** Never a third ask, never a fabricated score, never a
  claimed successful close.
- `INCOMPLETE` is the honest record: the attempt stays on file, `completedAt`
  is untouched, and the user is released rather than trapped.

### No Human Support service

**MindReset provides no human-support service and no managed handoff.** The
platform is self-help. Closing must never route into one.

**Crisis and emergency handling are a SEPARATE, unchanged mechanism.** The
keyword scan runs before the Closing hook is ever reached. Nothing in Closing
alters it.

### Enforcement

- **Code-owned required questions short-circuit BEFORE the model call.** The
  stability question is code-authored and locale-aware, and it is delivered
  by a short-circuit at `route.ts` before prompt assembly. This is the only
  control point that can work: `controller.enqueue` is the irreversibility
  point, and nothing downstream can prevent a user-visible goodbye.
  Enforcement is a short-circuit, never a prompt hint.
- **Clinician-generated stabilisation is constrained by process state and
  verified from structured evidence.** A pre-LLM platform note names the step
  the process is in; the process advances only on a `practiceRun` in the
  `regulation` or `somatic` family at `status: "completed"`. No evidence holds
  the state rather than moving the user on. *Constrain, then verify.*
- **Compositional EN/RU exit detection is live.** Predicate (continue / stop /
  depart / done / signoff) × scope (session vs topic) × negation role, plus a
  volition-vs-capability axis (`не хочу` vs `не могу`) that separates exit from
  exhaustion without touching the crisis boundary.

### Measurement provenance

**Both provenance paths are valid under the common guard contract:**

- **code-captured** — the platform asked the approved stability question and
  parsed the user's own answer;
- **clinician-elicited** — the Clinician asked, and the value arrives on
  `stabilityCheck`.

The code-captured path is authoritative when it is fresh and correctly ordered
against the destabilisation, because the model cannot forge it — it never
passes through the state report. The legacy `stabilityCheck` path is
unchanged, and every existing guard invariant still holds.

### The master prompt is unchanged

The English stability question was lifted **verbatim** from
`journey-master.md:342` under owner approval. No prompt, canon, example,
methodology or Practices change was made by #365 or #366.

---

## Post-merge cleanup (2026-08-08)

A bounded hygiene pass after #366. **No product behaviour change, no schema
change, no migration.**

1. **One canonical persistence writer.** The twelve-column `ClosureProcess`
   payload was duplicated by hand in two writers; a new field added to one and
   missed in the other would have been dropped on write while memory believed
   it persisted. `lib/journey/closure/persist.ts` now holds the single
   field-to-column map, and an omission is a **compile error**. Fail-safe
   semantics are unchanged: a failed write returns the record as the store
   holds it, so memory never claims a transition the store refused.

2. **Two dead states removed.** `AWAITING_CLOSE_CONFIRMATION` and
   `HUMAN_SUPPORT` are gone from the state union, transition table, active-state
   classification, tests and comments. Neither ever had a runtime producer, so
   no persisted row can hold either value. `closureProcessState` is plain
   `text` with no enum and no CHECK constraint, so **no migration was needed**;
   `normaliseClosureProcess` still degrades any unrecognised string to `NONE`.

---

## Standing engineering rules for this work

- **No paid model runs, Golden Harness runs, benchmarks or live API
  experiments** without explicit owner approval for that exact run.
- **Do not rebuild missing infrastructure** without approval.
- **Do not implement anything until the owner approves the exact change.**
- **Do not choose architecture or methodology for the owner.**
- **Use existing evidence first.** If something is already proven or rejected,
  do not test it again.
- **All migrations are run manually by Julia.** Never `prisma migrate dev`,
  `migrate deploy`, or `db push`.
- **No remote ref creation, deletion or force-push without asking.** Never
  push to `main`.
- If implementation requires a **clinical decision not explicitly specified by
  the approved methodology, STOP and ask** rather than introducing a reasonable
  default.

### Frozen without explicit approval

The Journey master prompt, `<examples>`, `<output_format>`, canon (Shared
Core, Practice Generation Algorithm, all 8 stage specs), stages and
progression rules, clinical wording, and the `assemble.ts` state-block copy.

### Decision authorities

Exactly three: **Engineering verification**, **Architecture/Product
decision**, **Clinical methodology**.

---

## Rejected — do not reopen

| # | Rejected hypothesis |
|---|---|
| R1 | `lastIntensity` as route authority |
| R2 | `findDestabilisation()` as a *current-activation* authority |
| R3 | A targeted pre-LLM activation classifier |
| R4 | Server-independent activation inference |
| R5 | "Zero valid closes ever" |
| R6 | Prompt / example changes to fix Closing |
| R7 | `evaluateClosureGate()` as authority over the Closing process |

Also settled and closed: **no post-LLM verifier for the wording of the final
close.** The closure decision is code-owned, `CLOSED` is reached only after a
validated current-state measurement, `INCOMPLETE` claims no successful
closure, and prose quality remains the Clinician's responsibility. We are not
adding another enforcement layer for prose.

---

## Not in scope / still open

- **BP-E** — open, separate, not part of Closing.
- Deterioration above threshold (e.g. 9 → 7) is **deliberately unresolved**.
  `decideClosureOutcome` does not act on it; `computeScoreChange` exposes the
  delta for whoever settles it later.
