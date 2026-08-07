# SESSION HANDOFF — 2026-08-06

**Read this BEFORE CLAUDE.md.** Most recent operational state.
Supersedes the 2026-06-28 handoff (archived in git).

---

## ⛔ HARD CONSTRAINTS — read first, these are live

### 1. The clinician prompt is FROZEN

Owner decision, 2026-08-06. **Do not modify:** prompt, examples, canon,
stage methodology, memory, practices, clinical reasoning, behavioural
wording. This covers `docs/journey/00-shared-core.md`, `01`–`08` stage
specs, and `docs/journey/runtime/journey-master.md`.

The freeze lifts only when the owner says so — planned after the Closing
and Memory work is complete and end-to-end tested.

### 2. Remote refs need explicit approval

Owner decision, 2026-08-05. Do not create, delete, archive, rename,
overwrite or force-push **any** remote ref without asking first — even to
preserve data. Ordinary pushes to an approved working branch are fine once
that branch is approved. Never push to `main`.

### 3. Migrations are never executed by the agent

Standing project rule. Author the SQL, put it in the PR body, let Julia run
it manually in Supabase. Never `prisma migrate` / `db push`.

### 4. Clinical decisions are the owner's

Owner decision, 2026-08-06: *"if implementation requires making a clinical
decision that is not explicitly specified by the approved methodology, stop
and ask rather than introducing a reasonable default."* This is absolute.
Do not pick a sensible option and flag it — stop.

---

## The product goal (owner's framing, 2026-08-06)

> We are not trying to produce a compliant AI. We are building an **AI
> Clinician that genuinely thinks like an experienced clinical psychologist**
> while operating safely within The Journey methodology.

Evaluate every recommendation against that, not against isolated behaviours.
The Journey should: understand the person across sessions; form and test
clinical hypotheses; recognise patterns and stuck points; choose meaningful
interventions; move the work forward; preserve continuity; stay natural and
responsive; follow the methodology without becoming mechanical.

---

## TL;DR — where we are

