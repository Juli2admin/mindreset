# SESSION HANDOFF — 2026-06-28

**Read this BEFORE CLAUDE.md.** Most recent operational state.
Supersedes the prior handoff (2026-06-04, which itself superseded the
2026-05-22 one — both archived in git).

---

## TL;DR — where we are

**The Journey 8-stage canon §10 audit is complete.** Eight small, focused
PRs landed today (#177–#184) — one per stage. Every stage gate in
`lib/journey/router/stage-gates.ts` now matches the documented method
in `docs/journey/0X-stage-*.md §10`. All 151 tests pass.

Owner ran two test sessions against the previous (buggy) gates and got
stuck at Stage 1 across 67 turns / 2 sessions because the code required
`formulation_confirmed` — a milestone invented in the master prompt's
`<assessment_phase>` but NOT in canon §10. That whole class of false-
negative gate is gone, plus seven other stage-specific tightening fixes.

**Next move: owner runs a fresh live test against the aligned gates.**
SQL to wipe Journey state (kept MiniMind untouched) was provided in chat
and is repeated under "Wipe SQL" below.

---

## What is working (verified by tests this session)

- **Stage 1 gate** (`checkStage1Gate`) — canon's 3 readiness tokens
  (anchor-identified, emotion-or-body-state-named, orientation-present)
  + looser safety guard (red_flag only blocks, watch passes per owner
  sign-off Option B).
- **Stage 2 gate** — three distinct conditions: emotion-named,
  emotion-located, soft-why-asked. Previous single-regex shortcut gone.
- **Stage 3 gate** — wired `adultSelfAnchorLinked` and
  `heldEmotionInAdultSelf` (existed in schema since PR 4, never gated).
- **Stage 4 gate (MII)** — MII-5 fallback now reads
  `partSecured.adultSelfOffering` (canon-named) instead of Stage 3's
  `adultSelfQualities` (wrong field).
- **Stage 5 gate** — wired `somaticRelease: true` and `bodyConfirmation`
  requirements. Without these the release / clean-identity statement
  were head-only and still passed.
- **Stage 6 gate** — adult self ≥ 70% across last 3 sessions added.
  Uses two new session helpers (4-hour boundary).
- **Stage 7 gate** — `safetyReorientation` tightened from "≥ 2 in window"
  to "present in EACH of last 2 sessions" (canon: every Stage 7
  session). Adult-self 70% across last 3 sessions added.
- **Stage 8 gate (Discharge)** — Identity Reinforcement Check-In wired:
  `adultSelfThisWeek` captured in each of last 4 sessions + "close" or
  "steady" in ≥ 3 of them.
- **Stage 8 unreachability bug fixed** — `standardGuards` was forcing
  `recommendedAction === 'advance'`; Stage 8 emits `'discharge'`. The
  gate was unreachable. Now `standardGuards` takes an `expectedAction`
  parameter.

All 151 vitest tests pass:
`cd mindreset-app && npm test`.

---

## What is broken / unverified

- **Live test of the new gates is the next step.** Tests pass; real
  session behaviour has not been verified yet. Owner about to run.
- **safetyFlag floor at intensity ≥ 7** — small follow-up identified
  but not built. The AI can currently emit `intensity: 8` with
  `safetyFlag: 'none'`. The schema doesn't enforce the obvious
  invariant. Worth a tiny PR.
- **`I lost my thread` parse error** — recurring bug across sessions,
  root cause not identified. Owner's previous test logs likely have
  reproductions. Investigate when convenient.
- **Family selection still drifting toward `regulation`** — partial fix
  in PR 8. Last test session showed 3 distinct families in Part 2; not
  yet a clean balanced distribution.
- **Practice ratio still low** — AI selectively emits `practiceRun`;
  some practices conducted in conversation don't get logged. PR 6
  emission mandate partially working.

---

## Today's PRs (chronological, all merged)

| PR | Stage | Title |
|---|---|---|
| #177 | 1 | Stage 1 gate — align with canon §10, remove invented `formulation_confirmed` |
| #178 | 2 | Stage 2 gate — require all three distinct canon conditions |
| #179 | 3 | Stage 3 gate — wire `adultSelfAnchorLinked` + `heldEmotionInAdultSelf` |
| #180 | 4 | Stage 4 MII-5 — read `partSecured.adultSelfOffering`, not Stage 3 `adultSelfQualities` |
| #181 | 5 | Stage 5 gate — require `somaticRelease` + `bodyConfirmation` |
| #182 | 6 | Stage 6 gate — require adult self ≥ 70% across last 3 sessions |
| #183 | 7 | Stage 7 gate — tighten `safetyReorientation` to every recent session + adult-self 70% |
| #184 | 8 | Stage 8 gate — wire Identity Reinforcement Check-In + fix unreachable gate |

`main` is at `2c91919` after #184.

---

## Wipe SQL (owner uses this before fresh test)

Run in Supabase SQL editor. Keeps MiniMind chat untouched (it lives on a
separate data path; The Journey reads `JourneyTurn`, not MiniMind
conversations).

```sql
BEGIN;
DELETE FROM "JourneyPracticeRun"    WHERE "userId" = (SELECT id FROM "User" WHERE email = 'jloya4436@gmail.com');
DELETE FROM "JourneyMessage"        WHERE "userId" = (SELECT id FROM "User" WHERE email = 'jloya4436@gmail.com');
DELETE FROM "JourneyTurn"           WHERE "userId" = (SELECT id FROM "User" WHERE email = 'jloya4436@gmail.com');
DELETE FROM "JourneyPart"           WHERE "userId" = (SELECT id FROM "User" WHERE email = 'jloya4436@gmail.com');
DELETE FROM "JourneyForeignFile"    WHERE "userId" = (SELECT id FROM "User" WHERE email = 'jloya4436@gmail.com');
DELETE FROM "JourneySignatureImage" WHERE "userId" = (SELECT id FROM "User" WHERE email = 'jloya4436@gmail.com');
DELETE FROM "RecodeProgress"        WHERE "userId" = (SELECT id FROM "User" WHERE email = 'jloya4436@gmail.com');
COMMIT;
```

After this owner is back to Stage 1 with no parts, no foreign material,
no audit log. `RecodeProgress` is recreated on next Journey turn.

---

## Deferred canon §10 items (each needs a schema field + emit instruction)

These were noted in the PR descriptions but not built. Each is its own
small PR — schema add → master prompt emit instruction → save.ts wire →
gate check → tests.

**Stage 6**
- `feltLikeMyself: string` — canon §10: "I feel like myself" on ≥ 2
  different days. No field exists. Currently implicit in
  `internalConsensus`.

**Stage 7**
- `identityAnchorRecalled: boolean` — canon §10: identity anchor recalled
  at least once per Stage 7 session. No field exists.

**Stage 8**
- `identityAnchorWeeklyUse: boolean` (or count) — canon §10: identity
  anchor used between sessions ≥ 1×/week. No field exists.
- `feelLikeMyselfAndKnowHowToLive: string` — canon §10: "I feel like
  myself, and I know how to live from here" on ≥ 2 different days. No
  field exists.
- `foreignMaterialReactivated: boolean` — canon §10: no active foreign
  material reactivation. No field exists.
- `partSeparatedInLastFourSessions: boolean` — canon §10: no part
  flagged as separate / unseen in last 4 sessions. No field exists.

The deferred items are NOT blocking for the live test. Without them the
gates are looser than canon in these specific ways, but the structural
"stuck at Stage 1" class of bug is fully fixed.

---

## What next session should know

### What owner most likely wants
1. **First, ask if she's done the live test** and what happened. The
   live test is the deliverable — code is ready, behaviour is not yet
   confirmed.
2. **If a real bug surfaced**: fix that. Don't propose deferred-item
   work until the live test is working cleanly.
3. **If live test is clean**: the safetyFlag-floor-at-7 PR is the next
   small high-value item. Then optionally the deferred §10 items above.

### Operating norms (load-bearing)
- Owner = Julia (`jloya4436@gmail.com` for testing,
  `loyayulia@gmail.com` for admin).
- GitHub MCP owner param is `Juli2admin` (capital J), repo `mindreset`.
- Owner says "merge" → agent clicks merge via
  `mcp__github__merge_pull_request`, squash. Then `git checkout main &&
  git pull && git branch -D <merged-branch>` and create next branch.
- **One PR per change**, small and focused. Do NOT bundle multiple
  stages, schema additions, or features into one PR. Owner explicitly
  prefers many small PRs over one big one.
- **No `git add -A`** — always specify files explicitly.
- **Migrations are manual** — never run `prisma migrate` against any env.
  If schema changes, propose the SQL in the PR body for owner to run.

### Working directory gotchas
- `npm test` MUST be run from `/home/user/mindreset/mindreset-app`,
  not the repo root. From repo root, prefix with `cd mindreset-app &&`.
- `git` commands run from `/home/user/mindreset` (repo root); file
  paths in `git add` are then `mindreset-app/lib/journey/...`.

### Key files for The Journey
- Gates: `mindreset-app/lib/journey/router/stage-gates.ts`
- Helpers: `mindreset-app/lib/journey/router/history.ts` (added today:
  `lastNSessionsTurns`, `countSessions`, `groupSessions`)
- Schema: `mindreset-app/lib/journey/stateReport/schema.ts`
- Persist: `mindreset-app/lib/journey/state/save.ts`
- Load: `mindreset-app/lib/journey/state/load.ts`
- Router: `mindreset-app/lib/journey/router/router.ts`
- Master prompt: `mindreset-app/docs/journey/runtime/journey-master.md`
- Canon §10 source of truth: `mindreset-app/docs/journey/0X-stage-*.md`

### Pattern for follow-up alignment PRs
The 8 PRs today all follow the same shape — repeat it:
1. Read canon §10 in the stage's doc.
2. Diff against `checkStageXGate` in `stage-gates.ts`.
3. Add missing canonical requirement(s) inline. Document the alignment
   in the function's docstring.
4. Write `stageX-gate.test.ts` with passing path + regression guard
   per new check + failure cases for existing checks.
5. Run `npm test` from `mindreset-app/`. All pass.
6. Commit + push + PR with the "Why / What changed / Tests / Migration"
   body.
7. Wait for owner "merge".

### Tone with this owner
- Tight. No multi-paragraph explanations. Short user-facing updates only.
- She's direct and reads diffs herself — don't over-explain code.
- She has caught me before being biased toward "easy work" and toward
  patches over solid fixes. If proposing the simpler of two options,
  call out why it's simpler-on-merits, not simpler-for-me.
- She will tell you when something is wrong. Take it directly, don't
  defend.
