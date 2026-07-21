# Active Instruction Inventory — Journey Runtime (2026-07-21)

Every source that can influence production behaviour. Sizes measured on the assembled
export (≈92.4k tokens incl. appended note); % = share of final runtime prompt. Order =
position in the assembled prompt (1 = first). Classification legend:
`ACTIVE_APPROVED` (current, owner-backed or uncontradicted) · `ACTIVE_CONFLICTING`
(live and contradicted by another live layer) · `LEGACY_STILL_ACTIVE` (superseded by a
later decision but still shipped) · `DUPLICATED` · `DEPRECATED_UNREACHABLE` · `DEAD` ·
`UNKNOWN`.

## A. Prompt-carried sources (reach the model every turn)

| Source | Class | ~tokens | % | Order | Key-instruction repetition elsewhere |
|---|---|---:|---:|---|---|
| Canon header ("stages NOT capability gates") | ACTIVE_CONFLICTING (vs 8 gate sections + live gate code) | 482 | 0.5 | 1 | bookkeeping claim ×3; contradicted ×9 |
| Shared Core | ACTIVE_CONFLICTING + partly LEGACY (§2 voice vs `<communication>`; §6 anchor regime superseded 2026-07-02; §9 schema superseded by `<output_format>`; §5 practice system duplicated ×3) | 4,412 | 4.8 | 2 | practice system ×3; schema ×2; voice rules vs 2026-07-20 layer |
| Practice Generation Algorithm doc | DUPLICATED (3rd copy of practice system; owner-approved load 2026-07-04) | 2,489 | 2.7 | 3 | ×3 |
| Stage specs 1–8 (incl. 25 worked examples, 812 model-voice snippets) | ACTIVE_CONFLICTING + LEGACY_STILL_ACTIVE in parts (S1 Ex.C pre-revision anchor script; S2 anchor-recall regime ×7; S2 gate "anchorText set"; sequential gates vs PR λ; S5 same-session release narratives vs P1) | 60,498 | 65.5 | 4 | exemplar mass outweighs every later rule it contradicts (matrix §A/§C) |
| `<clinical_reading>` | ACTIVE_APPROVED (unenforced — no pre-reply slot) | 717 | 0.8 | 5 | — |
| `<communication>` (2026-07-20, owner-approved) | ACTIVE_APPROVED and ACTIVE_CONFLICTING vs SC §2 + 812 exemplars; **one day old at test time** | 878 | 0.9 | 6 | echo-ban ×1 vs mirror ×19 |
| `<method>` 8 moves | ACTIVE_APPROVED (anchor §1 = the 2026-07-02 owner rule) | 3,138 | 3.4 | 7 | anchor rule contradicted ×24 upstream |
| `<assessment_phase>` | ACTIVE_CONFLICTING (vs flexible map + same-turn triggers; `advance`-only-at-share-back vs S2–S8 gates) | 1,127 | 1.2 | 8 | — |
| `<practice_generation>` | ACTIVE_APPROVED + internally tensioned ("most is conversation" vs 10-step hierarchy + 8 same-turn triggers) | 3,750 | 4.1 | 9 | ×3 with SC/PGA |
| `<traps>` (12) | ACTIVE_APPROVED (trap 5 body-obsession contradicted by 13 exemplars) | 1,788 | 1.9 | 10 | — |
| `<memory>` | ACTIVE_APPROVED (additivity unenforced — save is overwrite) | 706 | 0.8 | 11 | — |
| State block (dynamic) | ACTIVE_APPROVED data; carries the dead "Current depth: surface" line + task contract + cycle banner (`cycleCanClose` instruction has NO code consumer) | 1,329 | 1.4 | 12 | — |
| `<examples>` (10 + welcome rule) | ACTIVE_APPROVED (current voice; outweighed 50:1 by stage exemplars) | 2,409 | 2.6 | 13 | — |
| `<output_format>` (schema, Block-1 checklist, 38-move vocab) | ACTIVE_APPROVED machinery; contains fields code never reads (`cycleCanClose`, `stabilityCheck` score) | 6,079 | 6.6 | 14 | schema ×2 with SC §9 |
| Therapeutic Sensitivity Layer | ACTIVE_APPROVED, self-tensioned (demands pre-reply reasoning AND forbids any reasoning artefact); **absent from production 2026-07-09→07-19 (loader bug)** | 2,361 | 2.6 | 15 | — |
| Appended `<system-note>` reminder | ACTIVE_APPROVED (recency slot; strongest-positioned instruction; subject = JSON emission) | 124 | 0.1 | 16 (last) | — |
| Task contract (data) | ACTIVE_APPROVED (rendered first in state block; nothing routes/gates on it) | in state block | — | 12 | — |
| Continuity note (data) | ACTIVE_APPROVED (render-truncated 400+300; save = full overwrite; read by no code) | in state block | — | 12 | — |
| Onboarding context (data) | ACTIVE_APPROVED (renders only until contract exists — verified) | in state block | — | 12 | — |
| Living landscape / patterns (data) | ACTIVE_APPROVED (no correction mechanism — patterns/parts永 persist) | in state block | — | 12 | — |

