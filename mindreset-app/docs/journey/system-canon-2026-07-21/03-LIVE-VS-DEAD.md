# Doc 3 — LIVE vs DEAD COMPONENTS

An inventory of what is live, deprecated-but-present, unreachable, duplicated,
and conflicting in the Journey runtime today. Where two generations coexist,
both are recorded; neither is declared correct.

Legend for state-report fields:
- **LIVE** — a gate/router/branch reads it and behaviour changes.
- **ECHO** — written and/or re-injected into the next prompt; shapes the next
  reply but gates nothing.
- **AUDIT-ONLY** — parsed and stored in the encrypted audit blob (and often the
  admin inspector), read by no runtime branch.
- **DEAD** — parsed but read by nothing at all, not even the inspector.

---

## 1. State-report fields (from a full reader-trace of `lib/` + `app/`)

### LIVE — consumed by gates / router
`intensity` (save.ts:44 → every gate) · `safetyFlag` (gates + freeze) ·
`recommendedAction` (gates + router.ts:67-109) · `adultSelfPresent` (Stages
3/4/6/7/8 + move lane) · `readinessTouched` (Stage 1/2) · `practiceRun`
(Stage 4 MII-3 + settling) · `partsTouched`→parts (Stage 4/6) ·
`foreignFilesTouched`/`foreignFileReleased`/`releaseConfirmed`/`releaseInvalidated`
(Stage 5) · `partSecured` (Stage 4 MII-5) · `anchorIdentified`→`anchorText`
(Stages 1-6) · `identityAnchor` (Stages 6/7/8) · `observerSeatTouched`,
`adultSelfQualities`, `adultSelfAnchorLinked`, `heldEmotionInAdultSelf` (Stage
3) · `compassionBridgeQuality`, `cohesionAwareness`, `mii6Check` (Stage 4) ·
`somaticRelease`, `bodyConfirmation`, `cleanIdentityStatement` (Stage 5) ·
`internalConsensus`, `selfLoyaltyStatement`, `oneSmallAction` (Stage 6) ·
`symbolicIdentityMap`, `emergingQualities`, `innerDirection`, `urgencyMarkers`,
`safetyReorientation` (Stage 7) · `calRunOn`, `calLayer`, `adultSelfThisWeek`,
`dischargeReadiness` (Stage 8) · `cycleStatus` (router open-cycle guard **and**
load.ts open-cycle signal) · `moveJustPerformed` (move-based advance lane,
move-based-advance.ts:76).

### ECHO — shapes the next prompt, gates nothing
`channel`→processingChannel + channel-family guidance (assemble.ts:202-207) ·
`patternsTouched`→JourneyPattern render (assemble.ts:365) ·
`userImagesCaptured`→signature-image render · `channelShiftDetected`→
recentChannelShift · `modalityRejected`→sessionRejectedModalities ·
`clinicalRead` — **only** read on an open-cycle turn (load.ts:432), rendered as
a ≤240-char continuity line (assemble.ts:268-270) · `continuityNote` (see §5) ·
`taskContract` (rendered assemble.ts:168; **no gate**) · `currentDepth` (see §4).

### AUDIT-ONLY — stored/inspected, read by no branch
`redFlagType` (a freeze-reason label; the freeze is triggered by `safetyFlag`,
not this) · `bridgeAchievedAt` (schema.ts:266 **claims** gate use — false) ·
`userGrounded` (schema.ts:270 claims Stage-4 close requirement — false) ·
`originIdentified` (also a dead write-target, §6) · top-level `whatStaysAsMine`
· `userReportedRedirection` · `feltAligned` · `feltOld` · `stabilityCheck`
(incl. `.score`).

### DEAD — parsed, read by nothing (not even the inspector)
`therapeuticMode` · `cycleCanClose` · `nextBestMode` (schema.ts:389 self-labels
"Advisory, not enforced") · `_raw` (parse-fallback marker).

---

## 2. Specific dead / inert verifications

