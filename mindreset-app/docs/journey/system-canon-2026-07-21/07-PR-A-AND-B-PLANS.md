# Doc 7 — PR A & PR B exact plans (planning only — do NOT implement)

Exact, line-level plans for the first two clean-runtime PRs, per the owner
decisions recorded in Doc 6 and the mandatory non-destructive safety protocol.
**Nothing here is implemented. No code or prompt is edited. No PR is opened.**

Safety protocol applied to both PRs: immutable production baseline · separate
clean-runtime branch · **one bounded category per PR** · **remove from runtime
before deleting from repo** · full rollback · **Golden Harness comparison after
the PR** · **behavioural changes behind a tester-only runtime switch** · **no
irreversible migration**. Line numbers verified against HEAD `40cb6c0`
(unchanged runtime vs `origin/main`).

---

# PR A — Behaviour-preserving dead/duplicate cleanup

Scope: only items **proven dead or unreachable**. **No DB column is dropped; no
migration.** Every item below is verified to have zero runtime reader/writer.
Global guard for the whole PR: recorded Golden-Harness parity on the
`julia-2026-07-21` fixture (identical parsed reports + identical rendered state
block, except the two always-constant/always-empty prompt lines noted), full
`vitest run` green (with the listed test updates), and `tsc` clean.

## A1 — Dead `currentDepth` wiring + prompt echo  (register S3)
**Remove:**
- `lib/journey/state/save.ts:22` — `recommendedDepth?: 'surface' | 'middle' | 'deep';` (Updates-type field).
- `lib/journey/state/save.ts:116` — `if (u.recommendedDepth) data.currentDepth = u.recommendedDepth;` (always-false branch).
- `lib/journey/prompts/assemble.ts:201` — `lines.push(\`- Current depth: ${state.currentDepth}\`);` (prompt echo; today always emits `- Current depth: surface`).

**No-reader proof:** `recommendedDepth` is assigned nowhere (only decl :22 + read :116; not a `StateReport` field). No gate reads `currentDepth`/`depthAtTurn` — `stage-gates.ts` and `move-based-advance.ts` have zero occurrences; `router.ts` only *writes* the literal `'surface'` (:214,:224); `history.ts`/`audit/log.ts` only carry `depthAtTurn` into the audit row.
**Runtime effect:** the state block loses one constant line (`- Current depth: surface`) that never varied. `currentDepth` column and `depthAtTurn` audit column remain (no migration); they keep being written `'surface'` exactly as today.
**Tests:** update any `assemble`/state-block test asserting the "Current depth:" line; add an assertion that the line is absent.
**Rollback:** revert the three deletions (pure git revert; no data touched).
**No clinical behaviour change:** the removed branch never fired; the removed line was a constant. Model input differs only by one invariant line whose value never carried information.

## A2 — Unused `cycleCanClose`  (register S4)
**Remove:**
- `lib/journey/stateReport/parse.ts:371-373` — the `cycleCanClose` parse block.
- `lib/journey/stateReport/schema.ts:386-387,394` — the comment + `cycleCanClose?: boolean;` field.
- `lib/journey/prompts/assemble.ts:266` — **only** the final clause `"If you attempt a close, first emit \`cycleCanClose: true\` in the state report — and only if the six not-close conditions in the Sensitivity Layer have cleared."` **Keep** the rest of the "A THERAPEUTIC CYCLE IS OPEN…" banner (lines 263–271), which is live open-cycle guidance.

**No-reader proof:** zero readers of `report.cycleCanClose` anywhere in `router/`, `stage-gates.ts`, `move-based-advance.ts`, `state/`, `streaming/`, `app/`. The router's close/advance guard reads `cycleStatus === 'open'` (`router.ts:76`), never `cycleCanClose`.
**Runtime effect:** the model is no longer asked to emit an inert field; the audit blob no longer contains it (telemetry-only change). Open-cycle behaviour unchanged (it was never driven by this field).
**Tests:** update `state-block.test.ts:556` (asserts `toContain('cycleCanClose: true')`); `therapeutic-sensitivity.test.ts` / `master-prompt-cleanup.test.ts` references.
**Rollback:** revert; no data touched.
**No clinical behaviour change:** the field gated nothing; removing its emission instruction removes an inert instruction, not a behaviour.

