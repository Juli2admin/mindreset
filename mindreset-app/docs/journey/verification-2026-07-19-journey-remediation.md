# Journey Remediation — Verification Report (2026-07-19)

**Branch:** `claude/journey-remediation`
**Source-of-truth audits:** `audit-2026-07-19-clinician-narrowing.md`,
`audit-2026-07-19-runtime-clinical-decision-pathway.md` (+ `.json`),
`audit-2026-07-19-original-method.md`,
`docs/platform/audit-2026-07-19-product-routing-and-onboarding.md`.
**Scope guard:** Journey only. MiniMind, platform onboarding/routing, States &
Themes, pricing: **untouched** (verified — no file outside `lib/journey/`,
`app/admin/journey-inspect/`, `docs/journey/`, `prisma/schema.prisma`
Journey models, and this doc set was modified). Journey remains a deep
transformational product.

---

## 1. Implementation checklist (change → confirmed finding)

| # | Phase | Change | Finding(s) | Status |
|---|---|---|---|---|
| C1 | 1 | Obsolete `formulation_confirmed` gate claim corrected; demoted to signal token | RC7 / B10 | **done** |
| C2 | 1 | Stage 1 gate: anchor requirements removed | RC6 / SM7 / A2 | **done** |
| C3 | 1 | Anchor = clinically indicated across master + stage-01 + Clinical Manual revision note | SM7 / F5 | **done** |
| C4 | 1 | Token list corrected; `<purpose>` reference fixed | RC7 | **done** |
| C5 | 2 | Session task contract end-to-end (schema→parse→merge→persist→render→prompt) | RC2 | **done** |
| C6 | 3.1 | Standing cognitive→body redirects removed (assemble constant, master, stage-01 scoped, stage-02 softened, Example 3 rewritten) | RC4 / B2 / SM4 / F2 | **done** |
| C7 | 3.2 | Emotion/body evidence quota removed; emit-when-observed | RC3 / B1 | **done** |
| C8 | 3.3 | `NEXT_BEST_MODES` +10 modes | RC4 / A5 | **done** |
| C9 | 3.4 | Durable working preferences/refusals (persist, merge, render, clear-on-revision) | RC4 / A7 / RC11 | **done** |
| C10 | 4 | Route-first method; numb/low-access route; hierarchy de-reflexed; narrative family widened | RC1(partial) / B3 / SM3 / SM4 | **done** |
| C11 | 5 | Practice history rendered (last 10 + outcome) | audit#2 §4 | **done** |
| C12 | 5 | Repertoire report: `practice-repertoire-report-2026-07-19.md`; 10 manual-grounded exemplars restored | SM3 / F3 | **done** |
| C13 | 6 | Provisional vs confirmed release; invalidation reopens; gate counts confirmed only | A8 / B6 / RC5 | **done** |
| C14 | 7 | Open-cycle guard on advance + discharge | RC5 / A4 / fixture I | **done** |
| C15 | 8 | 8-question closure check; request-check in not-close conditions; no surface-marker closes; safe stopping point; mode-fitting closes | RC5 / B6 / B11 | **done** |
| C16 | 9 | Decision boundaries scoped (Shared Core §4, Trap 2, stages 06/07/08, Manual note) | DF1 / SM8 / F8 | **done** |
| C17 | 10 | Inspector: contract, preferences, release semantics, routing fields, outcome | audit#2 §13.9 | **done** |
| C18 | — | Fixtures A–I | brief | **done** |
| **C19** | — | **UNPLANNED CRITICAL FIX:** master-prompt loader truncation | new finding (see §3) | **done** |

---

## 2. Findings fixed → exact files changed

