# The Journey — Engineering Plan v1

> Plan for building the runtime for The Journey, on top of the nine clinical specifications in `mindreset-app/docs/journey/`. MiniMind stays untouched. The Journey is a parallel system on its own code paths.
>
> **Status:** draft for owner sign-off before any code is written.

---

## 0. Principles

- **Code follows the specs.** Every behaviour in this build traces back to a numbered section of the nine clinical specs. If something is not in the specs, it does not get built.
- **MiniMind is untouched.** No imports from `lib/minimind/*`. We mirror patterns where useful; we do not share modules.
- **Slice by slice.** Each PR is small and testable. We never carry an unfinished half-feature across PRs.
- **Schema migrations are proposed, not run.** Per `CLAUDE.md`, every schema change ships as copy-pasteable SQL in the PR body; Julia runs it in Supabase manually.
- **The 8 stages are internal.** No URL exposes a stage name. No UI text mentions stages, blocks, transitions, or completion gates. The user sees one continuous space.
- **British English in all AI output.**

---

## 1. Architecture Summary

The deterministic-code + LLM-brain split from the original brief, made concrete:

### What code does (per turn)
1. Authenticates the user (Clerk).
2. Verifies the user has access to The Journey (active `Purchase` row with `productType: "recode"`).
3. Loads the user's current Journey state (stage, depth, anchor, channel, parts, foreign files, signature images, recent intensity, safety history).
4. Assembles the system prompt: Shared Core + active-stage spec + injected state block (anchor in user's words, Adult Self qualities, parts known, depth permissions, completion criteria for current stage).
5. Loads recent conversation history (most recent N turns, encrypted).
6. Calls Claude with streaming.
7. Splits the response into (a) human reply streamed to user, (b) hidden JSON state report.
8. Parses + validates the state report (fail-safe defaults if parse fails).
9. Runs safety checks: keyword scan + (async) verifier pass.
10. Applies gate logic: should the user stay, advance, regress, or be frozen?
11. Persists updated state.
12. Writes one row to the audit log.
13. Schedules the 48-hour check if a Deep Layer contact was made (Stage 4) or a Deep Layer release happened (Stage 5).

### What the LLM does (per turn)
- Receives the assembled prompt + state + history.
- Generates a warm human reply (streamed to user).
- Generates a hidden JSON state report (parsed by code).
- Never decides stage transitions, never edits its own state, never controls the gates.

### Reused patterns from MiniMind (patterns only, not imports)
- Anthropic SDK setup + streaming response shape.
- Encryption helpers (`lib/encrypt.ts` — shared utility, safe to import).
- Auth pattern (Clerk).
- Billing / rate-limit pattern.
- Dual-source-of-truth for prompts (`.md` in `docs/`, runtime constant in `lib/`).

### New patterns (Journey-specific)
- Per-stage prompt assembly (Shared Core + stage spec + state injection).
- State report parser + validator.
- Stage-aware gate logic (router).
- Stage-aware safety pipeline (Red Flag triggers differ slightly per stage's depth).
- 48-hour delayed-check infrastructure.
- Persistent inner landscape (anchor, parts, foreign files, signature images — all in user's exact words).
- Append-only audit log of every turn and every practice run.

---

## 2. File Structure

```
mindreset-app/
  docs/journey/                           # nine specs — LOCKED, source of truth
    00-shared-core.md
    01-stage-stabilisation.md
    ...
    08-stage-embodiment.md
  docs/implementation/
    journey-build-plan.md                 # this document

  lib/journey/                            # NEW — all Journey runtime code
    prompts/
      shared-core.ts                      # runtime constant, mirrors 00-shared-core.md
      stage-01.ts                         # runtime constant, mirrors 01-stage-stabilisation.md
      stage-02.ts
      ...
      stage-08.ts
      assemble.ts                         # composes Shared Core + active stage + state block
    state/
      load.ts                             # load Journey state for a user
      save.ts                             # persist updates
      types.ts                            # TypeScript types for state
    router/
      router.ts                           # gate logic, stage advancement, regression
      stage-gates.ts                      # one function per stage with its completion criteria
    stateReport/
      schema.ts                           # JSON schema for the state report
      parse.ts                            # parse + validate, fail-safe defaults
    safety/
      keywords.ts                         # Journey-specific Red Flag keyword set
      verifier.ts                         # Journey-tuned second-LLM safety pass
      freeze.ts                           # freeze-for-review flow
    audit/
      log.ts                              # append one row per turn
    delayedCheck/
      schedule.ts                         # set up 48-hour stability check
      run.ts                              # the check itself (invoked at next session start)

  app/api/journey/                        # NEW — Journey API surfaces
    turn/route.ts                         # the per-turn endpoint
    state/route.ts                        # read-only: current state for UI
    start/route.ts                        # initialise Journey on first entry

  app/[locale]/journey/                   # NEW — Journey UI
    page.tsx                              # the entry surface (one continuous space)
    JourneyClient.tsx                     # chat client component
    components/
      MessageList.tsx
      Composer.tsx
      AnchorBadge.tsx                     # soft sidebar element showing the user's anchor
                                          # in their own words (read-only)

  prisma/schema.prisma                    # EXTEND — add fields + new tables (SQL in PR body)
```

---

## 3. Schema Changes (SQL proposed, run manually by Julia)

### 3.1 Extend `RecodeProgress`

All user-words fields are stored encrypted at rest using `lib/encrypt.ts` (same pattern as MiniMind messages). The `mii` JSON field holds the full state of all seven MII criteria so they are visible in one place for clinical review.

```sql
ALTER TABLE "RecodeProgress"
  ADD COLUMN "anchorTextEncrypted"        TEXT,
  ADD COLUMN "anchorSetAt"                TIMESTAMP(3),
  ADD COLUMN "identityAnchorEncrypted"    TEXT,
  ADD COLUMN "identityAnchorSetAt"        TIMESTAMP(3),
  ADD COLUMN "adultSelfQualitiesEncrypted" TEXT,
  ADD COLUMN "processingChannel"          TEXT,
  ADD COLUMN "currentStage"               INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN "currentDepth"               TEXT        NOT NULL DEFAULT 'surface',
  ADD COLUMN "lastIntensity"              INTEGER,
  ADD COLUMN "lastIntensityAt"            TIMESTAMP(3),
  ADD COLUMN "lastDeepLayerContactAt"     TIMESTAMP(3),
  ADD COLUMN "mii"                        JSONB       NOT NULL DEFAULT '{}',
  ADD COLUMN "stage8WeeksElapsed"         INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN "frozenForReview"            BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN "frozenAt"                   TIMESTAMP(3),
  ADD COLUMN "frozenReason"               TEXT,
  ADD COLUMN "dischargedAt"               TIMESTAMP(3),
  ADD COLUMN "continuityNoteEncrypted"    TEXT;
```

The `mii` JSON shape:
```json
{
  "mii1_adultSelfStability": { "status": "met" | "pending" | "failed", "lastChecked": "ISO8601", "score": 0.0-1.0 },
  "mii2_partRecognition":    { "status": "...", "partInUserWordsEncrypted": "..." },
  "mii3_noOverwhelm":        { "status": "...", "lastOverwhelmAt": "ISO8601 | null" },
  "mii4_safeRelationship":   { "status": "...", "quality": "compassion|curiosity|acceptance|willingness_to_comfort" },
  "mii5_reparentingCapacity":{ "status": "...", "offeringInUserWordsEncrypted": "..." },
  "mii6_noDestabilisation":  { "status": "...", "lastCheckedAt": "ISO8601" },
  "mii7_internalCohesion":   { "status": "...", "userWordsEncrypted": "..." }
}
```

(The existing `currentBlock` column stays for compatibility but is no longer authoritative — `currentStage` is. We can drop `currentBlock` in a later cleanup PR.)

### 3.2 New table — `JourneyTurn` (append-only audit log)

Operational metadata is queryable in plain columns (no user content); the full state report blob — which may contain user-words content — is encrypted.

```sql
CREATE TABLE "JourneyTurn" (
  "id"                       TEXT          PRIMARY KEY,
  "userId"                   TEXT          NOT NULL,
  "createdAt"                TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stageAtTurn"              INTEGER       NOT NULL,
  "depthAtTurn"              TEXT          NOT NULL,
  "intensityReported"        INTEGER,
  "safetyFlag"               TEXT          NOT NULL DEFAULT 'none',
  "redFlagType"              TEXT,
  "recommendedAction"        TEXT,
  "stateReportEncrypted"     TEXT,
  "userMessageHash"          TEXT,
  CONSTRAINT "JourneyTurn_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "JourneyTurn_userId_createdAt_idx" ON "JourneyTurn"("userId", "createdAt");
```

### 3.3 New table — `JourneyPracticeRun`

```sql
CREATE TABLE "JourneyPracticeRun" (
  "id"                  TEXT          PRIMARY KEY,
  "userId"              TEXT          NOT NULL,
  "turnId"              TEXT          NOT NULL,
  "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stageAtRun"          INTEGER       NOT NULL,
  "kind"                TEXT          NOT NULL,
  "name"                TEXT          NOT NULL,
  "family"              TEXT,
  "triggeredBy"         TEXT,
  "userImages"          TEXT,
  "depth"               TEXT,
  "status"              TEXT          NOT NULL,
  "modalitySwitchedFrom" TEXT,
  "modalitySwitchedTo"   TEXT,
  CONSTRAINT "JourneyPracticeRun_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "JourneyPracticeRun_turnId_fkey" FOREIGN KEY ("turnId")
    REFERENCES "JourneyTurn"("id") ON DELETE CASCADE
);
CREATE INDEX "JourneyPracticeRun_userId_idx" ON "JourneyPracticeRun"("userId");
```

### 3.4 New table — `JourneyPart` (parts known per user, in user's words)

User-words fields encrypted at rest.

```sql
CREATE TABLE "JourneyPart" (
  "id"                            TEXT          PRIMARY KEY,
  "userId"                        TEXT          NOT NULL,
  "createdAt"                     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userDescriptionEncrypted"      TEXT          NOT NULL,
  "channel"                       TEXT,
  "safeDistanceEncrypted"         TEXT,
  "compassionBridgeQuality"       TEXT,
  "currentRestingPlaceEncrypted"  TEXT,
  "active"                        BOOLEAN       NOT NULL DEFAULT TRUE,
  CONSTRAINT "JourneyPart_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "JourneyPart_userId_idx" ON "JourneyPart"("userId");
```

### 3.5 New table — `JourneyForeignFile`

User-words fields encrypted at rest.

```sql
CREATE TABLE "JourneyForeignFile" (
  "id"                            TEXT          PRIMARY KEY,
  "userId"                        TEXT          NOT NULL,
  "createdAt"                     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "identifiedAt"                  TIMESTAMP(3),
  "releasedAt"                    TIMESTAMP(3),
  "userDescriptionEncrypted"      TEXT          NOT NULL,
  "originDescriptionEncrypted"    TEXT,
  "returnedToEncrypted"           TEXT,
  "honouringPhraseEncrypted"      TEXT,
  "whatStaysAsMineEncrypted"      TEXT,
  CONSTRAINT "JourneyForeignFile_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "JourneyForeignFile_userId_idx" ON "JourneyForeignFile"("userId");
```

### 3.6 New table — `JourneySignatureImage`

User-words field encrypted at rest.

```sql
CREATE TABLE "JourneySignatureImage" (
  "id"                            TEXT          PRIMARY KEY,
  "userId"                        TEXT          NOT NULL,
  "createdAt"                     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userDescriptionEncrypted"      TEXT          NOT NULL,
  "context"                       TEXT,
  CONSTRAINT "JourneySignatureImage_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "JourneySignatureImage_userId_idx" ON "JourneySignatureImage"("userId");
```

### 3.7 New table — `JourneyMessage`

The conversation surface needs its own encrypted message store, separate from MiniMind's `Conversation` + `Message` tables.

```sql
CREATE TABLE "JourneyMessage" (
  "id"                  TEXT          PRIMARY KEY,
  "userId"              TEXT          NOT NULL,
  "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "role"                TEXT          NOT NULL,
  "contentEncrypted"    TEXT          NOT NULL,
  "stageAtTime"         INTEGER       NOT NULL,
  CONSTRAINT "JourneyMessage_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "JourneyMessage_userId_createdAt_idx" ON "JourneyMessage"("userId", "createdAt");
```

---

## 4. Build Sequence

Six slices. Each one is a PR. Each ends in a working, testable state.

### Slice 1 — Foundation (schema + prompt assembly + a turn that runs)
**Goal:** the simplest end-to-end loop. A test script calls the turn endpoint, gets a Stage 1 response back, sees the state persisted.

- Propose schema migrations (SQL in PR body, no Prisma migrate).
- Extend `prisma/schema.prisma` to match.
- Create `lib/journey/prompts/{shared-core,stage-01}.ts` — runtime constants mirroring the `.md`.
- Create `lib/journey/prompts/assemble.ts` — composes prompt with state injection.
- Create `lib/journey/state/{load,save,types}.ts`.
- Create `lib/journey/stateReport/{schema,parse}.ts` — fail-safe defaults.
- Create `lib/journey/audit/log.ts`.
- Create `app/api/journey/turn/route.ts` — Anthropic call, streaming, parse, persist, log. Reuses the streaming response shape from MiniMind.
- Create `app/api/journey/start/route.ts` — initialise `RecodeProgress` for a paid user on first entry.
- Write a test script (`scripts/journey-smoke.mjs`, gitignored) that POSTs to `/api/journey/turn`.

**Out of scope for Slice 1:** UI, safety verifier (use keyword-only for now), Stage 2-8 prompts (use stubs), 48-hour check, bilingual.

### Slice 2 — Safety
- Create `lib/journey/safety/{keywords,verifier,freeze}.ts`.
- Wire the Red Flag protocol into the turn endpoint.
- Frozen-for-review state: when triggered, code shifts to the canned crisis response (verbatim from Shared Core §7) and refuses method work until cleared.
- Manual "clear freeze" path: admin SQL update (no UI yet — out of scope per `CLAUDECODEBRIEF.md` §6 phase 1).

### Slice 3 — UI
- Create `/journey` page, gated on `Purchase` row.
- Chat surface mirroring MiniMind's visual pattern.
- Anchor badge (soft sidebar element showing the user's anchor in their own words once set).
- No stage names, no progress indicators, no clinical scaffolding visible.
- Sign-up / purchase flow still routes through existing `/pricing`.

### Slice 4 — Stages 2–8 prompt content
- Create `lib/journey/prompts/stage-02.ts` through `stage-08.ts` mirroring the respective `.md` files.
- Create `lib/journey/router/{router,stage-gates.ts}` — the gate logic for each stage's completion criteria, as specified in §10 of each spec.
- Create `lib/journey/delayedCheck/{schedule,run}.ts` — the 48-hour check infrastructure (honour-system version: timestamp checked server-side at start of next session, AI asks the check-in question in natural language).

### Slice 5 — Audit log review tooling
- A simple admin page (under `/admin`) that lets Julia inspect a user's journey: stage progression, practice runs, state reports, safety events, foreign material released, parts identified.
- No write functionality. Read-only audit surface for clinical review.

### Slice 6 — Bilingual
- Detect EN/RU from first message.
- Persist `language` on `RecodeProgress`.
- Localised crisis lines (RU equivalents — Julia provides numbers).
- Claude handles natural-language switching; the prompt is mostly EN with a switch instruction at the top.
- Per `CLAUDE.md` i18n rules: en + ru native; fr/de/es/it/pl/pt deferred for The Journey (the existing app translation pipeline handles app chrome; AI dialogue itself stays EN+RU only for v1).

---

## 5. Testing Strategy

Three layers of tests.

### 5.1 Prompt fidelity (the hardest and most important)
- A set of test conversations as fixture data, each labelled with what the AI should and shouldn't do.
- Run them against the assembled prompt + Claude, capture the response, assert against the spec rules:
  - No diagnosis spoken to user.
  - No interpretation of user's images.
  - No imposed imagery.
  - No advice / plans / homework beyond what each stage allows.
  - No mention of stage names, numbers, or transitions.
  - Anchor recalled in user's exact words when present.
  - Identity Anchor used after Stage 6.
- Run nightly or on every prompt change. Failures get reviewed manually — these are signal, not always block.

### 5.2 Gate logic (deterministic, easy to test)
- Unit tests for each stage's completion gate function.
- State fixtures that should pass, should fail, edge cases.
- 48-hour gate specifically tested with mocked timestamps.

### 5.3 State report parsing
- Valid reports → parse cleanly.
- Missing fields → fail-safe defaults applied.
- Invalid JSON → log + fall back.
- Hostile / manipulated reports → ignored, audit log notes the inconsistency.

---

## 6. Out of Scope for Phase 1 (deferred to phase 2)

- Discharge after-care follow-up cadence (2 weeks / 1 month / 3 months / 6 months).
- Integration with MiniMind as an entry funnel.
- Human-reviewer console for `frozen_for_review` users (the freeze flow itself ships in Slice 2; the review UI is deferred).
- States & Themes modules (separate product, separate AI behaviour per `STATES_AND_THEMES` spec — different conversation entirely).
- Languages beyond EN + RU.
- Multimodal input (audio, image) — deferred.

---

## 7. Non-negotiables (carried forward from `CLAUDECODEBRIEF.md` §8)

1. Code, not the LLM, controls stage transitions.
2. Every turn writes one audit-log entry.
3. Red Flag → freeze, immediately, every time. No retries, no soft fail.
4. A human-review pathway must exist to clear `frozen_for_review`. For Slice 2 this is a manual SQL update by Julia; the UI for it is phase 2.
5. State data is special-category health data under UK GDPR. Encrypted at rest and in transit. Documented retention. Right to erasure honoured.
6. No trauma detail is ever stored. Labels and user's own words only.
7. The state report JSON is never shown to the user. Stripped before display.
8. Backwards regression preserves accumulated state.
9. The 48-hour check is enforced in code.
10. Bilingual now (EN/RU); architecture must accept additional languages cleanly.

---

## 8. Recommended Starting Slice

**Slice 1** as defined in §4. Tiny scope. End-to-end loop working. No UI yet — testable via a script. Once that's running, the engineering pattern is proven and the remaining slices are mostly mechanical.

The PR will contain:
- The SQL migration block in the body (Julia runs in Supabase).
- The Prisma schema changes.
- The minimum code to make one Stage 1 turn work end-to-end.
- A small test script (gitignored) for Julia to invoke if she wants to see it run.

Estimated size: ~600–800 lines of TypeScript across the new files, plus the SQL block.

---

## 9. What I Need from You to Start Slice 1

Three small confirmations:

1. **Approve this plan, or flag what to change.** Particularly: the schema additions in §3, the file structure in §2, the slice sequence in §4.

2. **Confirm the route for the Journey UI.** I've assumed `/journey` (gated on Purchase). Some products use `/the-journey` or similar. Your call.

3. **Confirm Anthropic model choice for The Journey.** MiniMind uses `claude-sonnet-4-6`. The Journey is a substantially more sophisticated AI behaviour. Three options:
   - **Same model (Sonnet 4.6)** — proven; you know the costs and behaviour shape.
   - **Opus 4.x** (currently `claude-opus-4-7` is available, with `claude-opus-4-8` being the newest) — more capable, materially more expensive per turn. Justifiable for The Journey given the clinical depth required, but cost matters at scale.
   - **Sonnet for Stages 1–3 + 8; Opus for Stages 4–7** — the deepest clinical work uses the strongest model. More complex to manage but cost-aware.

   My recommendation: **Sonnet 4.6 for v1**, with the architecture leaving model swap easy per stage. We measure prompt fidelity in production and upgrade specific stages to Opus if Sonnet falls short. Cheaper to start, easy to change.

Once you answer these three, I open Slice 1 as a PR with the SQL block in the body and the code on the feature branch.