## A3 — Unreachable fallback assembly + second state-report schema  (register S7)
**Precondition (safety protocol — confirm unreachable before removal):** confirm `docs/journey/runtime/journey-master.md` is always bundled for the turn/start routes (`next.config.mjs:24-26` `outputFileTracingIncludes`) so `loadMasterJourneyPrompt()` cannot return null in production. **Verified present** (87,703 bytes, tracing-included).
**Remove (all pure dead code except the never-sent schema string):**
- `lib/journey/prompts/assemble.ts:31-104` — `STATE_REPORT_FORMAT_INSTRUCTION` (the drifting second schema; never sent to any model).
- `lib/journey/prompts/assemble.ts:455` — `DIVIDER` (used only at :694).
- `lib/journey/prompts/assemble.ts:653-695` — the entire `assembleSystemPrompt` function (its only prod caller is the dead fallback; lines 683–694 are unreachable even inside it because `assembleSystemPromptBlocks` always returns a non-empty array).
- `lib/journey/prompts/assemble.ts:10-11` — the now-unused imports of `loadStageSpec`, `loadEngineeredStagePrompt`.
- `lib/journey/prompts/load-spec.ts:59-71` (`loadStageSpec`) and `:137-149` (`loadEngineeredStagePrompt`) — no remaining callers.
- `docs/journey/runtime/stage-01.md`, `docs/journey/runtime/stage-02.md` — read only by the dead `loadEngineeredStagePrompt`.
**Replace, do not silently drop, the `!master` branch (assemble.ts:589-594):** change the fallback `return [{ text: assembleSystemPrompt(state) }]` to **fail loud** (throw a clear "master prompt missing" error). Rationale: today that branch is unreachable *and broken* — it infinitely mutually-recurses into a stack-overflow. A loud throw is strictly safer on the only path it can ever hit, and changes nothing on every reachable path.

**No-reader proof:** `assembleSystemPrompt` — only prod caller is `assemble.ts:593` (the `!master` branch). `STATE_REPORT_FORMAT_INSTRUCTION` used only at :693; `DIVIDER` only at :694; `loadStageSpec` only at :691; `loadEngineeredStagePrompt` only at :683. All others are tests.
**Runtime effect:** none on any reachable path (production never enters `!master`). The only observable change is on the impossible null-master path: stack-overflow → clear error.
**Tests:** update/remove `assemble.test.ts` cases that call `assembleSystemPrompt` or assert the fallback; add a test that a missing master throws rather than recurses (can mock `existsSync`).
**Rollback:** revert; the deleted `.md` files are restored from git (removal-before-deletion: the loader is removed first, then the files).
**No clinical behaviour change:** production model input is byte-identical; only unreachable/never-sent material is removed.

## A4 — Unused `'manual'` freeze source  (register, Doc 3 §3)
**Remove:** `lib/journey/safety/freeze.ts:15` — the `'manual'` member of `FreezeSource` (→ `'keyword_scan' | 'verifier' | 'state_report'`).
**No-caller proof:** `freezeJourney` is called exactly 3× (`route.ts:315,630,640`), sources `keyword_scan`/`state_report`/`verifier`; grep for `source: 'manual'` = zero.
**Runtime effect:** none. `composeReason` never received `'manual'`.
**Tests:** none reference `'manual'`; `tsc` confirms no caller breaks.
**Rollback:** revert one line.
**No clinical behaviour change:** type-only; no value path removed.

