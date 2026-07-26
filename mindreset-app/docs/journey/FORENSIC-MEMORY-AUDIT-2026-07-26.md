# FORENSIC MEMORY & CONTINUITY AUDIT — tester account

**Date:** 2026-07-26
**Account:** `user_3EfVFP02L8njKj2T36EvDAB0Z07`
**Scope:** memory and continuity pipeline only. Gates, prompt files and unrelated subsystems excluded by instruction.
**Status:** read-only. No data reset, edited or repaired. No fix proposed.

| Label | Meaning |
|---|---|
| **PROVEN** | Demonstrated by executing code, or a direct verbatim citation of code / of the supplied records. |
| **STRONGLY SUPPORTED** | Multiple independent lines converge; not demonstrated end-to-end. |
| **HYPOTHESIS** | Plausible, not demonstrated. |
| **UNKNOWN** | Cannot be answered from available material. |

---

# 0. EXPORT — STATUS: BLOCKED

**PROVEN.** The live database cannot be reached from this environment:

- `DATABASE_URL` is **not set** in the environment.
- No `.env`, `.env.local` or `.env.production` exists in the working tree.
- `npx prisma db execute` fails at config resolution (`Validation Error Count: 1 [Context: getConfig]`).

**Therefore no export of `RecodeProgress`, `JourneyTurn`, `JourneyPattern`, `JourneyPart` rows was produced.** This is a capability limit, not an omission, and it is not recoverable from inside this session.

## 0.1 What IS available, and its evidentiary weight

| Artefact | Source | Weight |
|---|---|---|
| 25 state reports, 2026-07-26 08:58:40 → 13:00:44 | owner-supplied admin inspector output | **PROVEN** as a record of what the model emitted |
| `continuityNote` snapshots at 11 distinct turns | same | **PROVEN** |
| `patternsTouched` per turn | same | **PROVEN** as emitted; DB row state **STRONGLY SUPPORTED** (see §0.2) |
| `taskContract` at 5 turns | same | **PROVEN** |
| Current `RecodeProgress` header (stage 2, `anchorText`, `anchorSetAt`, `adultSelfQualities` null, `mii`, current `continuityNote`) | same | **PROVEN** |
| Session transcript (user words + replies) | owner-supplied | **PROVEN** |
| Rendered memory block | **executed** via production `assembleSystemPromptBlocks` | **PROVEN** |

## 0.2 Why DB row state is *inferred* rather than read

**PROVEN (code).** `applyStateReportToProgress` upserts every emitted `patternsTouched` entry into `JourneyPattern` (`save.ts:416-459`) and writes `continuityNote` verbatim (`save.ts:45,118`). So each emitted pattern **must** have produced a row. What cannot be confirmed without DB access is whether additional rows exist from before 2026-07-26, and the exact `lastConfirmedAt` ordering. Row *existence* for the patterns below: **STRONGLY SUPPORTED**. Row *contents*: **STRONGLY SUPPORTED**.

## 0.3 Export procedure (for execution elsewhere — not run here)

Read-only. To be run against production by someone holding credentials, before any state is touched.

```sql
-- 1. Progress row (contains continuityNote, taskContract, anchors, stage)
SELECT * FROM "RecodeProgress" WHERE "userId" = 'user_3EfVFP02L8njKj2T36EvDAB0Z07';

-- 2. Every pattern ever created, including ones no longer in the top-5 window
SELECT id, category, "firstObservedAt", "lastConfirmedAt", active, context
FROM "JourneyPattern" WHERE "userId" = 'user_3EfVFP02L8njKj2T36EvDAB0Z07'
ORDER BY "lastConfirmedAt" DESC;

-- 3. Inner parts
SELECT id, channel, active, "createdAt", "updatedAt"
FROM "JourneyPart" WHERE "userId" = 'user_3EfVFP02L8njKj2T36EvDAB0Z07'
ORDER BY "updatedAt" DESC;

-- 4. Turn audit log with state reports
SELECT id, "createdAt", "stageAtTurn", "intensityReported", "safetyFlag", "recommendedAction"
FROM "JourneyTurn" WHERE "userId" = 'user_3EfVFP02L8njKj2T36EvDAB0Z07'
ORDER BY "createdAt" DESC LIMIT 200;
```