| Files | Changes |
|---|---|
| `lib/journey/router/stage-gates.ts` | Stage 1 gate: `anchorText` + `anchor_identified` checks removed (C2) |
| `lib/journey/router/router.ts` | Open-cycle guard: no advance (either lane) / no discharge while last turn reports `cycleStatus: 'open'` (C14) |
| `lib/journey/stateReport/schema.ts` | `TaskContract`, `WorkingPreferenceNote`, `releaseConfirmed`/`releaseInvalidated`, `practiceRun.outcome`, `NEXT_BEST_MODES` +10 (C5, C8, C9, C13) |
| `lib/journey/stateReport/parse.ts` | `parseTaskContract` (drops empty/generic), `parseWorkingPreferenceNoted`, release parsing, outcome parsing (C5, C9, C13) |
| `lib/journey/state/types.ts` | `StoredWorkingPreference`, `PracticeHistoryEntry`, `releaseClaimedAt`, state fields (C5, C9, C11, C13) |
| `lib/journey/state/save.ts` | `mergeTaskContract`, `mergeWorkingPreferences` (pure, exported); release claim/confirm/invalidate handlers (C5, C9, C13) |
| `lib/journey/state/load.ts` | Contract + preferences + practice-history loading; `releaseClaimedAt` (C5, C9, C11) |
| `lib/journey/audit/log.ts` | Persist `practiceRun.outcome` (C11) |
| `lib/journey/prompts/assemble.ts` | Contract rendered first; preferences; practice history; provisional/confirmed labels; cognitive channel guidance rewritten (C5, C6, C9, C11, C13) |
| `lib/journey/prompts/load-spec.ts` | **Outer-fence extraction fix** (C19) |
| `prisma/schema.prisma` | 4 nullable columns (see §5 migration note) |
| `docs/journey/runtime/journey-master.md` | C1, C3, C4, C5, C6, C7, C10, C13, C15, C16 prompt work |
| `docs/journey/00-shared-core.md` | §4 decision boundaries; §10 mode-fitting close + request check (C15, C16) |
| `docs/journey/01-stage-stabilisation.md` | Anchor indication note; thought-to-body scoped (C3, C6) |
| `docs/journey/02-stage-pain.md` | Cognitive body-drop made optional single offer (C6) |
| `docs/journey/06/07/08-stage-*.md` | Decision prohibitions scoped to committing/impulsive (C16) |
| `docs/journey/CLINICAL_MANUAL.md` | Owner-directed revision notes: Anchor rule + decision scoping (C3, C16) — original text preserved verbatim |
| `app/admin/journey-inspect/page.tsx` | Progress card: taskContract + workingPreferences; captures: new fields; practice outcome (C17) |
| Tests | `stage1-gate.test.ts` (rewritten cases), `open-cycle-guard.test.ts` (new), `remediation-fixtures.test.ts` (new, fixtures A–I), `state-block.test.ts` (fixture A), 10 test factories extended |

## 3. Behaviour before → after (per defect)

1. **Anchor (RC6/SM7).** Before: a user with no qualifying anchor material could
   never pass the Stage 1 classic gate; code contradicted revised canon. After:
   gate reads emotion-or-body + orientation + guards only; anchor work remains
   fully available and is explicitly indicated for freeze/numbness/
   disconnection/destabilisation. Canon, prompt, gate and tests agree.