## B. Code-carried sources (influence behaviour without being prompt text)

| Source | Class | Notes |
|---|---|---|
| Classic stage gates (`stage-gates.ts`) | ACTIVE_CONFLICTING + LEGACY_STILL_ACTIVE in part | enforce the sequential model the canon header disavows; **still require anchor material** — retired by owner 2026-07-02, deletion never shipped (`:113,121`) |
| Move-based lane (`move-based-advance.ts`) | ACTIVE_APPROVED (owner-locked 2026-07-07) | ignores `recommendedAction`; un-reconciled with classic lane |
| Open-cycle guard (`router.ts:76,95-109`) | ACTIVE_APPROVED | different open-cycle definition from the state block's (`'closing'` counts only in the prompt-facing one) |
| Regression lanes (`router.ts:80-91`) | ACTIVE_APPROVED | the one single-report-value authority |
| Safety: keyword scan / AI red_flag / Haiku verifier / freeze | ACTIVE_APPROVED | three ORed triggers; verifier post-stream |
| Report parser + `DEFENSIVE_DEFAULT` | ACTIVE_APPROVED | hold-biased default on any parse failure |
| Emission-reminder injector | ACTIVE_APPROVED | — |
| Leak detector / history mask | ACTIVE_APPROVED | — |
| Save layer (anchor set-once; contract merge; release claim/confirm/invalidate; continuityNote overwrite) | ACTIVE_APPROVED | additivity of the note is prompt-only |
| `save.ts:116` depth write | DEAD | no producer; no schema field |
| `cycleCanClose` consumer | DEAD (field parsed, read by nothing) | prompt instructs its emission |
| `stabilityCheck.score` enforcement | DEAD (documented intent in `schema.ts:96-98`, never built) | collected every relevant turn |
| `assembleSystemPrompt` fallback chain | DEAD + hazardous (master-missing → infinite recursion; engineered-stage branch unreachable) | see loader audit |
| `loadEngineeredStagePrompt` + `runtime/stage-01/02.md` | DEPRECATED_UNREACHABLE (on disk, pre-2026-07-02 anchor language) | reactivatable only if master file vanished — which crashes first |
| `CLINICAL_MANUAL.md` | DEPRECATED_UNREACHABLE (never loaded) | self-declares authority over code; unrevised since 2026-07-01 |
| `body.modelOverride` | UNKNOWN/anomaly | client-supplied, unvalidated, reaches the API call |
| DB/config-provided instructions | none found | no prompt text originates from DB or env config (crisis EN/RU strings are code constants) |
| Feature-flagged prompt variants | none exist | only branch = master-file existsSync |
| Provider prompt cache | cannot serve superseded content (byte-prefix keyed) | see loader audit §4 |

## Headline counts

- Prompt sources: 16 distinct instruction layers + 4 data layers, **73.5% method canon,
  ~4–5% behaviour rules, ~10% report machinery**.
- Classification totals: 9 ACTIVE_CONFLICTING or partly-LEGACY layers; 3 DUPLICATED
  systems (practice ×3, schema ×2, gates ×9-statement); 4 DEAD code/fields; 3
  DEPRECATED_UNREACHABLE artefacts; 1 UNKNOWN authority anomaly (modelOverride).
- **Independent "sources of truth" for the method: 4 simultaneously live** (Clinical
  Manual [unloaded but self-authoritative], Shared Core + stage specs [sequential], canon
  header/PR λ [flexible], master operational layer) — plus the gate code as a fifth,
  enforcing the sequential one.

*Read-only audit.*