**Activated Closure Phase 1 is shipped and live** (`ab23525` + hotfix
`efd81c5`, PRs #363/#364). Migration applied by the owner 2026-08-06;
verified all 5 users on `NONE` / `0`.

**Phase 2 (structural half) is approved and starting.** Plan agreed; two
boundary questions are open and block its final step (see below).

**A regression audit was completed and its conclusion was NOT accepted.**
The owner is deliberately deferring the prompt question until Closing and
Memory are done. Do not reopen it unprompted.

---

## Locked owner decisions — Activated Closure

These were decided in conversation and exist nowhere else. Treat as canon.

**Process semantics**
- `CLOSED` means one Activated Closure sequence completed. It does **not**
  mean the chat is permanently closed. A new substantive turn returns the
  process to `NONE`.
- An unfinished sequence left >4h is **retained** as `INCOMPLETE`. Old
  stability scores are never reused; a fresh assessment is required when the
  clinical sequence is connected. Route, entry time and round count are
  preserved as the record.
- The 4-hour threshold is the existing `SESSION_BOUNDARY_MS`, imported, never
  redefined.

**`HUMAN_SUPPORT`** is an **active human-handoff state**, not a terminal
outcome. Two exits only:
- → `CLOSED` *only* on concretely confirmed handoff (user contacted a trusted
  person; trusted person physically present; urgent professional service
  contacted; emergency handoff initiated and confirmed). `CLOSED` here means
  the closure completed **through** that handoff — not that the AI
  independently stabilised the user.
- → `INCOMPLETE` when the user leaves, stops responding, or no handoff is
  confirmed.
- A distinct `HUMAN_HANDOFF` outcome may be added later with clinical outcome
  fields. It is deliberately **not** a runtime state.

**Deterioration during `AWAITING_CLOSE_CONFIRMATION`**
- `AWAITING_CLOSE_CONFIRMATION → AWAITING_POST_SCORE` is allowed.
- It does **not** consume a stabilisation round. A round is consumed only
  when a stabilisation intervention is actually **delivered** — i.e. on entry
  to `DELIVERING_STABILISATION`.
- Phase 2 decision logic: acceptable fresh score → back to
  `AWAITING_CLOSE_CONFIRMATION`; below threshold with <2 completed rounds →
  `DELIVERING_STABILISATION`; two rounds done, deterioration, uncertain
  safety, or no safe plan → `HUMAN_SUPPORT`.

**Freeze precedence (absolute)**
- While `frozenForReview` is active: closure must not advance, closure
  behaviour must not run, and the process must **not** automatically become
  `INCOMPLETE`.
- A freeze landing on an active sequence sets `closureFreezeInterruptedAt`
  and changes nothing else.
- On the first unfrozen turn the attempt converts to `INCOMPLETE`, the round
  count **resets**, the marker clears. Phase 1 stops there — it does not
  auto-enter `AWAITING_INITIAL_SCORE`.
- Rationale: `clearFreezeForReview` nulls `frozenAt`/`frozenReason`, and a
  manual SQL clear bypasses the helper entirely, so nothing else survives to
  detect the freeze. Inferring it from `JourneyTurn` history is forbidden.

**Exit-intent detection — approved design, Phase 2**
Order: (1) crisis scan; (2) deterministic, locale-specific, high-precision
detection of explicit stop / pause / leave / continue-later intent; (3) a
separate ambiguous-intent path (e.g. "I can't do this any more") *after*
crisis meaning is excluded; (4) model-reported exit intent may be retained as
a supporting/audit signal only — **never** the current-turn gate.
**A separate classifier call is NOT approved.** Deterministic detection is to
be evaluated with the Golden Harness first.

**Also settled**
- Standard scale questions may be code-authored.
- Personalised explanation, stabilisation and aftercare remain
  model-authored.
- Response buffering is out of scope.

---

## Phase 1 — what shipped

Server-owned closure process state on `RecodeProgress`, written only by code,
never reconstructed from model output.

| Concern | Owner |
|---|---|
| Closure **process** state | Server-owned orchestration — `RecodeProgress` |
| `cycleStatus` / `cycleCanClose` / `hasOpenCycle` | Model-reported **clinical** state — not the process authority |
| `closure/guard.ts` | Legacy **post-response record validator** — does not own process state |

Do not merge these three concepts.

- `lib/journey/closure/process.ts` — **single source of truth** for the eight
  process values and all transitions. Pure. Never spread transition logic
  elsewhere.
- `lib/journey/closure/orchestrator.ts` — pre-LLM hook, mirrors the
  `frozenForReview` pattern. Sits after crisis handling, before prompt
  assembly (`route.ts` ~line 351).
- `loadJourneyState` reads the process directly off the row.
- `router.ts` + `state/save.ts` hold recorded stage/depth progression while a
  sequence is active. Regression and shallowing stay available.
- Eight columns, all `closure*`. Migration applied 2026-08-06.

Known limitations carried forward:
1. Two `INCOMPLETE` records mean different things — the 4-hour path retains
   `roundCount`, the freeze path resets it. `roundCount` on an `INCOMPLETE`
   record is not a reliable count of rounds delivered.
2. A freeze applied by hand in SQL sets no marker (`freezeJourney` is the
   only writer). The reverse — code freeze, manual clear — is covered.
3. `save.ts`'s depth guard is dormant: `recommendedDepth` is declared in
   `Updates` but never set by the state-report pipeline.

---

## Phase 2 (structural half) — approved scope, in progress

**In scope:** closing entry detection · `NORMAL_CLOSE` vs `ACTIVATED_CLOSE`
routing · closure state sequencing · deterministic transition logic ·
code-authored stability-scale flow · score handling · round counting · guard
integration · persistence across turns · process orchestration.

**Explicitly out:** stabilisation text · psychoeducation · personalised
explanations · aftercare · generated practices · prompt instructions.

**Stop exactly where clinical content begins.**

Agreed plan: (1) exit-intent detector; (2) score persistence — four columns,
second migration; (3) score fields + `scoreChange` + closure decision inside
`process.ts`; (4) entry evaluation + routing in the orchestrator, using
`state.lastIntensity` against the existing `DESTABILISATION_INTENSITY`;
(5) score capture in `finaliseTurn` from the `stabilityCheck` Repair 1
already parses; (6) guard integration by **importing constants and calling
`evaluateClosureGate`** — `guard.ts` is not modified; (7) ⛔ seam — the
orchestrator returns a typed decision naming the required turn but does not
produce its text.

### OPEN — these block step 7

- **Q1: the stability-scale question wording.** User-visible copy, needs
  en + ru at minimum, needs owner sign-off.
- **Q2: what happens on the entry turn?** Protocol step 1 is
  STOP_AND_EXPLAIN — personalised and model-authored, therefore excluded. So
  does the code (a) record entry and let the model reply normally, with the
  scale question next turn, or (b) go straight to the code-authored scale
  question, skipping the explanation? **Clinical decision — do not pick one.**

Proceeding without objection: ambiguous intent is recorded for audit and does
**not** enter the protocol; `HUMAN_SUPPORT` becomes reachable but produces no
behaviour; the second migration is treated as in-scope.

---

## Regression audit — findings ON RECORD, conclusion NOT accepted

Completed 2026-08-06. The owner did **not** accept it and froze the prompt
instead. Do not act on it. It is retained for the re-evaluation the owner
scheduled *after* Closing and Memory are complete.

**What was found.** After the #355 restore to the known-good `c26fb80`/#339
baseline, four prompt PRs landed within 48 hours, none with a behavioural
before/after: #356 (149 lines across all 8 stage specs), **#357
"gather-before-depth"**, #358 "hygiene", #359 (senior-clinician block).

#357 raised the formulation threshold, gated deep moves behind "picture
gathered AND checked with the user", added "hold it silently… do NOT commit",
weakened the share-back, and rewrote two worked examples from hypothesis to
intake. #358 — labelled hygiene — added *"capability never overrides the
gather-before-depth gate"*, closing the last route to depth. #359 explicitly
subordinates itself to those gates.

Observed in the real 2026-08-05/06 session: Stage 1/surface for all 10 turns,
`witness_and_reflect` in 7 of 8, one depth move, zero practices, zero anchor
recall despite an anchor being set, `recommendedAction: "stay"` ×10, no
formulation ever shared. The model quotes the instruction back in its own
`clinicalRead` five times ("не углублять", "не углубляться", "не глубокая
работа", "No clinical intervention needed this turn").

**Ruled out with proof:** Phase 1 (prompt assembly never reads
`closureProcess`; the only `JSON.stringify` in `assemble.ts` is scoped to
`pattern.context`; the failing turns predate the successful deploy), model
config (`claude-sonnet-4-6`, unchanged since #125; no temperature set),
`HISTORY_LIMIT = 30` (unchanged since #125), message ordering, cache split,
the SEO PRs.

**The owner's counter-argument, which the audit does not answer:** behaviour
is observed changing between sessions with the prompt unmodified. A static
prompt cause cannot explain dynamic variance. What remains in play is the
per-turn-variable surface — state block, continuity note, derived signals,
30-message history — plus model sampling. That is the Memory work, which is
why it comes first.

**Also unresolved:** #356's behavioural contribution is unquantified; no
byte-exact assembled input was reconstructed for the failing session (needs
decrypted state — the golden fixture `julia-2026-07-21.json` in `eval/` would
permit it without a model call); no before/after exists for #356–#359.

**Self-priming, measured:** `continuityNote` is copy-forward-and-append —
turns 8→9→10 near-verbatim with one clause added each time. Model-generated
hypotheses harden into asserted fact and are never re-tested
("Внутренний разрыв с мужем завершён" ×3). The model is primed twice by its
own output: ~15 prior replies in history *and* its own continuity note in the
state block.

---

## Working agreements with the owner

- Short updates. No menus of options. Act rather than offer.
- Propose copy inline for line review before writing it to files.
- Report failures plainly with the evidence; never claim green without it.
- The stop-hook forces a commit before idle — the review gate is the PR
  boundary, not mid-session.
- `eval/` and `scripts/` are git-excluded. A clean checkout has neither, so
  local `tsc`/build failures inside them are **not** regressions — verify by
  moving them aside before declaring a build broken.
- Tests must never pin an absolute timestamp near "now". `deriveSensitivity
  Signals` measures against the real clock and `SESSION_BOUNDARY_MS`; an
  absolute date passes on the day it is written and breaks the build the next
  day. This took production builds down on 2026-08-06 (#364).

---

## Key anchors

| Thing | Where |
|---|---|
| Closure transition model (single source of truth) | `lib/journey/closure/process.ts` |
| Pre-LLM orchestration hook | `lib/journey/closure/orchestrator.ts` |
| Legacy closure record validator | `lib/journey/closure/guard.ts` |
| Turn route (hook at ~351, `finaliseTurn` below) | `app/api/journey/turn/route.ts` |
| Prompt assembly (4 blocks, cached 1–2) | `lib/journey/prompts/assemble.ts` |
| Session boundary constant | `lib/journey/state/session-boundary.ts` |
| Golden Harness + fixtures (git-excluded) | `mindreset-app/eval/journey/` |
| Preserved pre-Phase-1 evidence branch | `claude/archive-pre-phase1-eval-evidence-2026-08-05` |
| Prior regression audits (archive branch only) | `docs/journey/audit-2026-07-26-*.md` |