- **`currentDepth` is permanently `'surface'`.** Every writer sets `'surface'`
  (start route, router advance/regress, page default). The only branch that
  could set `middle`/`deep` is `save.ts:116` `if (u.recommendedDepth)…`, but
  `recommendedDepth` is declared in the `Updates` type (save.ts:22) and
  **assigned nowhere** — the branch is unreachable. `currentDepth` is echoed to
  the prompt ("Current depth:", assemble.ts:201) and read by **no gate**.
- **`cycleCanClose`** — parsed (parse.ts:371-373), read back by nothing; the
  only textual occurrence in runtime code is an instruction *string* telling the
  model to emit it (assemble.ts:266). DEAD.
- **`stabilityCheck.score`** — parsed/clamped (parse.ts:331-347), read only by
  the admin inspector. The "`score < 6` → don't close" rule is prompt text,
  self-enforced by the model, never by code. AUDIT-ONLY.
- **`clinicalRead`** — the only functional reader is the open-cycle continuity
  echo (load.ts:432); no gate branches on it.

---

## 3. Deprecated-but-live code (present and executing, though its reason is gone)

- **`<assessment>` strip — vestigial-but-live in BOTH strip generations.** The
  master prompt no longer asks the model to emit `<assessment>` (owner decision
  D12, PR β), yet both the live-stream processor (reply-processor.ts:40-51) and
  the persist/reload splitter (parse.ts:43-53) still strip it. Retained
  deliberately as a defensive net (route.ts:406-415). Executes every turn.
- **`'manual'` freeze source** — defined in `FreezeSource` (freeze.ts:15),
  never passed to `freezeJourney` anywhere. Reserved for an admin surface that
  does not exist. Vestigial.
- **`recommendedDepth` branch** (save.ts:116) — see §2; unreachable dead branch
  keeping `currentDepth` alive as a type but not a behaviour.

---

## 4. Unreachable code (present, cannot execute on the live path)

- **`assembleSystemPrompt` fallback + mutual recursion.** If
  `loadMasterJourneyPrompt()` ever returned null, `assembleSystemPromptBlocks`
  returns `[{text: assembleSystemPrompt(state)}]` (assemble.ts:592-594), and
  `assembleSystemPrompt` calls `assembleSystemPromptBlocks` first thing
  (assemble.ts:676) → mutual infinite recursion. In production the master file
  exists, so none of this runs. The engineered-prompt fallback (assemble.ts:681-685)
  and the last-resort Shared-Core + `STATE_REPORT_FORMAT_INSTRUCTION` return
  (assemble.ts:688-694) are unreachable. `DIVIDER` (assemble.ts:455) is used
  only there. **NOT PROVEN to ever run; latent dead code.**
- **`loadStageSpec(stage)` single-active selection** (load-spec.ts:59-71) — the
  function that would load only the active stage's spec is called **only** in
  the unreachable fallback (assemble.ts:689-694), never on the live path (which
  loads all 8).
- **`loadEngineeredStagePrompt`** (load-spec.ts:137-149) and its two files
  `runtime/stage-01.md`, `stage-02.md` (only 2 of 8 exist) — documented
  "Deprecated in favour of loadMasterJourneyPrompt"; called only in the
  unreachable fallback (assemble.ts:683). Dead on the live path.

---

## 5. Duplicated / conflicting logic — TWO GENERATIONS COEXIST (both documented, neither adjudicated)

1. **Two stage-advance lanes.** Classic gate (requires
   `recommendedAction:'advance'`) and move-based lane (explicitly does not; also
   ignores anchors). Both live; classic first, move-based as same-pass fallback
   (router.ts:111-142; move-based-advance.ts:8-18).
2. **Two open-cycle definitions.** `load.ts` session-windowed `open|closing`
   (feeds the prompt) vs `router.ts:76` literal-last-turn `open`-only (gates
   routing). Different consumers; can disagree (Doc 2 §4).
