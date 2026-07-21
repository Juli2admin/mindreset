# Doc 1 — SYSTEM MAP: how one AI reply is produced today

Every component that participates in producing one Journey reply, in order.
Entry point: `app/api/journey/turn/route.ts` → `POST()` (route.ts:88). All
citations are `file:line` under `mindreset-app/`.

---

## 0. Pipeline at a glance

```
POST /api/journey/turn
  │
  ├─ 1. THIRTEEN PRE-LLM SYNCHRONOUS GATES  (any can short-circuit → no LLM)
  │        auth → rate-limit → body → length → user → deletedAt → screening-red
  │        → monthly-cap → access → state-load → [FROZEN path?] → [KEYWORD hit?]
  │
  ├─ 2. PROMPT ASSEMBLY   assembleSystemPromptBlocks(state) → 4 blocks (~85–86k tok)
  ├─ 3. HISTORY ASSEMBLY  last 30 msgs → decrypt → leak-mask → emission-reminder
  │
  ├─ 4. THE ANTHROPIC CALL   messages.stream({ model, max_tokens, system, messages })
  │                          claude-sonnet-4-6 · 2500 · temperature UNSET
  │
  ├─ 5. STREAM → USER   processor strips <assessment>/<thinking> + everything from
  │                     <state-report> onward; warm reply only reaches the user
  │
  └─ 6. POST-STREAM (waitUntil, background, concurrent)
           recordAiUsage │ finaliseTurn │ markFirstAccessAndIncrement
                              │
                              └─ split → parse → diag → persist(leak-gated) →
                                 verifier ‖ save-to-progress → freeze? →
                                 writeAuditTurn → router(decideRoute/apply)
```

Two paths never reach step 4: the **frozen-for-review** path and the
**keyword-hit** path (§6).

---

## 1. Pre-LLM synchronous gates (route.ts)

Each runs sequentially and `await`s. "Short-circuits" = returns an HTTP
response; the LLM is never reached.

| # | Gate | file:line | On failure |
|---|------|-----------|-----------|
| 1 | Clerk auth → `userId` | route.ts:89-90 | 401 |
| 2 | Rate limit (10/min/user, 30/min/ip; fails **closed** in prod on Redis error) | route.ts:96-103; rateLimit.ts:187-211 | 429 |
| 3 | Body JSON parse | route.ts:105-110 | 400 |
| 4 | Empty message | route.ts:111-112 | 400 |
| 5 | Message length ≤ 4000 (MAX_USER_MESSAGE_CHARS) | route.ts:117-126,73 | 413 |
| 6 | User row fetch (`deletedAt`,`screeningResult`) | route.ts:139-145 | 412 user-not-found |
| 7 | `deletedAt` set (30-day deletion grace) | route.ts:146-151 | 403 |
| 8 | `screeningResult === 'red'` | route.ts:152-154 | 412 screening-red |
| 9 | Monthly $ cap ($50 hard / $40 warn; **fails open** on aggregate error) | route.ts:161-184; monthly-cap.ts:26-27,98-104 | 429 over_cap |
| 10 | Journey access (completed Purchase + 1-yr window + <5000 msgs) | route.ts:188-194; access.ts:64-117 | 403 |
| 11 | `loadJourneyState(userId)` (RecodeProgress + parts/foreign/patterns/images/turns + continuity + sensitivity signals) | route.ts:197-198; load.ts:165-284 | 409 not-started |
| 12 | **Frozen-for-review branch** | route.ts:223-307 | enters §6A |
| 13 | **Keyword scan** `scanForJourneyRedFlag` | route.ts:310-334; keywords.ts:150-160 | enters §6B |

After gate 13 passes clean: persist user message (route.ts:338-345) → load
history (348-354) → assemble prompt (360) → select model (361) → decrypt+mask
(363-389) → emission reminder (397) → the call (399).

---

## 2. Prompt assembly — `assembleSystemPromptBlocks(state)` (assemble.ts:589-651)