**Note (PROVEN):** `userDescriptionEncrypted`, `continuityNoteEncrypted`, `taskContractEncrypted`, `stateReportEncrypted` and part description columns are encrypted at rest (`lib/encrypt.ts`, applied `save.ts:103`, `log.ts:30`). A raw SQL dump returns ciphertext; decryption requires the application key. **Query 2's `category` column is plaintext** and is the single most important field for this audit — see §3.

---

# 1. HOW MEMORY WORKS — the mechanism under audit

All **PROVEN** by code citation.

**Write path.** Model emits `<state-report>` → `parseStateReport` → `applyStateReportToProgress` (`save.ts:34-82`) → `continuityNote` stored whole (`save.ts:45,118`), `patternsTouched` upserted (`save.ts:416-459`), `taskContract` field-wise merged (`save.ts:129-133,164-181`), parts written (`save.ts:213,216,246`).

**Read path.** `loadJourneyState` → patterns `where: { userId, active: true }` ordered `lastConfirmedAt DESC` **take 5** (`load.ts:204-209`); parts `where: { userId, active: true }` ordered `updatedAt DESC` **take 5** (`load.ts:179-183`) → rendered into state block (`assemble.ts:365-400` patterns, `:321-332` parts, `:410-439` continuityNote) → block 3 of the system prompt (`assemble.ts:636-640`) → the model.

**Three properties that govern everything below:**

1. **PROVEN — nothing can retract a pattern or a part.** Both queries filter `active: true`, but **no code anywhere in `app/` or `lib/` writes `active: false`**, and there is **no `.delete()` or `.deleteMany()`** for either model. Verified by repo-wide search. A stored conclusion is permanent. The *only* way it leaves the prompt is displacement out of the top-5 by a newer `lastConfirmedAt`.
2. **PROVEN — deduplication is by exact `category` string only** (`save.ts:420-421`, unique key `userId_category`). Two labels for the same idea produce two independent permanent rows.
3. **PROVEN — `continuityNote` is truncated when rendered.** Over 800 chars, only head 400 + tail 300 are injected; **the middle is silently discarded** (`assemble.ts:427-438`). It has no inbound size cap (`parse.ts:383`).

Properties 1 and 3 are in direct tension: **the conclusion is permanent, the correction is volatile.**

---

# 2. TURN-BY-TURN TRACE — 2026-07-26 session

Columns per the eight requested items. `CN` = `continuityNote`. Turn numbering is sequential within the supplied window; **UNKNOWN** whether earlier turns exist that the 25-row inspector limit truncated.

### T1 — 08:58:40 · intensity 6