3. **Two reply-strip generations.** Live-stream processor
   (reply-processor.ts) and persist/reload splitter (parse.ts
   splitReplyAndReport + stripPrivateTags). Intentionally duplicate the
   private-tag list; the persistence copy is the authority for reloads
   (parse.ts:136-139).
4. **Two state-report schemas.** Generation A (live): the master prompt's
   `<output_format>` (journey-master.md:609-760) — has `channel`,
   `clinicalRead`, `moveJustPerformed`. Generation B (vestigial):
   `STATE_REPORT_FORMAT_INSTRUCTION` (assemble.ts:31-104) — different shape
   (`adultSelfPresent`, `partsTouched`, `foreignFilesTouched`, `continuityNote`;
   **no** `clinicalRead`/`moveJustPerformed`), referenced only in the
   unreachable fallback. The emission reminder aligns with Generation A,
   confirming B is stale.
5. **Anchor: retired (prompt, in places) vs enforced (gate code).** The
   2026-07-02 owner retirement is not reflected in the gates
   (stage-gates.ts:113,121,154,202,248,332,405,478,583); simultaneously some
   prompt text still recalls the anchor as a soothe/close move. Both live.
6. **Analyse-before-speak vs reply-first.** The Sensitivity Layer's five silent
   questions are described as answered "before you write your reply" (D11), yet
   the runtime emits reply first / hidden report after in a single stream, and
   the master prompt forbids all reasoning tags (D12; journey-master.md:815).
   Both texts present.
7. **Anti-echo section vs echo exemplars.** The `<communication>` section
   (D19, #329) bans paraphrase/echo and "I hear you"; the surrounding specs
   model that exact voice across many exemplars (prior audits estimate a large
   exemplar-to-ban ratio). Both in the assembled prompt.

---

## 6. Dead write-targets (a field is emitted and "saved", but the save goes nowhere read)

- **`originIdentified` → `JourneyForeignFile.originDescription`.** `save.ts`
  never writes `originDescriptionEncrypted`; the only reference is the
  decrypt-on-load (load.ts:235). So the origin line rendered at assemble.ts:346
  is always empty, and the model's `originIdentified` emission persists only in
  the audit blob. Definite finding, not an uncertainty.

---

## 7. Documentation drift (comment/schema claims that the code contradicts)

- `assembleSystemPromptBlocks` docstring says **"Returns 5 blocks / active
  stage spec"**; the code returns **4 blocks with all 8 specs**
  (assemble.ts:566-588 vs 604-648). Same stale design language in the file-top
  and `assembleSystemPrompt` comments.
- `schema.ts:266` (`bridgeAchievedAt`) and `schema.ts:270` (`userGrounded`)
  claim gate consumption that no gate implements.
- `schema.ts:365` says the router "does NOT read `moveJustPerformed` yet" —
  **stale**: the move-based lane has read it since PR 4b.
- `journey-master.md:38` self-estimates "~3,200 tokens static" — stale; the
  real static system prompt is ~85 K tokens after the all-8-specs canon block.
- `emission-reminder.ts:11` estimates a "~76k-token cached system prompt";
  measured cached prefix (blocks 1+2) is ~74 K tokens, total ~85–86 K.

---

## 8. NOT PROVEN (evidence incomplete — flagged, not asserted)

- `practiceRun.userImages`/`triggeredBy`/`modalitySwitched`/`name`/`family`
  (JourneyPracticeRun child row) — no gate reader found, but not exhaustively
  traced through every analytics/admin surface. Likely AUDIT-ONLY; **NOT
  PROVEN** dead.
- Whether the model reliably emits tokens matching the gate regexes
  (`anchor_identified`, `emotion_named`, `soft_why`, …) is a behaviour question
  outside static reach; the *fields* are LIVE, token-match reliability is **NOT
  PROVEN** here.
- Whether the anchor-retirement PR (`4d08114`) ever existed cannot be confirmed
  from a read-only working tree; what **is** proven is that current code
  enforces the anchor.
