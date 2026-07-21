# Code vs Prompt Authority — Journey Runtime (2026-07-21, code-verified)

Who ACTUALLY holds authority for each behaviour. Sources: prompt (P), code (C), model
discretion (M), state report (SR), database state (DB), owner decision (OD). Citations in
`mindreset-app/`.

| Behaviour | Actual authority | Detail |
|---|---|---|
| Safety flag | C+SR+C | THREE ORed code triggers: pre-LLM keyword regex (`route.ts:310-334`); the AI's own `safetyFlag:'red_flag'` — **AI-set but code-enforced unconditionally** (`route.ts:629-636`); Haiku verifier `clear_crisis` post-stream (`route.ts:638-646`). Idempotent freeze (`freeze.ts:29-58`). |
| Crisis freeze / unfreeze | C | Frozen branch never calls the turn LLM (`route.ts:223-307`); only verifier `safety_confirmation` lifts (`:264-285`). |
| Stage | C | Router only. Classic gates: `advance` necessary-not-sufficient (`stage-gates.ts:56-63,108-111`). Move lane: **ignores `recommendedAction`** (`move-based-advance.ts` — no read). Prompt's "bookkeeping label" claim has no code backing — gates are real. |
| Depth | **nobody** | Dead field: only `'surface'` reachable (see architecture map). Prompt renders it; schema has no emission slot; gates never read `depthAtTurn`. |
| Progression pace | C | Windows, thresholds, tokens, two-days reproducibility (`stage-gates.ts:99-651`); open-cycle guard (`router.ts:95-109`). |
| Regression | SR→C | The ONE place a single report value acts alone: `regress_to_grounding`→stage 1, `regress_to_parts`→floor 4, honoured unconditionally (`router.ts:80-91,219-227`). |
| Modality honouring | M only | `sessionRejectedModalities` is render-only (`assemble.ts:272-277`); no gate/router reads it; session-scoped (resets on ≥4h gap, `load.ts:396-399`). Prompt forbids re-offering; code cannot enforce. |
| Anchor | C(storage)+P(behaviour) | Set-once in code (`save.ts:101-105`). All behavioural rules (never say "anchor", not a soothe) are prompt-only — and contradicted by canon exemplars (contradiction matrix C1/C2). |
| Practice selection | M | Entirely prompt-guided; no code involvement in choice. |
| Practice completion | M (+telemetry) | Only `aborted_overwhelm` has any code consequence (Stage-4 MII-3, `stage-gates.ts:258-262`). Orphan `started`/`mid` rows unenforced. |
| Release | C | Claim (`releaseClaimedAt`) vs confirm (`releasedAt`, later-turn-only via `claimedThisCall` guard) vs invalidate (nulls both) — fully code-modelled (`save.ts:289-401`); Stage-5 gate reads `releasedAt` only (`stage-gates.ts:337-338`). Prompt and code agree here. |
| Cycle closure | M (prompt-only) + C (different rule) | **`cycleCanClose` is parsed but read by NOTHING** — zero consumers (grep-verified). The router's guard uses its OWN rule (`cycleStatus==='open'` on the single last turn; `'closing'` doesn't block) which differs from the state block's `hasOpenCycle` (open OR closing, session-windowed). |
| Session closure | **nobody** | No session-close concept exists in code. The 1–10 stability discipline, the 8-question closure check, "do NOT end the session" — all prompt-only. `stabilityCheck.score` is stored, never read by any gate; `schema.ts:96-98` documents an intended enforcement ("refuse close … score < 6") that was **never implemented**. |
| Task contract | C(merge)+M(use) | Field-wise merge with generic-value filter (`save.ts:164-181`, `parse.ts:427-450`); `presentingRequest` freely overwritable (prompt-only restraint). Nothing routes/gates on the contract. |
| Memory (continuityNote) | M | Full overwrite each emission (`save.ts:118`); "never wipe" prompt-only; render truncation head 400/tail 300; **no code reads the note**. |
| Hypothesis status | M | Patterns/parts have NO deactivation or correction path (memory-integrity doc §7/§12); only foreign-file invalidation is structured. |
| Visible communication style | M | Zero code involvement; competing prompt layers (contradiction matrix §A) + 50:1 exemplar imbalance decide in practice. |

## Mismatch register

1. **Prompt requires, code ignores:** `cycleCanClose` (emit-before-close instruction at
   `assemble.ts:266` — no consumer); `stabilityCheck.score` (documented-but-never-built
   enforcement); modality-rejection honouring; task-contract route-checking; continuityNote
   additivity.
2. **Prompt asserts, code contradicts:** "Stage numbers … are NOT capability gates"
   (canon header) vs live classic gates + move lane + open-cycle guard. Code enforces the
   sequential model the prompt disavows.
3. **Prompt suppresses what code requires:** `<assessment_phase>`/Block-1 focus tells the
   model to emit `advance` ONLY at share-back, while every Stage-2..8 classic gate requires
   `advance` for its own exit (contradiction matrix E3).
4. **Code path unreachable:** `save.ts:116` depth write (no producer, no schema field);
   `JourneyDepth` `'middle'|'deep'` values unreachable.
5. **Code/code inconsistency:** two open-cycle definitions (`load.ts:414-434` vs
   `router.ts:76`) can disagree on the same turn (`'closing'`).
6. **Retired concept still required:** Stage-1 classic gate still requires anchor material
   (retired by owner 2026-07-02; fix existed in `4d08114`, never merged — see timeline
   doc; re-verify `stage-gates.ts:108-121` current HEAD).
7. **Schema comment false for one lane:** "Code decides; this is advisory" is true for the
   classic lane, false as a description of the move lane (which never reads the field).
8. **Unvalidated input:** `body.modelOverride` from the request JSON reaches
   `anthropic.messages.stream` with no allowlist (`model.ts:20`) — NOT an instruction
   mismatch but an authority anomaly: the CLIENT holds model-selection authority.
9. **Doc/code drift inside the assembler:** `assemble.ts:567-575` docstring says 5 blocks;
   the code builds 4.

*Read-only audit. No fixes proposed.*