Returns **exactly 4 blocks** (the docstring at assemble.ts:566-588 says "5" —
stale; see Doc 3). Master prompt is `docs/journey/runtime/journey-master.md`,
loaded from inside a fenced block (load-spec.ts:115-127) and split once at the
`{{STATE_INJECTION}}` token (assemble.ts:598-602).

| # | Block | Contents | cache_control | approx size |
|---|-------|----------|:---:|---|
| 1 | **Canon** | header + Shared Core (`00-shared-core.md`, 16,426 ch) + Practice-Gen Algorithm (9,186 ch) + **all 8 stage specs** (225,393 ch) | ephemeral | ~253 KB / ~63 K tok |
| 2 | **Master-before-state** | header + master lines 45–473 | ephemeral | ~45.5 KB / ~11 K tok |
| 3 | **Dynamic state block** | `renderStateBlock(state)` (assemble.ts:151-453) | none | ~1.5–6 KB (per-turn) |
| 4 | **Master-after-state** | master lines 475–925 (`<examples>` etc.) | none | ~40.6 KB / ~10 K tok |

- **All 8 stage specs are sent every turn** (assemble.ts:532-544). The current
  stage is **not** used to select a spec — it appears only as a label line in
  block 3 (assemble.ts:198-200) and the canon header frames stage number as
  non-gating (assemble.ts:473-483).
- Only block 3 is dynamic. Blocks 1+2 (~88% of static content) are the cache
  prefix; block 4 is static but sits after dynamic content, so uncached.
- Total system prompt ≈ **85–86 K tokens**.

---

## 3. History assembly + the Anthropic call

**History** (route.ts:348-397): most-recent `HISTORY_LIMIT = 30` messages
(route.ts:62), reversed to chronological; each decrypted (route.ts:363-368);
each **assistant** row run through `detectLeak` and replaced with
`'[previous reply omitted]'` on a hit (route.ts:376-389; user messages never
inspected); then `appendEmissionReminder` appends a `<system-note>` naming the
required state-report fields to the **last user message only** — never
persisted (route.ts:397; emission-reminder.ts:36-44).

**The call** — `anthropic.messages.stream({...})` (route.ts:399-404), exactly
four params:

- `model` = `getModelForStage(state.currentStage, body.modelOverride)`
  (route.ts:361; model.ts:12-22). `STAGE_MODEL_OVERRIDES` is **empty**, so
  absent a per-request override, **every stage uses `claude-sonnet-4-6`**.
- `max_tokens` = `MAX_TOKENS = 2500` (route.ts:68), shared by reply + report.
- `system` = the 4 blocks from §2.
- `messages` = the assembled history.
- **`temperature` is not set** — nor `top_p`/`top_k`/`stop_sequences`. The API
  default applies.

---

## 4. Streaming to the user (reply-processor.ts, wired at route.ts:416-441)

A phase machine (`undecided → in_private_tag → streaming_reply →
truncated_at_state_report`, reply-processor.ts:60-68) processes each
`text_delta`. It strips, before anything reaches the user:

- `<assessment>…</assessment>` and `<thinking>…</thinking>` private pairs,
  whether at the start or mid-reply (reply-processor.ts:40-51,161-254). The
  `<assessment>` strip is **vestigial-but-live** — the master prompt no longer
  asks the model to emit it (see Doc 3).
- Everything from `<state-report>` onward — a hard terminator
  (reply-processor.ts:236-243).
- A lookahead buffer prevents a partial open-tag straddling chunks from leaking
  (reply-processor.ts:55-58,255-264). If the stream ends inside a private tag,
  `finaliseStream` returns `''` — "safer to lose the reply than leak"
  (reply-processor.ts:282-292).

The user receives the warm human reply only. `processor.fullText` retains the
complete raw text for the background parser. Note: `detectLeak` does **not**
run at stream time — a real-time leak is only caught post-hoc at persist (§5).

---

## 5. Post-stream background — `finally` + `finaliseTurn`

In the `finally` block (route.ts:442-495): `controller.close()` →
`stream.finalMessage()` (awaited once, shared) → **three `waitUntil`
deferrals registered in order but run concurrently**:

1. `recordAiUsage` — one `AiUsage` row (callSite `journey_turn`), cost from
   usage (route.ts:454-466).
