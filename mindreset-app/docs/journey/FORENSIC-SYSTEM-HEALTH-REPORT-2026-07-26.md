# THE JOURNEY — FORENSIC SYSTEM HEALTH REPORT

**Date:** 2026-07-26
**Scope:** current `main` (`7ef46ca`), degraded production behaviour, last known-good runtime (`c26fb80` / PR #339), restore PR #355.
**Status:** read-only forensic report. No fix proposed, no change implemented.

### Evidence labels used throughout

| Label | Meaning |
|---|---|
| **PROVEN** | Demonstrated by executing code, or by a direct verbatim citation of the code as it stands. |
| **STRONGLY SUPPORTED** | Multiple independent lines of evidence converge; no single execution demonstrates it end-to-end. |
| **HYPOTHESIS** | A plausible mechanism consistent with evidence, not demonstrated. |
| **UNKNOWN** | The repository and available records cannot answer it. |

### Standing caveat

**Passing unit tests are not treated as evidence of behavioural correctness anywhere in this report.** The suite (863 tests) verifies structure and pure functions. It contains no behavioural assertion about clinical conduct. Every behavioural claim below rests on executed harness runs, executed probes, production inspector records, or verbatim code.

---

# 1. CURRENT SYSTEM STATE

What is loaded and active in production as of `main` = `7ef46ca` (2026-07-26 10:57:55 +01:00).

## 1.1 Runtime code

**PROVEN.** Since the known-good baseline `c26fb80`, exactly 14 commits landed. Non-test runtime code differs in these files only:

| File | Change | Nature |
|---|---|---|
| `lib/journey/prompts/assemble.ts` | 82 non-comment lines | Dead-path removal (§3, A0) |
| `lib/journey/prompts/load-spec.ts` | 27 non-comment lines | Dead loader removal |
| `lib/journey/safety/freeze.ts` | 2 non-comment lines | Removed `'manual'` from `FreezeSource` union |
| `lib/journey/stateReport/parse.ts` | **0** non-comment lines | Comment-only |
| `lib/journey/stateReport/schema.ts` | **0** non-comment lines | Comment-only |
| `lib/journey/prompts/emission-reminder.ts` | **0** non-comment lines | Comment-only |
| `app/api/journey/turn/route.ts` | 22 lines | Monthly-cap 429 payload shape only |
| `lib/ai-usage/monthly-cap.ts`, `lib/admin/journey-cost-report.ts`, `lib/journey/turn-error.ts`, `app/[locale]/journey/JourneyClient.tsx` | new/expanded | Billing cap, admin telemetry, client error UX |

**PROVEN — the production prompt entry point was not modified.** `assembleSystemPromptBlocks` does not appear in the A0 diff except inside the removed dead wrapper. What A0 removed: `assembleSystemPrompt` (dead wrapper), `STATE_REPORT_FORMAT_INSTRUCTION` (dead const), `DIVIDER` (dead const), `loadStageSpec`, `loadEngineeredStagePrompt` (Generation-B single-stage loaders), and the files `docs/journey/runtime/stage-01.md` and `stage-02.md`.

**PROVEN — no clinical/runtime behaviour was altered by the cap, telemetry, or error-UX commits.** They touch billing gates, an admin page, and client-side error rendering; none touches prompt assembly, gates, state report, or the model call.

## 1.2 System prompts and stage prompts

**PROVEN by execution.** A git worktree was created at `c26fb80` and `assembleSystemPromptBlocks()` was run in both trees against an identical state object:

```
BASELINE (c26fb80)  4 blocks  337,831 chars  FULL_SHA 24e60492f33e8d57fc99f76f24c700d4fe89113a2dc7d3e3bb3c6caeae2c01a8
CURRENT  (7ef46ca)  4 blocks  337,831 chars  FULL_SHA 24e60492f33e8d57fc99f76f24c700d4fe89113a2dc7d3e3bb3c6caeae2c01a8
```

Every block hash matches. **The system prompt now in production is byte-for-byte the 20 July prompt.**

Block composition (**PROVEN**, `assemble.ts:618-647`):

| # | Content | Chars | Cached |
|---|---|---|---|
| 1 | Shared Core + Practice Generation Algorithm + **all 8 stage specs** | 251,418 | yes |
| 2 | Master prompt up to the state-injection token | 45,093 | yes |
| 3 | Dynamic per-turn state block | ~800–8,000 | **no** |
| 4 | Master prompt tail (examples, output format, checklist) | 40,151 | **no** |

**PROVEN.** All eight stage playbooks are loaded on every turn regardless of the user's stage (`assemble.ts:532-544, 618-628`). **PROVEN.** The prompt explicitly instructs the model that stage numbers are *"a bookkeeping label … NOT capability gates"* (`assemble.ts:479`) and *"Router's stage label … bookkeeping"* (`assemble.ts:198-199`).

**PROVEN.** ~10,040 tokens (block 4) are re-sent uncached every turn because the static tail sits after the dynamic state block; only 2 of 4 available cache breakpoints are used.

**PROVEN.** The master prompt's own size note (`journey-master.md:38`, *"~3,200 tokens static"*) is stale by an order of magnitude; the real total is ~84,000 tokens.

## 1.3 Gates and progression

**PROVEN by execution.** Two advancement lanes exist and both run every pass (`router.ts:112-142`).

*Lane A — classic gate.* Requires the model to emit `recommendedAction: 'advance'` plus per-stage criteria.

*Lane B — move-based* (`move-based-advance.ts:112-203`). Advances with **no** model assent (`:31-32`), on ≥3 recent turns each tagging a `stage_N.*` move at intensity ≤5, requiring `adultSelfPresent` in ≥50% of the window (`:50`).

**PROVEN — the Stage 2 → Stage 3 gate cannot be passed by any user.** `checkStage2Gate` (`stage-gates.ts:174-177`) requires a `soft_why`-shaped token inside `readinessTouched`. The live prompt's permitted vocabulary for that field (`journey-master.md:647`) contains no such token, and the per-turn emission checklist (`:795-807`) never instructs the model to emit one. Executed against the real gate:

```
[B] PERFECT USER (intensity 3, safety clean, advance recommended,
    emotion_named + body_located, Soft Why performed on 10 days)
    → passed: false   reasons: [ 'soft_why_not_asked_or_answered' ]
[C] WITH a literal soft_why token → passed: true
```

**PROVEN — Lane B is also unreachable for this user**, since it requires `adultSelfPresent` in ≥50% of the window and `adultSelfQualities` has never been set for this account (production inspector, current state).

**PROVEN — this defect predates the good session.** History of the token: `#178` (2026-06-28) introduced the gate requirement; `#195` (2026-07-01) fixed it by adding `"soft_why"` and `"emotion_located"` to the master-prompt vocabulary **and** adding `stage2-vocab-contract.test.ts`; `#197` (2026-07-01, hours later, an emergency "restore trusted baseline") reverted the master prompt wholesale, removing both tokens **and deleting the contract test**. Never re-applied.

**PROVEN.** `stage-gates.ts:202` additionally requires `state.anchorText` to be set before Stage 2 can close.

## 1.4 ClinicalRead

**PROVEN.** Required on every substantive turn (`journey-master.md:623-626`), reinforced per-call by the emission reminder (`emission-reminder.ts:25`).

**PROVEN.** It drives **no code decision**. Its only consumers are: re-injection into the next prompt as `openCycleDescription` (`load.ts:432` → `assemble.ts:268-270`) and the admin inspector (`journey-inspect/page.tsx:537`).

**PROVEN.** The prompt describes it as internal-only — *"your scratchpad — the code never surfaces it to the user"* (`journey-master.md:793`).

## 1.5 Continuity and memory

**PROVEN.** The model's own prior analysis is re-injected into every subsequent prompt:
- `continuityNote` — written by model → `save.ts:45,118` → `load.ts:310` → rendered at `assemble.ts:410-439`.
- `patterns` — top 5 by `lastConfirmedAt` → `load.ts:205-209` → rendered at `assemble.ts:365-400`.

**PROVEN — `continuityNote` is the only free-text field with no inbound size cap.** `parse.ts:383` is a bare `copyStringField`. Every sibling is capped: `patternsTouched` 200 chars (`parse.ts:629`), `taskContract` 300 (`:447`), `stabilityCheck.contextNote` 80 (`:344`). Stored verbatim (`save.ts:118`).

**PROVEN.** The only truncation is render-side and cosmetic — head 400 + tail 300 when over 800 chars (`assemble.ts:427-438`). This protects the *input* budget and does nothing for the *output* budget the note is emitted into.

**PROVEN.** The prompt instructs additive-only growth: *"Never delete prior content; refine it"* (`journey-master.md:741`), *"Never wipe history; refine it"* (`:464`).

**PROVEN.** `patterns` are never removed, aged, or deactivated — `active: false` is never written anywhere in `app/` or `lib/`. Row count grows unbounded (`save.ts:416-459`); prompt exposure is capped at 5.

**PROVEN.** The model never sees its own past `<state-report>` blocks in conversation history — assistant rows persist reply-only (`route.ts:602-613`). History window is 30 **messages** (`route.ts:62`), no summarisation, no trimming.

## 1.6 taskContract

**PROVEN.** Four fields, each clamped to 300 chars at parse (`parse.ts:435,447`) and re-clamped on save (`save.ts:176-178`); field-wise merge protection (`save.ts:129-133,164-181`); rendered into the state block with a directive (`assemble.ts:168-178`). It drives no gate.

## 1.7 Move selection

**PROVEN.** Move choice is entirely the model's. Code validates the enum only (`parse.ts:499-500`) and logs it (`audit/log.ts:36-54`).

**PROVEN.** `moveJustPerformed` is consumed for exactly one decision: Lane B advancement (`move-based-advance.ts:76,171`).

**PROVEN.** Trigger→family practice rules exist only as prompt text (`journey-master.md:272-383`, `PRACTICE_GENERATION_ALGORITHM.md:140-179`). No code checks that the emitted `family` matches the clinical situation, or that any practice ran at all.

## 1.8 Rupture handling

**PROVEN.** `universal.rupture_receive` is a state-report label the model may emit (`stateReport/schema.ts`). **No code branches on it.** Rupture protocols (`journey-master.md:420-433`) are prompt text only.

**PROVEN.** `sessionRejectedModalities` is derived from the last 10 turns (`load.ts:463-467`) and rendered into the prompt (`assemble.ts:272-277`), but nothing enforces a modality switch. The schema comment at `schema.ts:96-98` promises code enforcement ("block repeated use of a rejected modality") — **this was never built**.

## 1.9 Surface response generation

**PROVEN.** One stateless streaming call per turn (`route.ts:399-404`), `max_tokens: 2500` (`route.ts:68`), model `claude-sonnet-4-6` (`model.ts:12`), no temperature set, **zero tool definitions anywhere** in `lib/journey` or `app/api/journey` — no planner, no agent loop, no second pass.

**PROVEN.** Reply and `<state-report>` share one output budget, reply first (`journey-master.md:609-614`, `:748`). Code strips `<assessment>`/`<thinking>` anywhere and hard-stops at `<state-report>` (`reply-processor.ts:236-253`).

**PROVEN — nothing inspects the reply for clinical content.** The only output-side gates are tag-stripping (`reply-processor.ts`) and instruction-leak shape matching (`leak-detector.ts:44-102`). A fluent, warm, clinically wrong reply passes untouched.

**PROVEN.** The Haiku verifier (`verifier.ts:382`) classifies the **user's** message and runs **after** the reply has streamed; the code annotates this itself as `_deliveredBeforeFreeze` (`route.ts:672-674`).

**PROVEN — no session record exists.** `StateSession` (`schema.prisma:1059`) and `ThemeSession` (`:1141`) exist for other products; the Journey has none. A "session" is a 4-hour timestamp gap recomputed every turn, with three uncoordinated copies of the constant (`load.ts:44`, `history.ts:128`, `signal.ts:30`). Session open/close is never recorded and `universal.session_open` is read by no code.

## 1.10 Golden Harness status

**PROVEN.** Not present on `main`. Located only on branch `claude/session-handoff-tester-audit-iqukf3` at `mindreset-app/eval/journey/`, in three commits (`2d60b57`, `03e8939`, `c472e42`). Never merged; never run against any merged change prior to this investigation.

**PROVEN — recorded mode is functional and was executed twice today.** It imports the production assembler, processor and parser directly. Live mode requires `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`; **no such credential exists in this environment**, so no live behavioural run has ever been performed.

---

# 2. FAILURE MAP

Harness figures below come from two executed recorded-mode runs scoring the 21 July production fixture and a 26 July fixture reconstructed from the owner's transcript plus inspector reports.

```
21 JULY  echo=0.011  stock=3  body-q=4  rep-q=1  anchor=5  practice=13(prem 3)  reportOK=1
26 JULY  echo=0      stock=1  body-q=0  rep-q=1  anchor=1  practice=2(prem 0)   reportOK=1
```

*Comparability caveat (**PROVEN**): the 26 July fixture omits user turns, so `echo` and `opensByRestating` are not comparable. `practice`, `body-q`, `anchor`, `stock` and `concessionOpening` derive from reply/report text and are comparable.*

### FAILURE 1 — Session does not close properly

- **Symptom:** at intensity 8 with `safetyFlag: watch`, the session ended on presence alone; no structured close.
- **Responsible layer:** absent architecture — there is no session object to close (`schema.prisma`, no Journey session model). Closure discipline is prompt-only (`journey-master.md:319-335`).
- **First commit:** not introduced by any commit. The Journey has never had a session record. **PROVEN.**
- **Evidence:** production inspector 2026-07-26 12:59:29 / 13:00:08 / 13:00:44; `load.ts:44`; absence of a session model.
- **Present on 21 July?** **YES — PROVEN.** Same architecture; identical `c26fb80` prompt.

### FAILURE 2 — The 1–10 stability check is not asked

- **Symptom:** the model emitted `stabilityCheck {score: 5}` then `{score: 4}` **without ever asking the user**. Its own `clinicalRead` records the decision: *"Do not ask the 1-10 question explicitly … read the departure as ~5-6, note it."* Both scores are below 6, which the prompt says forbids closing; it closed.
- **Responsible layer:** model adherence, plus absence of enforcement. The rule is explicit and present (`journey-master.md:319-325`, `:666`).
- **First commit:** no commit introduced it. The rule has never been code-enforced; `stabilityCheck` is parsed (`parse.ts:331-346`) and read **only** by the admin inspector (`journey-inspect/page.tsx:383,514`). **PROVEN.**
- **Corroborating machine-detectable defect (PROVEN):** across the three closing turns, the `stabilityCheck` object and the `universal.stability_check` move never co-occur — 12:59:29 object without move; 13:00:08 move without object; 13:00:44 object without move.
- **Consequence (PROVEN):** the scores 5 and 4 in the clinical record were generated by the model, not reported by the user.
- **Present on 21 July?** **UNKNOWN.** The 21 July session did not reach a comparable overwhelm-close, so the protocol was not exercised. No evidence either way.

### FAILURE 3 — No stabilisation effort; breath only

- **Symptom:** two practices offered, both `regulation` family (breath). After the user said *«Я сделала выдохи, но мне не помогает»* — the exact Alternative-Rule trigger — the reply was *«Дышать как получается»*: still breath. No `modalitySwitched` emitted.
- **Aggravating clinical detail (PROVEN):** the user reported *«трудно дышать»*. The prompt's own hierarchy (`journey-master.md:288`) directs choosing *"by what the body is doing"*; with a breathing complaint, breath-focus is the contraindicated branch.
- **Responsible layer:** model adherence plus absence of enforcement. The five families and the Alternative Rule are present (`journey-master.md:378`, `:669`).
- **First commit:** no commit removed the rule; **PROVEN** it is present verbatim in `c26fb80` and in current `main` (identical files).
- **Evidence:** harness — practice families 3 → 1; **body-oriented questions 4 → 0**; anchor invocations 5 → 1.
- **Present on 21 July?** **NO — PROVEN otherwise.** 21 July used `universal.practice_somatic` ×5 and landscape work; 13 of 25 turns carried a practice.

### FAILURE 4 — Immediate conclusions after every piece of information

- **Symptom:** six distinct "root" declarations in one session, each naming a different root; several rejected by the user outright (*«Нет, ты ошибаешься»*).
- **Responsible layer:** model behaviour, against an explicit universal prohibition. **PROVEN:** `00-shared-core.md:96` — *"No analysis of the psyche spoken aloud to the user"* — listed under "every turn, every stage, no exceptions".
- **First commit:** **UNKNOWN.** No commit removed the prohibition; it is present in both `c26fb80` and current `main`.
- **Structural contributor (PROVEN):** the model is required to write a conclusion every turn (`clinicalRead`, `journey-master.md:623-626` + `emission-reminder.ts:25`), the result is stored and re-injected every turn (`assemble.ts:410-439`), and the prompt forbids deleting from it (`:741`). No schema field exists for observation, uncertainty, or a decision to withhold.
- **Present on 21 July?** **NO — STRONGLY SUPPORTED.** 21 July `clinicalRead` entries are procedural and restraint-oriented (verbatim: *"Anchor material consolidating … Hold here, do not advance to analysis. Let the body remember."*), against interpretive verdicts now. Same field, same average length (413 chars), different register. This is a qualitative reading of 25+25 records, not an executed measurement.

### FAILURE 5 — Circling / repeated questions

- **Symptom:** the user stated it directly — *«Мы ходим с тобой по кругу»*.
- **Evidence:** harness `rep-q` = 1 in **both** sessions. **The mechanical repeated-question metric does not distinguish them.**
- **Responsible layer:** **HYPOTHESIS** — the perceived circling is the interpretation loop of Failure 4 (new root each turn, none landing), not literal question repetition.
- **Present on 21 July?** **UNKNOWN** by this metric; the metric is equal in both.

### FAILURE 6 — Stage permanently stuck at 2

- **Symptom:** all 25 turns `stage 2 / surface`; `adultSelfQualities` never set.
- **Responsible layer:** gate/prompt vocabulary mismatch (§1.3).
- **First commit:** `#178` (2026-06-28) introduced the requirement; `#197` (2026-07-01) removed the tokens and the contract test. **PROVEN.**
- **Evidence:** executed gate probe (§1.3).
- **Present on 21 July?** **YES — PROVEN.** The seal predates the good session.
- **Impact assessment — CORRECTION TO EARLIER AUDIT (PROVEN):** the seal does **not** restrict the model's clinical repertoire. `assemble.ts:479` tells the model stage numbers are not capability gates, all 8 playbooks load every turn, and the 21 July good session performed `stage_5.origin_voice_mapping` ×5, `stage_5.symbolic_return` ×5 and `stage_4.first_contact` ×2 while labelled Stage 1–2. The seal breaks progression bookkeeping and blocks discharge; it did not cause the degraded behaviour.

### FAILURE 7 — Latent: fabricated clinical data on report truncation

- **Symptom:** not observed in the tester's records.
- **Mechanism (PROVEN in code):** reply and report share one 2,500-token budget, reply first, so the report is the structural loser. A report truncated before its closing tag yields `null` (`parse.ts:147-151`), and `parseStateReport(null)` returns `{intensity: 5, safetyFlag: 'watch', recommendedAction: 'stay'}` (`parse.ts:91-95`). That value is written as clinical fact into `RecodeProgress` (`save.ts:44,112-115`) and the audit row (`audit/log.ts:26-31`). `safetyFlag: 'watch'` then fails `safetyNoneForLast` (`history.ts:105-109`), silently blocking advancement. Nothing distinguishes a parser failure from a real reading except a console line (`route.ts:556-572`).
- **Risk amplifier (PROVEN):** `continuityNote` is uncapped inbound and the prompt mandates additive growth, so probability rises monotonically with account age.
- **Did it fire on this user?** **NO — PROVEN.** Her inspector reports are rich and well-formed; they parsed successfully.
- **Present on 21 July?** **YES — PROVEN.** Same code (`parse.ts` is comment-only different).

### Additional defects recorded (not owner-observed)

| Ref | Defect | Label |
|---|---|---|
| D1 | `modelOverride` is unvalidated, client-supplied, and reaches the API on the owner's key (`route.ts:105` → `:361` → `model.ts:20`). Real client never sends it. | **PROVEN** |
| D2 | Live stream is not leak-gated; `detectLeak` runs only at persist (`route.ts:593`) and history-load (`:379`). User reads leaked text; reload shows a placeholder. | **PROVEN** |
| D3 | Partial `<state-report` tag can reach screen and database — the 14-char lookahead guard is flushed unconditionally at stream end (`reply-processor.ts:255-264` vs `:291`). Agent probe reproduced it. | **PROVEN** |
| D4 | Marker matching is exact-literal (`reply-processor.ts:44`, `parse.ts:35-36`); `<state-report >` or `<State-Report>` would stream the full internal JSON to the user. | **PROVEN** |
| D5 | Unclosed private tag ⇒ entire reply silently dropped, no error frame (`reply-processor.ts:283`). | **PROVEN** |
| D6 | Emission reminder is injected into the **user** message and is invisible to the leak detector (hyphen in `system-note` defeats the regex, `leak-detector.ts:63`). | **PROVEN** |
| D7 | `finaliseTurn` has no top-level try/catch (`route.ts:509-701`); a throw skips the audit row, corrupting session derivation and gate windows. | **PROVEN** |
| D8 | `journeyTurn.findMany` with no `take` on every turn (`load.ts:213-217`) — grows linearly forever. | **PROVEN** |
| D9 | `currentDepth` is dead state — `recommendedDepth` declared and read, never assigned; rendered to the model as fact (`assemble.ts:201`). | **PROVEN** |
| D10 | Lane B can reach Stage 8 discharge without any MII gate completion (`move-based-advance.ts:29-32`). | **PROVEN** |
| D11 | No code-side regression floor at any intensity; `regress_to_*` fires only if the model emits it (`router.ts:80-91`). | **PROVEN** |
| D12 | "Adult Self required for parts/deep work" is prompt-only; `adultSelfPresent` is read only by advancement gates, never to gate a turn. | **PROVEN** |

---

# 3. REGRESSION TIMELINE

Every commit from `c26fb80` (exclusive) to `7ef46ca` (inclusive), with the behavioural mechanism each changed.

| # | Commit | Date | Behavioural mechanism changed | Label |
|---|---|---|---|---|
| 1 | `b984a5c` #340 A0 | 07-22 06:37 | **None to the production path.** Removed dead `assembleSystemPrompt` wrapper, `STATE_REPORT_FORMAT_INSTRUCTION`, `DIVIDER`, `loadStageSpec`, `loadEngineeredStagePrompt`, and the unloaded files `runtime/stage-01.md` / `stage-02.md`. Removed `'manual'` from the `FreezeSource` union. `parse.ts` / `schema.ts` / `emission-reminder.ts` comment-only. Production entry `assembleSystemPromptBlocks` untouched; assembled output byte-identical. | **PROVEN** |
| 2 | `164f795` #341 B1a | 07-22 11:02 | `01-stage-stabilisation.md` — anchor naming/capture claims rewritten. Prompt text the model reads. | **PROVEN** |
| 3 | `032670b` #342 B1b-S2 | 07-22 11:36 | `02-stage-pain.md` — removed automatic Stage-1 anchor recall / soothe / closure passages. | **PROVEN** |
| 4 | `3fa6b06` #343 B1b-S3 | 07-22 12:07 | `03-stage-adult-self.md` — same removal, Stage 3. | **PROVEN** |
| 5 | `8aeb476` #344 B2a | 07-22 20:44 | `runtime/journey-master.md` — removed three "stock wrapper" passages from worked examples (few-shot exemplars). | **PROVEN** |
| 6 | `034fab2` #345 B1b-S4 | 07-22 21:15 | `04-stage-parts.md` — same removal, Stage 4. | **PROVEN** |
| 7 | `3b34828` #346 | 07-22 21:35 | `04-stage-parts.md` — de-anchored three worked examples. | **PROVEN** |
| 8 | `ecf207b` #347 B1b-S5 | 07-22 22:05 | `05-stage-foreign-material.md` — same removal, Stage 5. | **PROVEN** |
| 9 | `43bad50` #348 | 07-24 12:02 | Billing only — per-user monthly cap override. No clinical surface. | **PROVEN** |
| 10 | `316ca4b` #349 | 07-24 16:48 | Billing only — structured cap metadata; `route.ts` 429 payload shape. No clinical surface. | **PROVEN** |
| 11 | `0c7969d` #350 | 07-25 11:24 | Client error UX only (`JourneyClient.tsx`, `turn-error.ts`). No prompt, no gate. | **PROVEN** |
| 12 | `31fd251` #351 | 07-25 12:00 | Admin telemetry page only. No Journey runtime surface. | **PROVEN** |
| 13 | `c578c4b` #354 Unit 1 | 07-25 15:20 | `00-shared-core.md` — §6 Personal Anchor rewritten as identity intervention; §3 `anchor-supported` → `regulation-supported`. Prompt text. | **PROVEN** |
| 14 | `7ef46ca` #355 restore | 07-26 10:57 | Reverted commits 2–8 and 13 in effect: 7 loaded prompt files returned byte-identical to `c26fb80`. No code touched. | **PROVEN** |

**Degradation window (STRONGLY SUPPORTED):** commits 2–8 and 13 — the only changes to text the model reads between the known-good 21 July session and the degraded 24–26 July sessions. Commits 1 and 9–12 changed no clinical surface.

**Note on causality (HYPOTHESIS):** that these prompt removals *caused* the measured behavioural collapse is consistent with the timeline and with the measured drop in practice families and body-oriented questions, but has never been demonstrated by a controlled before/after run. See §6.

---

# 4. GOOD VS CURRENT — file-by-file and mechanism-by-mechanism

PR #355 is **merged**; current `main` therefore already contains the restore.

## 4.1 Prompt surface (files loaded by `load-spec.ts`)

| File | `c26fb80` | current `main` | Effect of #355 |
|---|---|---|---|
| `00-shared-core.md` | baseline | **identical** | reverted #354 |
| `01-stage-stabilisation.md` | baseline | **identical** | reverted #341 |
| `02-stage-pain.md` | baseline | **identical** | reverted #342 |
| `03-stage-adult-self.md` | baseline | **identical** | reverted #343 |
| `04-stage-parts.md` | baseline | **identical** | reverted #345, #346 |
| `05-stage-foreign-material.md` | baseline | **identical** | reverted #347 |
| `06`, `07`, `08` stage specs | baseline | **identical** | never modified |
| `PRACTICE_GENERATION_ALGORITHM.md` | baseline | **identical** | never modified |
| `runtime/journey-master.md` | baseline | **identical** | reverted #344 |

**PROVEN.** `git diff c26fb80 origin/main -- docs/journey/` reports changes to **only** `runtime/stage-01.md` and `runtime/stage-02.md` (deleted). Every loaded file is identical.

## 4.2 Files present in one and not the other

| File | `c26fb80` | `main` | Loaded at runtime? |
|---|---|---|---|
| `runtime/stage-01.md` | present | **deleted** | **No** — `load-spec.ts` never reads it |
| `runtime/stage-02.md` | present | **deleted** | **No** — same |

**PROVEN.** `load-spec.ts:35-55,100` reads only `00-shared-core.md`, `PRACTICE_GENERATION_ALGORITHM.md`, `01`–`08`, and `runtime/journey-master.md`. The deleted files were unreachable Generation-B artefacts. **Their deletion changed no prompt.**

**Forensically significant (PROVEN):** `runtime/stage-02.md:366-370` was the only place the tokens `soft_why_asked` / `soft_why_answered` were ever defined. Because the file was never loaded, those tokens were never available to the live model — the Stage 2 seal was already in force before deletion.

## 4.3 Runtime code

| Mechanism | `c26fb80` | current `main` |
|---|---|---|
| `assembleSystemPromptBlocks` (production) | present | **unchanged** |
| Assembled prompt output | 4 blocks / 337,831 chars | **byte-identical (verified by execution)** |
| `assembleSystemPrompt` (dead wrapper) | present | removed |
| `loadStageSpec`, `loadEngineeredStagePrompt` | present, unused | removed |
| `parse.ts` behaviour | baseline | **identical** (0 non-comment lines) |
| `schema.ts` behaviour | baseline | **identical** (0 non-comment lines) |
| `emission-reminder.ts` behaviour | baseline | **identical** (0 non-comment lines) |
| Stage gates / router / move lane | baseline | **untouched by every commit in this window** |
| `FreezeSource` union | includes `'manual'` | `'manual'` removed (no writer existed) |
| Monthly-cap 429 payload | flat `{error, capUsd, spentUsd}` | structured payload |
| `MAX_TOKENS`, model, temperature | 2500 / `claude-sonnet-4-6` / unset | **identical** |
| `HISTORY_LIMIT` | 30 | **identical** |

## 4.4 Mechanism-level verdict

**PROVEN.** With respect to everything the model reads and everything that governs a clinical turn, `main` and `c26fb80` are now equivalent. The differences that remain are: two deleted unreachable files, dead-code removal, a billing payload shape, an admin page, and client-side error rendering.

---

# 5. REVERSAL PLAN

## 5.1 What PR #355 restores — **PROVEN**

- The seven loaded prompt files, byte-identical to `c26fb80` (residual diff: 0 lines).
- Therefore: the removed anchor recall / soothe / closure passages in Stages 2–5; the three master-prompt worked-example wrappers; the de-anchored Stage 4 examples; the Stage 1 anchor claims; and §6 / §3 of Shared Core.
- Verified by executing the assembler in both trees: identical block count, sizes and hashes.

## 5.2 What PR #355 does **not** restore — **PROVEN**

- **Nothing in code.** A0's dead-path removal, the `'manual'` freeze source, the cap/telemetry/error-UX work all remain.
- **`runtime/stage-01.md` / `stage-02.md` remain deleted.** Restoring them would change no prompt (never loaded) but would return the only historical definition of the `soft_why` tokens to the repository.
- **No accumulated user state.** `continuityNote`, `patterns`, `taskContract`, `anchorText`, stage pointer and audit history are database rows, untouched by any commit.
- **No behavioural verification.** #355 was verified structurally (byte identity, 863 tests). Per this report's standing caveat, that is not evidence of behavioural correctness.

## 5.3 Known defects that remain after the restore

| Ref | Defect | Label |
|---|---|---|
| R1 | Stage 2 gate unpassable (`soft_why` token absent from the live vocabulary) | **PROVEN** |
| R2 | No session record; closure and the 1–10 discipline are unenforceable by construction | **PROVEN** |
| R3 | `stabilityCheck` parsed but consumed by no decision | **PROVEN** |
| R4 | Adult-Self precondition for deep work is prompt-only | **PROVEN** |
| R5 | `continuityNote` uncapped inbound; additive-growth instruction; latent report-destruction path (Failure 7) | **PROVEN** |
| R6 | `patterns` never aged or deactivated | **PROVEN** |
| R7 | No code-side regression floor at any intensity | **PROVEN** |
| R8 | No clinical inspection of the outgoing reply | **PROVEN** |
| R9 | Safety verifier is one turn late by design | **PROVEN** |
| R10 | D1–D10 from §2 (modelOverride, live-stream leak gate, partial tag, exact-literal markers, dropped replies, emission-reminder placement, missing try/catch, unbounded query, dead `currentDepth`, Lane-B discharge) | **PROVEN** |
| R11 | Golden Harness absent from `main`; no live behavioural baseline has ever been recorded | **PROVEN** |

## 5.4 What must not be changed

Stated as forensic constraints, not recommendations.

1. **The seven restored prompt files must remain byte-identical to `c26fb80`** until a live behavioural baseline exists. Any edit destroys the only fixed reference point the system currently has.
2. **`MAX_TOKENS`, model id, temperature, `HISTORY_LIMIT`** — unchanged since the good session; altering any of them would confound every future comparison.
3. **The Golden Harness fixture `julia-2026-07-21.json`** — it is the sole recording of the known-good runtime and is not reproducible.
4. **The tester's accumulated database state** must not be edited or reset before it is exported; it is the only evidence of the drifted-memory condition.
5. **`c26fb80` and `7ef46ca` must remain reachable refs** (no history rewrite, no branch deletion).

## 5.5 Safest sequence for returning to a verified baseline

Ordering only. No step is proposed for execution here.

1. **Freeze.** No prompt, gate, or runtime change. Current `main` is the reference candidate.
2. **Preserve evidence.** Export the tester's `RecodeProgress`, `JourneyTurn`, `JourneyPattern` rows and the current `continuityNote` before any state is touched.
3. **Establish a live baseline.** Merge the harness read-only and run `julia-2026-07-21` live against `claude-sonnet-4-6` with the current `main` prompt, in an environment holding a real API key. This is the **only** step that can separate the three competing explanations in §6. Until it exists, no conclusion about "restored to good" can be verified.
4. **Compare** the live run against the 21 July recorded baseline on the nine mechanical metrics. This yields a verified statement about whether current `main` reproduces the good runtime.
5. **Only then** decide, on evidence, between: accepting `main` as the baseline; investigating accumulated-state reset; or treating the change as external (model drift).
6. **Establish regression protection** before any further prompt or gate change — the class of defect in R1 (a gate testing a vocabulary the prompt cannot emit) was previously caught by a contract test that was deleted in the same commit that reverted its fix.

---

# 6. UNRESOLVED QUESTIONS

Things the repository history and available records **cannot** prove.

| # | Question | Label | Why it cannot be resolved from the repo |
|---|---|---|---|
| Q1 | Did the prompt removals (#341–#347, #354) *cause* the behavioural degradation? | **UNKNOWN** | No controlled before/after run exists. The timeline is consistent, but the same window contains a changed user state and a possible model change. Correlation only. |
| Q2 | Has `claude-sonnet-4-6` itself changed between 21 and 26 July? | **UNKNOWN** | The model identifier is identical in the fixture and today. Server-side model updates are not observable from the repository. |
| Q3 | How much of the collapse is explained by the tester's own changed conduct? | **UNKNOWN** | She was markedly more activated in the recent sessions and rejected practices explicitly (*«это тупое… какая-то практика»*, *«оставь девочку»*). A model told its practices are stupid will offer fewer. Not separable from records. |
| Q4 | Has the accumulated `continuityNote` / `patterns` dossier changed the model's register? | **HYPOTHESIS** | The feedback loop is **PROVEN** to exist (`assemble.ts:365-400,410-439`); that it *caused* the interpretive drift is not demonstrated. |
| Q5 | Was the internal analytic layer "clever then, degraded now"? | **STRONGLY SUPPORTED, not proven** | `clinicalRead` is present on 25/25 turns in both, average length ~413 chars in the good session. The difference is register — procedural direction vs interpretive verdict — assessed qualitatively, not measured. |
| Q6 | Did Failure 7 (report truncation → fabricated `intensity 5 / watch`) ever fire for any user? | **UNKNOWN** | Not for this tester (**PROVEN** — her reports parsed). Detecting historical occurrences requires querying production `JourneyTurn` rows for the defensive-default signature; not possible from this environment. |
| Q7 | Was Failure 2 (unasked 1–10) present on 21 July? | **UNKNOWN** | The good session never reached a comparable overwhelm-close, so the protocol was never exercised. |
| Q8 | What is production actually serving right now? | **UNKNOWN** | Vercel deployment state, environment variables, and live logs are not readable from this environment. `main` is known; what is deployed is not verified. |
| Q9 | Does any user besides the tester show the same profile? | **UNKNOWN** | Requires production database access. |
| Q10 | Why did the emergency revert `#197` (2026-07-01) also delete `stage2-vocab-contract.test.ts`? | **UNKNOWN** | The commit reverted the master prompt wholesale; whether the test deletion was intended or collateral is not recorded in the message or the diff rationale. |
| Q11 | Is the 26 July fixture faithful enough for the metric comparison? | **PARTIAL** | Replies are verbatim from the owner's transcript and `practiceRun` presence is from the inspector, so `practice`, `body-q`, `anchor`, `stock`, `concessionOpening` are sound. User turns were omitted, so `echo` and `opensByRestating` are **not comparable**. |

## Explicit negative result

**PROVEN.** `concessionOpening` — the harness's mechanical proxy for *"the AI follows the user rather than leading"* — measured **12% on 21 July and 4% on 26 July**. It moved in the opposite direction to the hypothesis. That framing of the complaint is not supported by measurement and is recorded here as a failed hypothesis.

## Corrections to earlier audits issued in this investigation

1. **PROVEN correction.** The Stage 2 seal does **not** cause the narrowed clinical repertoire. Stage numbers are explicitly not capability gates (`assemble.ts:479`), all 8 playbooks load every turn, and the good 21 July session performed Stage 4 and Stage 5 moves while labelled Stage 1–2.
2. **PROVEN correction.** Out-of-stage parts work is by design, not drift. The good session shows the same pattern. The narrower finding stands: the Adult-Self precondition is prompt-only with no code enforcement.

---

*End of report. No fix is proposed or implemented in this document.*