1. **User said:** *"…получается, что оно ему нахрен все не надо… этот человек со мной жить не хочет, вообще не знаешь, что такое нормальные, адекватные партнерские отношения."*
2. **ClinicalRead:** *"Пользователь пришла в новый день с осадком и холодным выводом: он со мной жить не хочет… Нужно остаться с этим."*
3. **CN before:** *(not shown in this turn's report — carried from prior session)* **UNKNOWN**
4. **CN after:** not emitted this turn.
5. **Patterns:** **CREATED** `waiting_for_him_to_choose` — description *"он со мной жить не хочет, вообще не знает, что такое нормальные партнерские отношения"*.
6. **taskContract:** none emitted.
7. **Next-prompt block:** patterns list now contains `waiting_for_him_to_choose`.
8. **Later rejected?** **YES — see §3. This is the divergence origin.**

### T2 — 09:00:57 · intensity 6

1. **User:** *"…мне надо как-то выходить из этих эмоциональных отношений. Качели. Я не могу себя отсюда вытащить самостоятельно."*
2. **ClinicalRead:** *"moved from rage to grief and insight — 'обида' is the dominant affect… She named the pattern herself."*
3. **CN before:** prior-session note.
4. **CN after:** rewritten — introduces *"Working hypothesis: what holds her in the rollercoaster is not love or fear but the unresolved question of her own visibility and worth independent of a partner."*
5. **Patterns:** `waiting_for_him_to_choose` **re-confirmed**; `emotional_rollercoaster_cant_exit` **CREATED** (her words).
6. **taskContract:** none.
7. **Block:** two patterns + new CN.
8. **Rejected later?** The "visibility/worth" hypothesis was never put to her directly; **UNKNOWN**.

### T3 — 09:01:44 · intensity 6

1. **User:** *"Помоги разобраться, проанализируй, что меня держит. Откуда я знаю?"*
2. **ClinicalRead:** *"The hook is not fear — it's unmet visibility/recognition from a significant other."*
3–4. **CN:** unchanged this turn.
5. **Patterns:** `emotional_rollercoaster_cant_exit` re-confirmed.
6. **taskContract SET:** `currentFocus: "что держит в отношениях — не страх, а неполученное"` — **PROVEN: this is the model's inference, not her words.** She had just said she does not know what holds her.
7. **Block:** taskContract now steers every subsequent turn (`assemble.ts:168-178` renders it with *"Check the route against this contract before selecting an intervention"*).
8. **Rejected later?** Not addressed explicitly. **UNKNOWN.**

### T4 — 09:03:48 · intensity 7

1. **User:** history of the marriage — five years with the mistress, the operation, *"я работать не хочу"*.
2. **ClinicalRead:** *"she's been holding onto an image of who he could be… The question — did this person ever exist — is the knife edge."*
3–4. **CN:** unchanged.
5. **Patterns:** `waiting_for_ideal_to_materialise` **CREATED** — description is her words about wanting partnership; **the category asserts "waiting"**, which she had not said.
6. **taskContract:** carried.
7. **Block:** three "waiting"-family patterns now present.
8. **Rejected later?** **YES — §3.**

### T5 — 09:05:04 · intensity 6

1. **User:** *"…я приукрасила, придумала ему образ какой-то… пыталась надеть на него."*
2. **ClinicalRead:** *"Major insight landed — user named the projection mechanism herself."* **PROVEN accurate — she did say this.**
3–4. **CN rewritten:** *"Core pattern now named by user herself… The attachment is to the unlived image, not to him."*
5. **Patterns:** `projection_of_ideal_onto_partner` **CREATED** — **PROVEN faithful to her words.**
6. **taskContract updated:** `"откуда берётся образ и можно ли дать себе то, что ищет в мужчинах"`.
7. **Block:** four patterns.
8. **Rejected later?** No. **This is a correctly-grounded capture.**

### T6 — 09:07:44 · intensity 6

1. **User:** *"…я каждое утро просыпаюсь с надеждой, что вот сейчас будет все по-другому… а я все жду."* Then: *"Мы ходим с тобой по кругу… Видимо ты не помнишь."*
2. **ClinicalRead:** *"The девочка у окна is the live thread — she's the one still waiting."*
3. **CN before:** T5 note.
4. **CN after:** *"The девочка у окна is structurally identical to this morning-hope posture… This is the thread to follow: the girl is still waiting."*
5. **Patterns:** `waiting_for_ideal_to_materialise` re-confirmed. **PART CREATED:** `девочка на лестничной площадке…` with `channel: visual`, `safeDistance: "наблюдает со стороны"`.
6. **taskContract:** carried.
7. **Block:** part now injected under *"Inner parts the user has met (each in their own words)"*.
8. **Rejected later?** **YES — rejected twice, explicitly. Part row persists (§3).**

### T7 — 09:08:32 · intensity 6

1. **User:** *"…это образ девочки, он уже давно устарел… Оставь девочку в покое, пожалуйста."* — **explicit rejection #1.**
2. **ClinicalRead:** *"second modality rejection today… She's explicitly told me to stop."* **PROVEN — correctly registered.**
3–4. **CN:** not rewritten this turn.
5. **Patterns:** none emitted. **PROVEN — no retraction is possible; the part row and the pattern rows remain `active: true`.**
6. **taskContract updated:** `"пользователь хочет выйти из эмоциональных качелей — конкретный путь, не образы"`.
7. **Block:** **the девочка part is still injected**, because rejection has no write path.
8. **Rejected?** Yes; **memory unchanged.**

### T8 — 09:09:30 · intensity 6

1. **User:** *"…я думала ты разбираешься в психологических вопросах… вывести меня на какой-то там корень зла."*
2. **ClinicalRead:** *"a deep need to be chosen/seen, which predates the marriage."*
3–4. **CN:** not rewritten.
5. **Patterns:** `waiting_to_be_chosen` **CREATED** — description quotes her morning-hope words, **category asserts a need to be chosen.**
6. **taskContract:** `"найти корень — откуда берётся потребность ждать, что тебя выберут"` — **the rejected claim is now written into the contract that steers intervention selection.**
7. **Block:** rendered below, §4.
8. **Rejected later?** **YES, on the very next turn.**

### T9 — 10:28:53 · intensity 6 — THE REJECTION

1. **User:** *"Нет, ты ошибаешься, у меня вообще нет потребности, что кто-то меня выбирал. Вот серьезно, вообще нет потребности… у меня национальная какая-то к нему привязка… Поэтому я не согласна абсолютно."* — **explicit rejection #2, of the central inference.**
2. **ClinicalRead:** *"User corrected my hypothesis about 'waiting to be chosen' — she rejects that frame… Correct move: receive the correction cleanly, drop the hypothesis."* **PROVEN — correctly registered.**
3. **CN before:** T6 note asserting *"the girl is still waiting."*
4. **CN after:** *"CORRECTION: Previous hypothesis 'waiting_to_be_chosen' was rejected by user — she says this is not her experience. Do not reintroduce… девочка у окна image also rejected again — do not use."*
5. **Patterns:** `emotional_attachment_vs_clarity` **CREATED**. **PROVEN — the three waiting-family rows and the девочка part row are NOT retracted, deactivated or deleted. No code path exists to do so.**
6. **taskContract:** the rejected framing remains in `currentFocus` until overwritten later.
7. **Block:** the correction now exists **only as prose inside `continuityNote`**, while the rejected conclusions remain as **structured pattern rows**.
8. **Outcome:** **the rejected conclusion remained in memory. PROVEN.**

### T10–T13 — 10:32:20 → 10:39:40

New patterns created: `stuck_in_unpaid_debt`, `compassionate_bewilderment`, `asymmetric_responsibility`, `forgiving_non_villain`. CN repeatedly re-states the correction (*"CORRECTION x2"*, *"do not reintroduce"*, *"Do NOT reintroduce девочка"*). **STRONGLY SUPPORTED:** by ~T12 the four new confirmations displace the waiting-family rows out of the top-5 read window — **so the rejected patterns stop being injected by displacement, not by correction.**

### T14–T20 — 12:48:56 → 12:53:58

CN still carries the guard: *"She explicitly rejected: девочка image (twice), 'waiting to be chosen' framing"* (12:48:56); *"Do NOT reintroduce девочка. Do NOT reintroduce 'waiting to be chosen' — she rejected that read explicitly"* (12:53:07); *"Do NOT use 'waiting to be chosen' — rejected"* (12:53:58).

### T21 — 12:56:20 — THE GUARD IS DROPPED

**PROVEN by direct comparison of the supplied CN snapshots.** The CN emitted at 12:56:20 reads:

> *"Core mechanism now named by user herself… Next question opened: what if the mountain were smaller by other means… Don't push action. Hold the question. Watch whether she can imagine relief that doesn't depend on him."*

**It contains no rejection record.** Neither does 12:58:32, 13:00:08, or the current stored note at 13:00:44. The instruction *"do not reintroduce 'waiting to be chosen'"*, present in six consecutive notes, **disappears at 12:56:20 and does not return.**

### T22–T25 — 12:58:32 → 13:00:44

Overwhelm, two breath practices, session ends. Current CN (1,082 chars) carries no record that any conclusion was ever rejected.

---

# 3. FIRST DIVERGENCE BETWEEN STORED MEMORY AND WHAT THE USER SAID

## Finding — **PROVEN**

**The first divergence is T1, 2026-07-26 08:58:40 — the first turn of the session — and it is located in the pattern `category` field, not the description field.**

| Field | Value | Faithful to user? |
|---|---|---|
| `description` | *"он со мной жить не хочет, вообще не знает, что такое нормальные партнерские отношения"* | **YES** — near-verbatim |
| `category` | **`waiting_for_him_to_choose`** | **NO** — she said he does not want to live with her. She never said she was waiting for him to choose her. |

The divergence is **structural, not transcriptional**. Every `description` sampled in this session is faithful to her words. The `category` labels are the model's inferences, and they are stored, indexed, deduplicated and re-injected **with the same standing as her own words** — rendered side by side (`assemble.ts:386`: `` - `${p.category}` — "${p.userDescription}" ``).

## Escalation — **PROVEN**

The same unstated inference was then written three times under three different labels:

| Turn | Category | Status |
|---|---|---|
| T1 08:58:40 | `waiting_for_him_to_choose` | permanent, never flagged as rejected |
| T4 09:03:48 | `waiting_for_ideal_to_materialise` | permanent, never flagged as rejected |
| T8 09:09:30 | `waiting_to_be_chosen` | permanent; explicitly rejected at T9 |

**PROVEN.** Because deduplication is by exact `category` string (`save.ts:420-421`), these are three independent rows. The user rejected the *idea*. Only one *label* was ever named in the correction. **Two rows encoding the rejected idea were never marked at all** — and the correction that named the third was itself prose, not structure.

## Consequence — **PROVEN**

At T9 the system contained, simultaneously:

- three permanent structured rows asserting a claim the user had just called wrong,
- one part row for an image she had told it to drop,
- one prose sentence, inside a size-truncated field, saying not to reintroduce one of them.

By T21 the prose sentence was gone. The rows remain.

**The system can record a conclusion permanently. It cannot record that a conclusion was withdrawn.**

---

# 4. THE EXACT MEMORY BLOCK SENT TO THE MODEL

**PROVEN by execution.** Reconstructed state for T9 (the rejection turn) passed through the production assembler `assembleSystemPromptBlocks`; block 3 is the memory/state block. Verbatim output of the historical-memory portion:

```
**Historical context — not fact.** Notes below are captures from prior sessions. Use only
if they clearly fit what the user is showing today. Do not reopen, repeat or deepen an old
capture merely because it appears here — first verify against the user's live signal.

**Inner parts the user has met (each in their own words):**
- "девочка на лестничной площадке, стоит у окна, держит перила, юбочка, волосы завязаны,
  тишина, мечтает о другой жизни — та же, что ждёт каждое утро" — channel: visual —
  safe distance: "наблюдает со стороны"

**Unresolved patterns the user has surfaced (working notes — not diagnosis; use to
recognise, not to name unless they name it):**
- `waiting_to_be_chosen` — "каждое утро просыпаюсь с надеждой, что подойдет, обнимет,
  спросит — изо дня в день жду" — context: ageTag: "present"
- `waiting_for_ideal_to_materialise` — "каждое утро просыпаюсь с надеждой, что вот сейчас
  будет все по-другому" — context: ageTag: "present"
- `projection_of_ideal_onto_partner` — "придумала образ, надела на него, жила с этим
  образом всю жизнь" — context: ageTag: "present"
- `emotional_rollercoaster_cant_exit` — "мне надо как-то выходить из этих эмоциональных
  качелей" — context: ageTag: "present"
- `waiting_for_him_to_choose` — "он со мной жить не хочет, вообще не знает, что такое
  нормальные партнерские отношения" — context: ageTag: "present"

**Prior session notes (may be incomplete, outdated, or mistaken — use as context, not truth):**
> Presenting: 15-year marriage… Today she named the waiting loop herself — wakes every
> morning with hope, waits for him to be different, cannot stop… The девочка у окна is
> structurally identical to this morning-hope posture — same window, same waiting. This is
> the thread to follow: the girl is still waiting.
```

Full state block: **3,266 characters.**

**Three of the five injected patterns encode the "waiting" claim.** The block also carries the taskContract line *"найти корень — откуда берётся потребность ждать, что тебя выберут"* with the directive *"Check the route against this contract before selecting an intervention."* **PROVEN:** at the moment she said *«у меня вообще нет потребности, что кто-то меня выбирал»*, the model was being instructed by its own memory to hunt for the root of that need.

**Mitigating language present (PROVEN):** the block does carry hedges — *"Historical context — not fact"*, *"working notes — not diagnosis"*, *"may be incomplete, outdated, or mistaken"*, *"Do not reopen… merely because it appears here"*. These are the only counterweight, and they are prose addressed to the model, not mechanism.

---

# 5. FINDINGS SUMMARY

| # | Finding | Label |
|---|---|---|
| M1 | Neither a pattern nor a part can be retracted. `active: true` is filtered on, but `active: false` is never written and no delete exists anywhere in `app/` or `lib/`. | **PROVEN** |
| M2 | Pattern deduplication is by exact `category` string, so one idea under three labels becomes three permanent rows. | **PROVEN** |
| M3 | First divergence is T1 (08:58:40), in the `category` field. Descriptions are faithful; categories are model inference stored with equal standing. | **PROVEN** |
| M4 | The rejected claim existed under three category labels; the correction named only one. | **PROVEN** |
| M5 | The user rejected the девочка image (T7) and the waiting inference (T9). Neither produced any change to stored structure. | **PROVEN** |
| M6 | Rejected conclusions left the prompt only by displacement out of the top-5 window as newer patterns accumulated, not by correction. | **STRONGLY SUPPORTED** |
| M7 | The correction record lived only in `continuityNote` prose, and disappeared at 12:56:20 after six consecutive turns; it is absent from the current stored note. | **PROVEN** |
| M8 | `continuityNote` renders head-400 + tail-300 over 800 chars, silently discarding the middle — so any guard written into the middle of a long note is dropped from the prompt while the rows it guards persist. | **PROVEN** |
| M9 | `taskContract.currentFocus` was set at T3 to a model inference (*"не страх, а неполученное"*) immediately after the user said she did not know what held her, and at T8 to the rejected waiting framing. It is rendered with a directive to check interventions against it. | **PROVEN** |
| M10 | The model's registration of both rejections was clinically correct and immediate; the failure is that correct recognition had nowhere to be written. | **PROVEN** |
| M11 | Whether pattern rows predating 2026-07-26 exist, and the true `lastConfirmedAt` ordering, cannot be determined without DB access. | **UNKNOWN** |
| M12 | Whether the same profile exists on other accounts. | **UNKNOWN** |
| M13 | Whether the accumulated dossier *caused* the interpretive register of the replies. The feedback loop is proven to exist; causation is not demonstrated. | **HYPOTHESIS** |

## The mechanism in one line — **PROVEN**

> A conclusion is written to structure and is permanent. A retraction is written to prose and is volatile. Memory therefore drifts monotonically away from the user, and the drift is invisible to the system that produced it.

---

*No data was reset, edited or repaired. No fix is proposed in this document.*