2. `finaliseTurn(...)` — the main post-processing (below).
3. `markFirstAccessAndIncrement` — stamps `firstAccessedAt` once, `+1`
   `journeyMessagesUsed` (route.ts:490-494).

**Inside `finaliseTurn` (route.ts:509-701), exact order:**

1. `splitReplyAndReport(fullText)` (route.ts:522; parse.ts:129-156).
2. `parseStateReport(...)` → validated `StateReport`; defensive default
   `{intensity:5, safetyFlag:'watch', recommendedAction:'stay'}` on any parse
   failure (route.ts:523; parse.ts:91-95).
3. State-report emission **diagnostics** — logs `failureModeGuess`
   (A_no_tag / B_truncated / C_skipped_optional / D_ok); no DB write
   (route.ts:541-572).
4. **Leak-gate persist** — `detectLeak(humanReply)`; stores
   `'[Reply interrupted…]'` placeholder on a leak or empty reply, else the
   human reply. **Only the human reply is stored; never the state report**
   (route.ts:593-613).
5. **Parallel** `Promise.all` (route.ts:620-625):
   `runJourneyVerifier` (Haiku, next-turn safety) ‖
   `applyStateReportToProgress` (writes RecodeProgress + landscape: parts,
   foreign files, patterns, images; save.ts:34-487).
6. Freeze if `report.safetyFlag === 'red_flag'` (source `state_report`,
   route.ts:629-636).
7. Freeze if verifier `clear_crisis` (source `verifier`, route.ts:639-646).
8. Build `finalReport` (verifier escalation/watch annotations,
   route.ts:660-674).
9. `writeAuditTurn` — one `JourneyTurn` row (plaintext gate columns +
   **encrypted full state report** + sha256 of the user message) and a child
   `JourneyPracticeRun` row if a practice ran (route.ts:676-682;
   log.ts:18-58).
10. **Router** — only if not red_flag: `reloadJourneyState` → `decideRoute` →
    `applyRouteDecision` (route.ts:688-700). See Doc 2 §3 for the decision
    logic and its two advance lanes.

---

## 6. The two short-circuit paths (no main-model reply)

### 6A. Frozen-for-review (route.ts:223-307)
Persist user message + canned crisis text (route.ts:224). Then: **20 s
wall-clock floor** → hold (route.ts:228-234); fresh **keyword re-scan** → audit
+ hold (route.ts:238-253); else **cooldown-lift verifier** (Haiku,
`isCheckingCooldownLift`, empty history) — `safety_confirmation` clears the
freeze and returns the lift message, anything else holds (route.ts:259-306).
This path **does** call the Haiku verifier (so it is not strictly LLM-free) and
does **not** bump the access meter (route.ts:219-222).

### 6B. Keyword hit (route.ts:310-334)
No LLM of any kind. Persist user message + canned crisis (313) →
`markFirstAccessAndIncrement` (314; note: unlike 6A this path **does** bump the
meter) → `freezeJourney({source:'keyword_scan'})` (315-320) → `writeAuditTurn`
red_flag (321-332) → return canned crisis text (333).

---

## Component inventory (one reply, live path)

`route.ts` (orchestration) · `rateLimit.ts` · `ai-usage/monthly-cap.ts` ·
`journey/access.ts` · `journey/state/load.ts` · `journey/safety/keywords.ts` ·
`journey/prompts/assemble.ts` (+ `load-spec.ts`, `state-block` renderer in
assemble) · `journey/prompts/emission-reminder.ts` ·
`journey/streaming/leak-detector.ts` · `journey/model.ts` · `@anthropic-ai/sdk`
· `journey/streaming/reply-processor.ts` · `journey/stateReport/parse.ts`
(+ `schema.ts`) · `journey/state/save.ts` · `journey/safety/verifier.ts` ·
`journey/safety/freeze.ts` · `journey/audit/log.ts` · `journey/router/router.ts`
(+ `stage-gates.ts`, `move-based-advance.ts`, `history.ts`) ·
`ai-usage/record.ts` · `journey/access.ts` (meter).