2. **`formulation_confirmed` (RC7).** Before: prompt claimed the token gates
   Block 1→2 (false since PR #177), pressing the model to extract a scripted
   confirmation. After: signal token; the share-back stays clinically required.
3. **Task contract (RC2).** Before: the user's request existed nowhere; closure
   and intervention selection never saw it. After: inferred from the user's
   language, merged field-wise (empty/generic can never erase it), rendered at
   the top of the clinician context, checked before intervention and before any
   close; emerging material shifts `currentFocus` without replacing
   `presentingRequest`.
4. **Cognitive users (RC3/RC4/B2/SM4).** Before: standing "invite body location
   so the work does not stay in the head" + per-turn emotion/body token quota +
   an example teaching analysis→parts conversion. After: cognition is a valid
   primary mode with an authored toolkit (belief examination, sentence
   deconstruction, pattern comparison, values clarification); tokens emit when
   observed, never elicited; body offered at most once on live activation;
   `stay_cognitive` expressible.
5. **Numb users.** Before: hierarchy routed "numb" to grounding loops; no
   working route without emotion/body data. After: numb/low-access route
   (narrative, behavioural evidence, cognitive mapping); move-based lane
   documented as the progression path without tokens (fixture C proves it).
6. **Preferences (A7/RC11).** Before: refusals wiped every 4 h. After: durable,
   revisable working preferences persisted on RecodeProgress, rendered every
   turn, cleared only by explicit user revision.
7. **Release (A8/B6).** Before: `releasedAt` stamped on the model's claim; gate
   counted it. After: claim stamps `releaseClaimedAt` (provisional, labelled so
   in context); only user-confirmed `releaseConfirmed` stamps `releasedAt`;
   `releaseInvalidated` reopens; Stage 5 gate unchanged in code but now counts
   only confirmed releases (fixture F).
8. **Progression (RC5).** Before: gates could advance mid-activation. After:
   open cycle blocks advance and discharge on both lanes; regression unaffected.
9. **Closure (RC5/B6/B11).** Before: release-shaped close conditions; calm
   sessions closable with the request untouched. After: 8-question silent close
   check; request addressed-or-parked added to not-close conditions;
   do-not-close-merely-because list; containment/safe-stopping-point protocol;
   cognitive sessions may close cognitively; no forced positive endings.
10. **Decisions (DF1/SM8).** Before: blanket prohibition. After: never decide/
    prescribe/advise; examining parts, beliefs, fears, values and repeated
    patterns inside a user-brought decision permitted; impulsivity guards fully
    retained; no decision-facilitation methodology claimed (none exists in canon).
11. **C19 — loader truncation (new critical finding).** Before: the runtime
    prompt silently ended at the first inner code fence — the five silent
    questions, ALL sensitivity-layer hard rules and the failure-mode example
    never reached the model in production (likely a major contributor to the
    pilot behaviour the audits attributed to prompt pressure alone). After: the
    loader closes at the outer fence; the full authored prompt ships.

## 4. Tests

- Baseline before remediation: **608 passed / 0 failed** (36 files).
- After remediation: **642 passed / 0 failed** (38 files).
- New: `open-cycle-guard.test.ts` (5), `remediation-fixtures.test.ts` (28 across
  fixtures A–I + decision boundaries), rewritten Stage-1 anchor cases,
  fixture-A state-block case. `npm test` run after every phase; all green at
  every phase boundary.

## 5. Migration note (Julia runs manually in Supabase SQL editor — per policy, never `prisma migrate`)

Run BEFORE merging/deploying this branch (all columns nullable — no backfill,
no data risk; existing rows unaffected):

```sql
ALTER TABLE "RecodeProgress"     ADD COLUMN "taskContractEncrypted"       TEXT;
ALTER TABLE "RecodeProgress"     ADD COLUMN "workingPreferencesEncrypted" TEXT;
ALTER TABLE "JourneyForeignFile" ADD COLUMN "releaseClaimedAt"            TIMESTAMP(3);
ALTER TABLE "JourneyPracticeRun" ADD COLUMN "outcome"                     TEXT;
```

Grandfathering: rows with an existing `releasedAt` remain **confirmed** releases
(historical data was recorded under the old semantics; retro-demoting them would
regress real users' progress). Only new releases go through claim→confirm.

## 6. Remaining limitations

- The task contract and closure discipline are prompt+state mechanics; their
  conversational quality needs live-session verification (the audits' §10
  transcript export remains outstanding).
- `releaseConfirmed` relies on the model honouring "later turn only" — code
  cannot distinguish same-turn confirmation abuse beyond the prompt rule.
  Observable in the Inspector; tighten in code later if production shows abuse.
- Preferences cap at 10; no UI for the user to view/edit their own preferences.
- The stage-02 gate still requires `body_located`-class evidence for Stage 2→3
  classic advancement (canon §10 unchanged — owner decision needed to revise
  canon; move lane remains the numb user's path).
- Practice `outcome` starts unpopulated for all historical rows.

## 7. Missing authored Practice Library material

See `practice-repertoire-report-2026-07-19.md`: 43 operational, 10 restored
this remediation, 20 safely derivable, **23 NEEDS-JULIA** (not implemented, per
the stop condition). Also still unauthored: existential/meaning work, life
mapping, writing practices, full decision-facilitation methodology.

## 8. Unresolved product decisions

1. Stage-2 gate evidence for numb users (canon §10 revision?) — see §6.
2. Whether the Clinical Manual revision notes should be folded into the body
   text (a docx round-trip) or remain as the marked revision block.
3. Anchor rule in the manual: STEP 5 / §14 original text still reads
   "mandatory" — superseded by the header revision note; full-text rewrite
   awaits Julia.
4. Platform items deferred: pilot grant flow, MiniMind catalog, cross-product
   memory bridge (P1–P6 of the platform audit).

## 9. Confirmation of scope

MiniMind (`lib/minimind/`, prompt, memory), platform onboarding/screening,
States & Themes, pricing/checkout: **no changes**. `git diff main --stat` shows
only Journey lib/docs/tests, the Journey inspector page, `prisma/schema.prisma`
(4 Journey-model columns), and the audit/verification docs.
