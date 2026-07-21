# Runtime Architecture Map — Journey Turn (2026-07-21, code-verified)

Full production path, one turn, verified by direct code reading (not comments). All
paths relative to `mindreset-app/`. AUTH = authoritative (code-enforced), ADV = advisory
(model may ignore). "Current/Later" = does the step affect the CURRENT visible reply or
only later turns.

```text
User message
→ request preparation
→ user-message persistence
→ state retrieval
→ history construction (+ leak mask)
→ prompt assembly (4 blocks)
→ emission-reminder injection
→ model call (single stream)
→ streamed visible-reply extraction
→ hidden state-report parsing
→ safety verifier (post-stream)
→ persistence (state + audit)
→ stage/depth/progression routing
→ next-turn context construction
```

| # | Step | File:lines | Input → Output | Added | Removed | Truncated | Current/Later | AUTH/ADV |
|---|---|---|---|---|---|---|---|---|
| 1 | Request prep | `app/api/journey/turn/route.ts:88-198` | HTTP → validated turn ctx | — | — | msg cap 4,000 chars (`:73`) | current | AUTH (Clerk auth :89; rate-limit :96; deleted/red-screen 403/412 :139-154; monthly cap :161-184; access :188-195) |
| 1a | Frozen-state branch | `route.ts:223-307` | frozen? → canned crisis exchange | canned reply persisted | — | — | current (replaces LLM turn entirely) | AUTH; only Haiku verifier `safety_confirmation` lifts (`:264-285`); 20s floor `:228-234` |
| 1b | Red-flag pre-scan | `route.ts:310-334`; `lib/journey/safety/keywords.ts:150-160` | user msg → regex verdict | freeze + audit row (intensity 10) | — | — | current (LLM never called on hit) | AUTH, pure regex |
| 2 | User msg persisted | `route.ts:338-345` | msg → `JourneyMessage` row | row | — | — | later (it's the last history element this turn) | AUTH |
| 3 | State retrieval | `lib/journey/state/load.ts:164-332` | DB → `JourneyState` | derived: sessionCount/daysEngaged/thisSessionMessageCount/stageJustAdvanced/hoursSinceLastTurn/isSessionResume (`:105-162`); sensitivity signals from last ≤10 turns (`:378-488`) | landscape capped: parts 5, files 3, images 5, patterns 5 (`:179-209`) | `clinicalRead`→`openCycleDescription` | current (feeds prompt) | mixed: caps AUTH; content ADV |
| 3a | Session-boundary reset | `load.ts:396-399` | resume? → sensitivity = empty | — | **open cycle, rejected modalities, channel shift all DROPPED on ≥4h gap** | — | current | AUTH |
| 4 | History construction | `route.ts:347-397` | last **30** msgs (`HISTORY_LIMIT` :62) → outbound array | — | older turns invisible to model; leak-matching assistant rows masked to `'[previous reply omitted]'` (`:376-389`) | — | current | AUTH |
| 5 | Prompt assembly | `lib/journey/prompts/assemble.ts:589-651` | state → **4** system blocks (docstring at `:567-575` stale — says 5) | B1 [cached] canon hdr+Shared Core+PGA+ALL 8 specs (`:618-628`, `allStageSpecs` `:532-544`); B2 [cached] master-before-state (`:631-635`); B3 dynamic state block (`renderStateBlock` `:151-453`); B4 master-after-state | — | continuityNote render: ≤800 whole, else head 400+tail 300+omission marker (`:410-439`); clinicalRead→240 chars (`:269`) | current | content ADV to model; assembly AUTH |
| 6 | Emission reminder | `lib/journey/prompts/emission-reminder.ts:36-44`; `route.ts:397` | history → +`<system-note>` on last user msg | reminder (never persisted) | — | — | current (recency slot) | ADV |
| 7 | Model call | `route.ts:361,399-404`; `lib/journey/model.ts:19-22` | blocks+messages → stream | — | — | `max_tokens 2500` shared reply+report (`:68`) | current | **temperature ABSENT → API default (~1.0)**; model `claude-sonnet-4-6` all stages; `body.modelOverride` passed through **unvalidated** (`model.ts:20`) |
| 8 | Visible-reply extraction | `lib/journey/streaming/reply-processor.ts:133-292` | raw stream → visible text | — | `<assessment>`/`<thinking>` stripped anywhere (`:48-51,145-186`); everything from `<state-report>` on never streamed (`:236-243,268-269`); stream ending inside a private tag/report → `''` (`:282-292`) | — | current | AUTH |
| 9 | Report parsing | `lib/journey/stateReport/parse.ts:129-413` | raw text → `StateReport` | — | private tags re-stripped at write time (`:69-89`); unknown fields/enum failures silently dropped field-by-field | contract fields cap 300; generic values dropped (`:427-450`) | later only | AUTH parse; **parse failure/truncation → `DEFENSIVE_DEFAULT {intensity:5, safetyFlag:'watch', recommendedAction:'stay'}`** (`:91-95,163-171`) — a hold-biased turn recorded silently (`B_truncated_at_max_tokens` label is log-only, `route.ts:522-572`) |
| 10 | Safety verifier | `lib/journey/safety/verifier.ts`; `route.ts:472-485,620-646` | user msg (+≤6 turns) → verdict | freeze on `clear_crisis` (`:639-646`) | — | — | **later — runs inside `waitUntil` AFTER `controller.close()` (:443): this turn's reply already reached the user** | AUTH; Haiku (`verifier.ts:26`), 8s timeout, fail→`ambiguous` |
| 11 | Persistence | `lib/journey/state/save.ts:34-181,289-459`; `lib/journey/audit/log.ts:18-54` | report → DB | anchor set-once (`:102-105`); identityAnchor overwritten on re-emit (`:106-109`); patterns upsert; releases claim/confirm/invalidate (`:289-401`); full report → encrypted audit blob | fields code IGNORES: `channelShiftDetected`, `therapeuticMode`, `nextBestMode`, **`cycleCanClose` (parsed, read by NOTHING)**, `stabilityCheck` (stored, no gate reads score), `clinicalRead` (audit-blob only) | continuityNote **FULL OVERWRITE** (`:118`) — "revise additively" is prompt-only | later | AUTH |
| 12 | Routing | `lib/journey/router/router.ts:57-239`; `stage-gates.ts`; `move-based-advance.ts:112-203` | audit history → stage decision | advance/regress/discharge writes (`:210-237`, optimistic-concurrency on `currentStage`) | — | — | later | AUTH. Classic lane: `advance` **necessary but not sufficient** (+ intensity/safety/tokens/reproducibility). Move lane: **ignores `recommendedAction` entirely**; needs ≥3 qualifying `stage_N.*` turns, intensity ≤5 each, safety none, adultSelf ≥50%. Open-cycle guard `router.ts:76,95-109`: only literal `'open'` on the single last turn blocks (`'closing'` does NOT) — a DIFFERENT rule from the state block's `hasOpenCycle` (open OR closing, session-windowed). `regress_to_*` honoured unconditionally from a single report (`:80-91`). Discharge needs Stage-8 gate AND `discharge` (`:99-102`). |
| 13 | Next-turn context | `save.ts:118` → `load.ts:310` → `assemble.ts:410-439`; `load.ts:432` | this turn's report → next turn's prompt | continuityNote (truncated render); within-session only: openCycleDescription=clinicalRead(240) | full reports NEVER re-enter model context (only the 4-field sensitivity derivation) | see 5 | later | — |

## `currentDepth` — proven dead

Writers: `app/api/journey/start/route.ts:48` (`'surface'`), `router.ts:214,224` (hardcoded
`'surface'` on every advance/regress), `save.ts:116` (conditional on `updates.recommendedDepth`
— **never assigned** by its only caller `save.ts:34-82`, and `StateReport` has **no such
field** for the model to emit). Readers: prompt render (`assemble.ts:201`), admin display,
audit-row copy (`depthAtTurn` — read by no gate). **The field can never hold anything but
`'surface'`.** The model is told "Current depth: surface" on every turn, including during
deep work.

## Decisive answer — can this turn's analysis shape this turn's reply?

**No. Architecturally impossible, not merely disciplined-against.**
1. One `anthropic.messages.stream` call per turn (`route.ts:399-404`); no second pass.
2. Single autoregressive generation: report tokens are generated causally AFTER the reply
   tokens, which have already been flushed to the client (`reply-processor.ts:236-243`).
3. `<assessment>`/`<thinking>`, if emitted, are stripped and discarded — never parsed,
   never fed forward (`reply-processor.ts:145-186`).
4. Parsing, persistence, verifier and routing all run after `controller.close()`
   (`route.ts:434-495`).
The state report can only shape the **next** turn's prompt, or freeze the **next** turn.
(The model's un-captured internal reasoning inside the single generation is ordinary LLM
behaviour, not a code-mediated analysis step — nothing enforces it happens, and PR β
removed the one artefact that did.)

*Read-only audit. Facts only.*
