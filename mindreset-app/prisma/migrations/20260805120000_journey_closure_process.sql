-- Activated Closure — Phase 1 (2026-08-05).
-- Server-owned process state for the Activated Session Closure Protocol.
--
-- RUN MANUALLY in the Supabase SQL editor. Not executed by the agent, and
-- never via `prisma migrate` / `prisma db push` (project migration policy).
--
-- Safe to run before OR after the code merge:
--   * before  — the columns exist and default to NONE; nothing reads them yet.
--   * after   — Prisma would error on the missing columns, so prefer BEFORE.
-- Recommended order: run this first, then merge.
--
-- Purely ADDITIVE. Seven nullable/defaulted columns on an existing table.
-- No existing column is altered, no row is rewritten, no data is backfilled
-- and JourneyTurn is not touched at all. Existing users land on
-- closureProcessState = 'NONE', which is exactly "no closure sequence is
-- running" — the same behaviour they have today.
--
-- Deliberately NOT derived from history: no value here is computed from
-- prior state reports, cycleStatus or any other model-generated data. The
-- process state is server-owned and starts clean for everyone.
--
-- The columns hold only the minimum Phase 1 OPERATIONAL record. No clinical
-- content, no stability scores, no user words — so nothing here is
-- special-category data and nothing needs encryption at rest.
--
-- Value domains (enforced in code, lib/journey/closure/process.ts — stored as
-- text so a later protocol phase does not require an enum migration):
--   closureProcessState : NONE | AWAITING_INITIAL_SCORE | DELIVERING_STABILISATION
--                       | AWAITING_POST_SCORE | AWAITING_CLOSE_CONFIRMATION
--                       | HUMAN_SUPPORT | CLOSED | INCOMPLETE
--   closureRoute        : NORMAL_CLOSE | ACTIVATED_CLOSE | NULL
--   closureRoundCount   : 0..2

ALTER TABLE "RecodeProgress"
  ADD COLUMN IF NOT EXISTS "closureProcessState"   text         NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "closureRoute"          text,
  ADD COLUMN IF NOT EXISTS "closureEnteredAt"      timestamp(3),
  ADD COLUMN IF NOT EXISTS "closureTransitionedAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "closureRoundCount"     integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "closureCompletedAt"    timestamp(3),
  ADD COLUMN IF NOT EXISTS "closureIncompleteAt"   timestamp(3);

-- Verification — every existing user should read 'NONE' / 0 / NULL.
--   SELECT "closureProcessState", "closureRoundCount", count(*)
--     FROM "RecodeProgress"
--    GROUP BY 1, 2;

-- No new index. Phase 1 only ever reads these columns via the existing
-- findUnique on "RecodeProgress"."userId", which is already unique-indexed.

-- RLS is unchanged: "RecodeProgress" already has row-level security enabled
-- and REVOKEs in db/rls.sql. Adding columns does not alter that posture.

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- Safe at any time while Phase 1 is unmerged or reverted. Because the feature
-- never sets a value other than 'NONE' in Phase 1, dropping these columns
-- loses no clinical or operational information.
--
-- Revert the application code FIRST (Prisma selects these columns on every
-- Journey turn and will error if they are gone), THEN run:
--
--   ALTER TABLE "RecodeProgress"
--     DROP COLUMN IF EXISTS "closureProcessState",
--     DROP COLUMN IF EXISTS "closureRoute",
--     DROP COLUMN IF EXISTS "closureEnteredAt",
--     DROP COLUMN IF EXISTS "closureTransitionedAt",
--     DROP COLUMN IF EXISTS "closureRoundCount",
--     DROP COLUMN IF EXISTS "closureCompletedAt",
--     DROP COLUMN IF EXISTS "closureIncompleteAt";
