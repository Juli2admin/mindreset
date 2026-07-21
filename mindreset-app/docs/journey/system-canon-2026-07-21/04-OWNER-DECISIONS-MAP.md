# Doc 4 — OWNER DECISIONS MAP

Each major owner decision affecting the Journey runtime, its recorded intent,
and its **status verified against live code** (this canon's evidence agents),
not against the decision docs. Classification:

- **SHIPPED** — implemented and live as intended.
- **PARTIAL** — some of the decision shipped; part did not.
- **SUPERSEDED** — later reverted or replaced.
- **CONFLICTING** — shipped but coexists with contrary live logic that was
  never reconciled.
- **NEVER SHIPPED** — recorded as decided, absent from the runtime.

Decision IDs (D1…) follow the owner-decision inventory so they can be
cross-checked. A meta-fact from that inventory: the formal decision logs
(`locked-decisions.md`, `open-questions.md`, `carry-forward.md`) contain almost
no Journey-runtime decisions — these live in commit/PR text and the audit
series, and git history is squashed (`456e9a9` folded the execution layer into
one commit), so PR labels (α, β, λ, 4b…) survive only in comments and docs.

---

## 1. Decision status table

| ID | Decision (date) | Recorded intent | Code-verified status | Class |
|---|---|---|---|---|
| D1 | Runtime ships; `recommendedDepth`/`currentDepth` declared (2026-06-09) | depth tracked end-to-end | `currentDepth` permanently `'surface'`; `recommendedDepth` assigned nowhere (save.ts:22,116) | **NEVER SHIPPED** (depth wiring) |
| D2 | Collapse 8 stage-prompts into one flexible master (~Jun 2026) | recursive, non-linear method | master runs; all 8 specs loaded every turn (assemble.ts:532-544) | **SHIPPED** (prompt side); engine unchanged → see D14 |
| D3 | `<assessment_phase>`: Stage 1 = wide assessment + share-back (#130, 06-15) | go wide before deep | text live in master; behavioural effect NOT PROVEN (static audit) | **SHIPPED** (text) / NOT PROVEN (behaviour) |
| D4 | Execution-rebuild plan, report-first signal channel (06-30) | report-first + PR-per-step | Milestone 1 merged; Milestones 2–3 (PR 5–13) never built | **PARTIAL** |
| D5 | Stage-1 safety guard "B option" (owner sign-off, 06-26) | looser watch-blocking guard | live at stage-gates.ts (Stage-1 uses `noRedFlagInLast`, not all-none) | **SHIPPED** |
| D6 | Remove `formulation_confirmed` from Stage-1 code gate (#177, 06-28) | code gate simplified | removed in code; prompt kept teaching it until reconciled 2026-07-19 (D17) | **SHIPPED** (now reconciled) |
| D7 | `CLINICAL_MANUAL.md` = source of truth (owner, 07-01) | manual overrides code | manual is **never loaded by any code** — zero runtime reach | **CONFLICTING** (declared authority, powerless) |
| D8 | **Anchor redefinition + promised gate-removal PR** (owner, 07-02) | anchor = observed reality, never spoken, not a soothe/close; remove `anchor_not_set`/`anchor_identified_token_missing` | gate **still enforces** anchor across all classic gates (stage-gates.ts:113,121,…); prompt still recalls it as soothe/close in places | **NEVER SHIPPED** (code removal) + **CONFLICTING** |
| D9 | Polish PRs 1–6 (owner plan, 07-04) | time buckets, PGA verbatim, channel guidance, 38-move vocab, JourneyPattern, staleness | additive, live | **SHIPPED** |
| D10 | Move-based advance lane + 8 owner-locked rules (PR 4b, 07-07) | advance on moves, ignore `recommendedAction` | live as a **parallel** lane; classic gate untouched → two un-reconciled lanes (router.ts:111-142) | **SHIPPED** but **CONFLICTING** |
| D11 | PR α: pre-reply `<assessment>` + Sensitivity Layer 5 silent questions (07-09) | analyse before speaking | Sensitivity text live; `<assessment>` enforcement removed same day (D12) → 5 questions unenforced | **PARTIAL** |
| D12 | PR β: remove `<assessment>` output for latency; `max_tokens`→2500 (07-09) | reply-first for speed | verified: reply-first single stream; `max_tokens 2500`; reasoning tags forbidden; strip kept defensively | **SHIPPED** (strip now vestigial) |
| D13 | PR γ/θ/ζ/ι: report fields required, `<thinking>` strip, panic-keyword narrowing (07-10/11) | session-driven fixes | live (keywords.ts narrowings; `<thinking>` strip) | **SHIPPED** |
| D14 | PR λ: all 8 specs every turn; "stage = bookkeeping label, NOT gates; you lead" (07-11) | flexible non-linear engine | **prompt** side shipped (all 8 specs, stage a label); **gates + router still enforce the sequential model** (stage-gates.ts, router.ts) | **PARTIAL** / **CONFLICTING** (deepest split) |
| D15 | Clinician-identity sentence added (#308) then reverted (#309, 07-16/17) | trial then rollback | reverted cleanly | **SUPERSEDED** |
| D16 | Loader fence-extraction fix (#324, 07-19) | stop ~6,101-char silent truncation of the Sensitivity hard-rules | bug fixed; implies the hard rules did not reach the model 07-09→07-19 (historical) | **SHIPPED** |
| D17 | P1/P2/P3 remediation subset merged (#325-328, 07-19) | release semantics / closure / task contract | P1 release claim/confirm/invalidate **live in code** (releaseClaimedAt vs releasedAt, save.ts + Stage-5 gate); P2 closure discipline is **prompt-only** (no code reads `stabilityCheck`); P3 task contract **rendered, not gated** | **PARTIAL** |
| D18 | Decision-facilitation scope ruling (owner, 07-19) | reword the blanket "no life decisions" ban to allow structured clarification | implementation deferred; no runtime change | **NEVER SHIPPED** (deferred) |
| D19 | `<communication>` anti-echo section (#329, 07-20) | ban paraphrase/echo, "I hear you", move-announcing | section present in master; the surrounding exemplar mass still models the banned voice → not reconciled | **SHIPPED** but **CONFLICTING** |
| D20 | Onboarding answers rendered into the state block (#332, 07-20) | context bridge into Journey | additive, self-retiring render | **SHIPPED** |
| D21 | Model & sampling: `claude-sonnet-4-6` all stages, no temperature, `max_tokens 2500`; Opus reserved for hardest stage "after fidelity testing" | one model now, Opus later | verified: Sonnet all stages, `STAGE_MODEL_OVERRIDES` empty, temperature unset, 2500 | **SHIPPED** (single model) / Opus tiering **NEVER SHIPPED** |
| D22 | Gender-neutral RU phrasing standard for all NEW surfaces (owner, 07-20) | avoid gendered past-tense in new RU copy | standard recorded; migration ongoing; conflicts with older "feminine canonical" lock | **PARTIAL** + **CONFLICTING** |
| D23 | RU safety keyword phrases (locked, 06-01) | ~95 RU phrases, shared Journey+MiniMind scanner | live in safety/keywords path | **SHIPPED** |
| D24 | Standing voice / prohibition cluster (canon) | nameless AI, British English, no advice/plans/diagnosis, etc. | mostly live; several **stage-specific** prohibitions missing from the master (e.g. Stage 1 no early breathing, Stage 2 no historical why, Stage 4 no sensory reconstruction, Stage 7 no rehearsal) | **PARTIAL** |

---

## 2. Owner inputs that never became decisions (flagged, not graded)

- **Julia's ten "continuous questions"** (the implicit human-clinician layer:
  contracting, request-tracking, deviation rules) — never authored into the
  manual or runtime. The prior audits call this "the deepest finding."
- **Julia's five silent pre-reply questions** — encoded in the Sensitivity
  Layer (D11) but unenforced since the assessment block was removed (D12).

---

## 3. Standing conflicts between decisions (both live; not adjudicated here)

Each is a case where two owner-endorsed or owner-recorded positions are
simultaneously present in the running system. Code-side confirmation, where an
evidence agent verified it, is noted.

- **A — Flexible map (D14) vs sequential engine (gates/router).** Prompt says
  "stage is a label, you lead"; code gates and both router lanes enforce a
  sequence. *Code-confirmed:* gates + router are sequential (Doc 1/2/3).
- **B — Anchor retired (D8) vs anchor enforced.** *Code-confirmed:* gate still
  requires the anchor; move-based lane ignores it; prompt recalls it as a
  soothe/close in places.
- **C — Analyse-before-speak (D11) vs reply-first (D12).** *Code-confirmed:*
  single stream, reply first, hidden report after; reasoning tags forbidden.
- **D — Anti-echo (D19) vs echo exemplars.** Section bans the voice the
  surrounding specs model. (Behavioural weight NOT PROVEN by static audit; the
  textual coexistence is confirmed.)
- **E — Assessment-only Stage 1 (D3) vs same-turn practice / cross-stage
  license (D14).** Wide-before-deep vs "all playbooks usable now."
- **F — Gender-neutral RU (D22) vs "feminine forms canonical" (2026-05-19
  lock).** The two written rules disagree on the default; CLAUDE.md flags the
  tension itself.
- **G — `CLINICAL_MANUAL` = source of truth (D7) vs its zero runtime reach.**
  *Code-confirmed:* never loaded.
- **H — Two advance lanes (D10) never reconciled.** *Code-confirmed:* both
  live, different criteria.
- **I — `max_tokens` provenance:** the hotfix log says "1500→2000", PR β says
  "1500→2500"; runtime is 2500. Descriptive inconsistency only; current value
  confirmed.

---

## 4. Reading

The pattern across the table: **prompt-layer decisions shipped; the engine
(gates, router, state wiring) was frequently not re-derived to match.** The
largest instances (A, B, H) are structural — a prompt generation and an engine
generation running at once. This canon documents both; the decision about which
generation is canonical is the owner's, and is the reason development is frozen.