## A5 — Dead `originIdentified` / always-empty origin render  (register, Doc 3 §6)
**Remove (behaviour-preserving — the always-empty output path only):**
- `lib/journey/state/load.ts:235` — `originDescription: decryptOrNull(f.originDescriptionEncrypted),` (column never written → always `null`).
- `lib/journey/prompts/assemble.ts:346` — the `const origin = f.originDescription ? …` line, and drop the `${origin}` interpolation on `:347` (keep `- "${f.userDescription}" — ${phase}`).
**Optional (owner's choice — telemetry-only):** `lib/journey/stateReport/parse.ts:276` — `copyStringField(obj, 'originIdentified', report);`. Removing it drops the field from the audit blob (no clinical effect); **retaining it is harmless**. Recommend retain for now (audit capture), to keep PR A strictly non-telemetry-changing.
**Do NOT touch:** the `originDescriptionEncrypted` DB column (no migration); `lib/pilot/analytics.ts:1189,1199,1200` reads the raw column directly and is unaffected by the load-decrypt removal.
**No-reader/always-empty proof:** `save.ts` never writes `originDescriptionEncrypted` (grep: no `create`/`update` sets it); it is always NULL → `decryptOrNull(null)=null` → the `:346` ternary always takes `''` → the `(origin: "…")` suffix never renders.
**Runtime effect:** none — the removed render output was always empty.
**Tests:** if `bundle-b-fields.test.ts` asserts an origin render, update it (it should assert the suffix is absent, which is already the runtime reality).
**Rollback:** revert.
**No clinical behaviour change:** removed output was never produced.

## A6 — Documentation comments that misdescribe runtime shape  (comment-only)
**Correct (comments/JSDoc only — zero runtime effect):**
- `assemble.ts:2` ("Shared Core + active-stage spec…") and `:568-575` (JSDoc "Returns 5 blocks / Active stage spec") → describe the real **4-block, all-8-specs** shape.
- `schema.ts:265-268` (`bridgeAchievedAt` "Used by the gate…") and `:269-273` (`userGrounded` "Canon §10 requires this for every Stage 4 session close") → remove the false gate-consumption claims (no gate reads either; Stage 4 uses `compassionBridgeQuality`).
- `schema.ts:18-21` and `:363-366` (and sibling copies `parse.ts:350-351,527-528`) — "Router does NOT read this yet" for `moveJustPerformed` → **stale**; the move-based lane reads it (`move-based-advance.ts:76`, `router.ts:132`).
- `emission-reminder.ts:13` — the "~76k-token" figure is stale (predates all-8-specs loading).
**No-reader proof:** all are comments; `tsc`/runtime unaffected.
**Runtime effect / clinical change:** none (comments).
**Rollback:** revert.

### PR A completion gate
All six items land in one PR (they are all one bounded category: "proven-dead/inert"), guarded by recorded-harness parity + full test suite + typecheck. No runtime switch is needed because there is **no reachable behavioural change**; still, the harness diff is attached to the PR as proof.

---

# PR B — Approved visible-communication & anchor cleanup (LINE-LEVEL DIFF PROPOSAL)

**This is a proposal for owner line-review, not an implementation.** Governing
decisions: **D2** (anchor observation-only, never named, not auto-soothe/close)
and the **2026-07-20 `<communication>` decision** (#329) — both already
explicit, so no new owner decision is required; only owner sign-off on each
rewrite. Constraints honoured: **no broad distillation of the 8 specs; no batch
removal of complete clinical examples** — every edit is a surgical phrase-level
swap that **preserves the clinical move**. PR B edits the runtime prompt, so it
ships **behind the tester-only runtime switch** with a Golden-Harness before/
after (stock-phrase, restating-opening, concession, anchor-invocation metrics).

The `<communication>` standard the exemplars must conform to is
`journey-master.md:69-101` (assume-user-remembers; vary reply shape; validation
restraint; stock-phrasing ban `:78`; don't announce moves `:80`; keep reasoning
internal `:84`).

Rewrite rules (applied per line, owner-reviewed):
- **R1 — drop the stock wrapper, keep the content.** Remove "I hear you / I hear
  that / that sounds (difficult) / that's a real place / I'm curious / I'm
  wondering / Let's stay with that" openers; keep the sentence that does the
  clinical work.
- **R2 — mirror without labelling the anchor.** Replace "this is/that's your
  anchor" with the user's own word for the thing, no label (this is
  `journey-master.md:117`'s own rule).
- **R3 — anchor as ordinary context, not automatic soothe/close.** Reframe
  "the Anchor is recalled whenever intensity rises / as a soothe / to close"
  into "available as ordinary context when genuinely relevant"; keep the
  clinical option to reference it, drop the automatic/soothe framing.
- **R4 — ask, don't announce.** Replace "We're going to… / Let's do…" with the
  question itself (`:80`).
- **R5 — offer a hypothesis, don't declare origin.** Turn declarative
  origin-as-fact into the user-decides framing Stage 5 already uses elsewhere.

## Category A — Anchor named to the user (D2, R2) — 1 live line
- **`01-stage-stabilisation.md:214`**
  - Original: `7. **Name explicitly** (step 4). *"This is your anchor. The blanket. We can return to it whenever you need."*`
  - Proposed: `7. **Reflect in the user's own words, without labelling** (step 4). *"The blanket. We can come back to that whenever you need."*`
  - Clinical capability preserved: still offers a felt return-point in the user's language; drops the forbidden "anchor" label and the "name explicitly" instruction.
  - Supporting: D2; `journey-master.md:112,117`.
  - Regression fixture: a Stage-1 fixture where an anchor emerges → reply never contains "anchor"/"your anchor" (harness anchor-invocation = 0).
  - Rollback: revert this line.
- **`runtime/stage-01.md:173`** ("That's your anchor…") — **no PR B edit; this file is deleted by PR A A3** (deprecated runtime). Noted so it is not double-handled.

## Category D — False "anchor dropped from the gate" doc claims (D2 + audit) — 3 lines
These currently assert the gate no longer requires the anchor, which is **false
vs shipped code** (`stage-gates.ts:113,120-121`). Because the actual gate removal
is behavioural (PR C), PR B must **not** assert the gate is already gone.
Proposed interim-truthful rewrite (PR C later flips these to "removed"):
- **`01-stage-stabilisation.md:148`**
  - Original: `**Revised 2026-07-02: anchor requirement dropped from the Stage 1 gate.** … no longer a load-bearing gate token. …`
  - Proposed: `**Owner decision 2026-07-02: the anchor requirement is to be removed from the Stage 1 gate (scheduled: stage/progression reconciliation, PR C).** As of this document the Stage 1 code gate STILL enforces \`anchorText\`-set and the \`anchor_identified\` token (\`stage-gates.ts:113,120-121\`). The anchor is captured throughout Block 1 as data about the user (positive lived reality → Adult Self resource).`
- **`01-stage-stabilisation.md:106`** (same false "dropped from the Stage 1 code gate" claim) → same interim reframing (state "to be removed in PR C; currently enforced").
- **`01-stage-stabilisation.md:19`** ("the anchor is no longer a gate token") → "the anchor is scheduled to stop being a gate token (PR C); until then the gate still requires it."
- Clinical capability preserved: none affected (documentation truthfulness only).
- Supporting: D2; audit Doc 3 §7 / Doc 4 A1.
- Regression fixture: none (doc text); a doc-consistency check that no spec claims the anchor gate is already removed while `stage-gates.ts` still enforces it.
- Rollback: revert.
- **Sequencing note:** honours "remove from runtime before deleting from repo" — the doc stops *claiming* removal until PR C actually removes it.

## Category C — Stock validation / therapy phrasing (R1; dictated by #329) 
The ban is `journey-master.md:78`. **The master violates its own ban in its own
AI-voice examples — highest-priority, fully enumerated:**
- **`journey-master.md:486`** `You: "Heavy and tired. That's a real place to start from."` → `You: "Heavy and tired."` (receiving-the-state move preserved by naming it back; banned "that's a real place" dropped).
- **`journey-master.md:508`** `…What I'm curious about — when you look back at one of those moments, what does the part of you that messes it up actually seem to be doing?…` → `…When you look back at one of those moments, what does the part of you that messes it up actually seem to be doing?…` (question preserved; "What I'm curious about —" dropped).

**"I hear you / I hear that / I hear it" in AI-voice scripts — fully enumerated (7), R1:**
| line | original (excerpt) | proposed |
|---|---|---|
| `01-stage-stabilisation.md:173` | `"I'm here. I hear you. You don't have to be calm with me…"` | `"I'm here. You don't have to be calm with me…"` |
| `02-stage-pain.md:85` | `("…yes, I hear that")` | `("…there's a part of you that feels this")` (drop the "yes, I hear that" tail) |
| `03-stage-adult-self.md:292` | `"That voice is real. I hear that she's always there."` | `"That voice is real. She's always there."` |
| `07-stage-new-identity.md:264` | `"I hear that. Let's let this week pass before any big move…"` | `"Let this week pass before any big move…"` |
| `07-stage-new-identity.md:389` | `"I hear you. You've been feeling a lot this weekend…"` | `"You've been feeling a lot this weekend…"` |
| `journey-master.md:331` | `"You're furious / overwhelmed / done. I hear it. I'm not going to try to fix it."` | `"You're furious / overwhelmed / done. I'm not going to try to fix it."` |
| `journey-master.md:424` | `"You're furious. I hear it. I'm not going to argue with it."` | `"You're furious. I'm not going to argue with it."` |

- Excluded (NOT edited): the crisis-script "I hear how serious this is" (`00-shared-core.md:209`, `runtime/stage-01.md:104`, `runtime/stage-02.md:112`) — safety boilerplate, and the deprecated files are PR-A-deleted; and user-voice quotes.

**"That sounds like…" and "Let's stay with that" (owner-review, R1) — representative + full enumeration pattern.** The literal ban is "That sounds difficult"/"Let's stay with that"; some hits are legitimate reflective reads, so these are flagged **owner-review per line**, not auto-applied:
- Representative: `03-stage-adult-self.md:178` `"That sounds like the part that pushes you…"` → `"That's the part that pushes you…"`.
- Full sets to review: `rg -ni "that sounds|let.?s stay with|stay with that" <corpus>` — "That sounds" 7 hits, "stay with that" 13 hits (listed in the corpus scan). Each reviewed against R1; "stay with [specific felt thing]" that does real work is **kept**.
- Clinical capability preserved: reflective/anchoring move kept; only the stock opener changes.
- Supporting: #329 (`:78`).
- Regression fixture: harness `stock-phrase` metric (EN lexicon incl. "I hear", "that sounds", "that's a real place", "I'm curious/wondering", "stay with that") → 0 on the julia fixture; owner spot-review.
- Rollback: per-line revert.

## Category B — Anchor as automatic soothe / stabilise / close-recall (D2, R3)
**Largest surface (60+ lines); owner-reviewed per line; NOT batch-distilled.**
Two sub-classes:
- **B-script — AI-voice scripted auto-soothe lines** naming/reciting the anchor as an automatic opener. Representative, R2+R3:
  - `00-shared-core.md:193` `- The AI recalls it gently whenever intensity rises in any later stage: *"Take a moment with [the user's anchor, in their words]"*.` → `- When genuinely relevant, the AI may reference the thing in the user's own words as ordinary context — it is not recited automatically to soothe or stabilise.`
  - `02-stage-pain.md:118` `1. **Anchor recall.** Begin with a soft reference to the user's Anchor. *"Before we go any further, take a moment with [user's anchor…]…"*` → `1. **Optional grounding, only if the user is dysregulated and it fits.** If used, reference the thing in the user's own words; do not open every session with it.`
  - Same pattern for the other scripted "Take a moment with [anchor]" lines: `03:160,250`, `04:146,396`, `05:148,322` (and `runtime/stage-02.md:322` — PR-A-deleted).
- **B-method — spec sentences prescribing automatic anchor-recall-on-rising-intensity** (`02-stage-pain.md:23,51,63,96,114,147,227,247,264,281`; `03:192`; `07:200,373`; and the dense recall set enumerated by `rg -ni "anchor recall|recall(s|ed)? (it|the anchor)|anchor (is )?recalled|take a moment with" <corpus>`). Reframe from "recalled whenever intensity rises / as the steady reference of every session" → "available as ordinary context when genuinely relevant" per D2; **preserve** the anchor's internal observational value and the option to reference it.
- Clinical capability preserved: the anchor remains usable as genuine context; what is removed is the *automatic* soothe/stabilise/close invocation D2 forbids.
- Supporting: D2 ("not automatically invoked to soothe, stabilise or close… usable only as ordinary contextual material when genuinely relevant").
- Regression fixture: the julia session (which invoked the anchor formula repeatedly) → harness `anchor-invocation` metric drops to ~0 auto-recalls; a dysregulation fixture confirms grounding is still available when clinically indicated.
- Rollback: per-line revert; because this is the largest clinical surface, it may be split into its own sub-PR under PR B with its own harness gate (still one category: "anchor").
- **Explicit non-goal:** do not delete the anchor concept or the Stage-1 anchor-capture method; D2 preserves its internal value.

## Category F(ii) — Move-announcing (R4; dictated by #329 `:80`) — representative + pattern
- `03-stage-adult-self.md:161` `2. **Set the field.** *"We're going to try something gentle…"*` → `2. **Set the field by asking.** *"Can we try something gentle — nothing forced?"*`
- Full set: `rg -ni "we.?re going to|let.?s try|let.?s do|now we|i want to (try|ask)" <corpus>`, each reviewed against `:80` (keep the sanctioned share-back and consent forms like "Would you like to try something small?").
- Clinical capability preserved: the move still happens; it is asked, not announced.
- Supporting: #329 (`:80`).
- Regression fixture: harness who-leads/reply-quality; no "we're going to" openers in the julia fixture replies.
- Rollback: per-line.

## Category F(iii) — Declarative origin/diagnosis as fact (R5; #329 `:84`, D4) — Stage 5, enumerated (4)
Corpus norm already frames origin as a question; these are the stated-as-fact
exceptions:
- `05-stage-foreign-material.md:223` `*"That guilt isn't yours either…"*` → `*"Does that guilt feel like yours — or part of what came with the package?"*`
- `05-stage-foreign-material.md:367`, `:363`, `:328` — same reframing to the user-decides question Stage 5 uses elsewhere (`05:151,245`).
- Clinical capability preserved: the foreign-material distinction is still offered; it is the user's to confirm, not asserted.
- Supporting: #329 ("never diagnosed in real time"); D4 (working hypothesis, not fact).
- Regression fixture: live-arm `unsupported-hypothesis` / `conflation` judges ≤ baseline on the julia fixture.
- Rollback: per-line.

## Category F(i) — Mirror/echo openings (R1; #329 `:72,:74`) — representative + pattern
- Live representative: `03-stage-adult-self.md:178` and the master's "It sounds like you're feeling abandoned" example (`journey-master.md:550`) reviewed in context (some are negative/"Not:" examples — **keep** those; edit only positive AI-voice ones).
- Most "It sounds like…" instruction lines are in the **deprecated** `runtime/stage-01.md` (`:27,69,133,304`) — **PR-A-deleted**, so no PR B edit.
- Full set: `rg -ni "it sounds like|what i.?m hearing|so what i hear|if i.?m hearing|so what you.?re saying" <corpus>`, reviewed against `:72,:74` (keep the sanctioned formal share-back `journey-master.md:259`).
- Clinical capability preserved: reflection remains a tool "when it works, not as a rhythm" (`:86`); only the habitual echo-opener is trimmed.
- Supporting: #329 (`:72,:74,:86`).
- Regression fixture: harness `restating-opening` metric ≤ baseline.
- Rollback: per-line.

### PR B guardrails (restated)
- One category ("visible communication + anchor"); may split the large anchor
  category (B) into its own sub-PR with its own harness gate.
- Ships behind the tester-only runtime switch; Golden-Harness before/after
  attached; owner signs off **each** rewrite line (no reduction is assumed
  correct because it "reads similar").
- The 8 stage specs are **not** distilled or shortened; **no complete clinical
  example is removed** — every change is a phrase-level swap preserving the
  move.

---

*Planning only. No code or prompt edited; nothing removed; no PR opened. PR C
(stage/progression reconciliation) and PR D (bounded continuity-note fix) are
scoped in Doc 6's resolution map and will be planned line-by-line in the next
round, after PR A and PR B are approved.*
