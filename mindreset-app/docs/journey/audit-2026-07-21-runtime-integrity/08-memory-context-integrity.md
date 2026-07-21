# Memory & Context Integrity Audit — Journey Runtime (2026-07-21)

Code-verified (read-only) against the current tree. Citations are file:line in
`mindreset-app/`. NOT PROVEN marks unverifiable items.

## Per-item integrity table

| Item | Stored where | Max size / window | Truncation | Merge / overwrite | Old data removed? | Correction supersedes? | Model sees next turn? | Code validates USE? |
|---|---|---|---|---|---|---|---|---|
| Raw conversation history | `JourneyMessage` rows (encrypted) — `prisma/schema.prisma:953-964` | **Last 30 messages** to the model (`HISTORY_LIMIT=30`, `route.ts:62,348-354`) | Older turns silently invisible to model (DB keeps all; no delete path exists) | append-only | never (except account cascade) | n/a | 30 most recent only | none |
| Prior assistant replies | same rows | — | Stored AFTER stripping `<state-report>`/`<assessment>`/`<thinking>` (`parse.ts:129-156`); unclosed tag ⇒ tail dropped (`parse.ts:60-89`); leak ⇒ row replaced with `'[Reply interrupted…]'` (`route.ts:593-613`); on every load, leak-matching rows masked to `'[previous reply omitted]'` (`route.ts:376-389`) | overwrite on leak only | no | n/a | yes (as clean prose — the model's OWN visible style, minus all reasoning) | leak check only |
| Full state reports | `JourneyTurn.stateReportEncrypted` (append-only, `audit/log.ts:18-33`; schema `:791-814`) | all kept | — | append-only | never | n/a | **NO — never re-enter model context.** Only a 4-field derivation returns: `cycleStatus`, `clinicalRead` (cut to 240 chars at render), `modalityRejected`, `channelShiftDetected`, from ≤10 turns of the CURRENT session (`state/load.ts:363-376,454-488`; `assemble.ts:263-283`) | router reads for gate arithmetic only (`router/history.ts:29-70`) |
| continuityNote | `RecodeProgress.continuityNoteEncrypted` (schema `:775-778`) | storage unbounded (no cap in `parse.ts:383,477-487`) | **Render: head 400 + tail 300 chars with "[...older material in the middle omitted…]" for notes >800** (`assemble.ts:410-439`) | **FULL OVERWRITE each emission** — `save.ts:118` replaces the whole column. "Never wipe history; refine it" is **prompt-only** (`journey-master.md:464,741`), unenforced | old note gone on overwrite | only if the model voluntarily rewrites; no diffing/versioning | yes (truncated) | **no code reads it** (absent from gates/router; confirmed) |
| taskContract | `RecodeProgress.taskContractEncrypted` (schema `:780-785`) | 300-char/field cap; generic values dropped (`parse.ts:427-450`) | — | field-wise last-write-wins incl. `presentingRequest` (`save.ts:151-181`) — "only on explicit change of direction" is prompt-only | prior field value gone | correct AND incorrect overwrites indistinguishable to code | yes, rendered FIRST (`assemble.ts:164-194`) | no gate reads it |
| Parts | `JourneyPart`, `active` default true (schema `:844-859`) | render top-5 by `updatedAt` (`load.ts:179-183`) | — | upsert on exact-description match (`save.ts:189-226`) | **no deactivation path exists** — no code ever writes `active:false` | **no** | yes | no |
| Foreign files | `JourneyForeignFile` (schema `:864-888`) | render 3 most recent (`load.ts:184-191`) | — | claim → `releaseClaimedAt`; confirm (later turn only, same-turn guard `save.ts:289,309,353-355`) → `releasedAt`; **invalidate → BOTH timestamps nulled** (`save.ts:376-401`) → renders as `'identified'` again (`assemble.ts:341-345`) | text fields (`returnedTo`, `honouringPhrase`, `whatStaysAsMine`) survive invalidation but are **never rendered to the model anyway** (grep-verified) | **yes — the ONE real structured correction mechanism in the system** | yes (phase-labelled) | Stage-5 gate counts `releasedAt` only |
| Signature images | `JourneySignatureImage` | storage unbounded; render top-5 (`load.ts:192-200`) | — | exact-string dedup (`save.ts:461-486`) | never | no | yes | no |
| Patterns | `JourneyPattern`, unique `(userId,category)` (schema `:928-948`) | render top-5 by `lastConfirmedAt` (`load.ts:201-209`) | description cap 200 | update bumps `lastConfirmedAt`, merges `context` shallowly (`save.ts:416-441`) | **never** — no deactivation/deletion; a wrongly-invented category persists until crowded out of top-5 | **no correction mechanism of any kind** | yes, with ≥7-day staleness suffix / ≥14-day reconfirm nudge (`assemble.ts:352-400`) | no |
| Rejected modalities | derived from ≤10 turns, stops at first ≥4h gap (`load.ts:406-468`) | session-scoped | — | union within session | **RESET on every session resume** (`load.ts:396-399`) | n/a | this session only — **"user rejected body work yesterday" is NOT known today** | render-only; no code blocks a violating question |
| Open cycle | derived same window (`load.ts:396-444`) | session-scoped; state block treats `open` OR `closing` as open (`load.ts:430`) | — | newest `cycleStatus` wins | self-clears at session boundary; router side self-heals (checks ONLY the single latest turn, blocks on literal `'open'` only — `'closing'` does NOT block advance) (`router.ts:69-76,95-108`) | — | yes (banner) | advance/discharge guard only; **no session-close concept exists in code** |
| Stage / depth | `RecodeProgress.currentStage/currentDepth` | — | — | stage written ONLY by router: advance → `to` (`router.ts:210-217`), regress_to_grounding → 1 (`:80-85,219-227`), regress_to_parts → floor 4 (`:86-91`); landscape preserved on regress (`:177-181`) | — | — | yes (state block) | **`currentDepth` CONFIRMED DEAD**: writer branch `save.ts:116` requires `updates.recommendedDepth`, which `applyStateReportToProgress` (`save.ts:34-82`) never assigns and the report schema doesn't even define; router resets depth to `'surface'` on every transition (`router.ts:214,224`). Field can never be anything but `surface`. |
| Onboarding answers | `WellbeingSnapshot.onboarding*` (`profile.ts:83-118`) | — | — | — | — | — | **only until taskContract exists** (`assemble.ts:168-194`, gated at `:179`) — confirmed | n/a |
| Corrected facts / invalidated hypotheses | — | — | — | — | — | **Only mechanisms: (1) `releaseInvalidated` (structured, foreign files only); (2) voluntary full rewrite of continuityNote/taskContract (unenforced, unaudited).** Patterns and parts: none. Admin inspector is read-only (`journey-inspect/page.tsx:243`, GET only; no mutation API exists) | — | — |

## Coexistence verdicts (each code-verified)

- **(a) Two conflicting hypotheses simultaneously:** YES — patterns have no deactivation;
  contradictory categories both stay active and can co-render in the top-5
  (`save.ts:416-459`, `assemble.ts:365-400`).
- **(b) An old rejected interpretation retained:** YES — in `continuityNote` (full text
  persists in DB beyond the render window) and in `JourneyPattern`. The one exception that
  self-clears is `sessionRejectedModalities` (session boundary reset).
- **(c) Corrected narrative AND earlier incorrect conflation together:** YES — for
  continuityNote >800 chars the render keeps head+tail and drops the middle; a correction
  can land in (or be pushed into) the dropped middle while the incorrect earlier claim
  survives in the head. No versioning (`assemble.ts:410-439`).
- **(d) Invalidated release alongside a 'released' note:** **NO** — the one prevented case:
  invalidation nulls both timestamps and the render reverts to `identified`
  (`save.ts:388-396`, `assemble.ts:341-345`).
- **(e) Old and new anchor rules simultaneously:** YES at prompt level (contradiction
  matrix C1/C2). Code-side anchor is set-once/never-overwritten (`save.ts:101-105`),
  consistent with the new rule.
- **(f) Old and new stage assumptions simultaneously:** YES by design — all 8 stage specs
  co-resident every turn + "bookkeeping label" header (`assemble.ts:473-483`), while code
  holds one integer `currentStage` under the OLD sequential gate model. No code reconciles
  the model's stage belief with the router's.

## Notable integrity risks (facts, not recommendations)

1. **The strategic memory is an unenforced overwrite.** The only cross-session clinical
   memory (continuityNote) can be silently wiped or shrunk by a single weak emission, and
   its middle is structurally invisible to the model that is instructed to maintain it.
2. **Session-boundary amnesia for refusals.** Modality rejections and cycle context vanish
   after any ≥4h gap; the prompt's "must not re-offer" discipline has no cross-session
   substrate.
3. **No correction economy.** Except foreign-file invalidation, nothing the user corrects
   can be structurally retracted — only crowded out or voluntarily rewritten.
4. **The model never sees its own past clinical reasoning.** Full reports never re-enter
   context; the reply history it CAN see is precisely the stripped, reasoning-free prose —
   maximising style imitation of its own prior surface while denying it its prior thinking.

*Read-only audit. No fixes proposed.*
