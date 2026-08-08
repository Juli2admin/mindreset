-- Activated Closure — Phase 2 (2026-08-06). Stability score persistence.
--
-- RUN MANUALLY in the Supabase SQL editor. Not executed by the agent, and
-- never via `prisma migrate` / `db push` (project migration policy).
--
-- Run BEFORE merge: Prisma selects these columns on every Journey turn.
--
-- Purely ADDITIVE. Four nullable columns on an existing table. No existing
-- column altered, no row rewritten, JourneyTurn untouched, nothing backfilled
-- or derived from history.
--
-- These hold the two stability scores CAPTURED BY CODE from the user's own
-- message (lib/journey/closure/score-capture.ts), not read from the model's
-- state report. Scale is 1..10 where 10 = fully grounded. Out-of-range values
-- are rejected at capture time and never clamped, so a stored value is always
-- a number the user actually gave.
--
-- No clinical content, no user words — nothing here is special-category data
-- and nothing needs encryption at rest.
--
-- INERT ON ARRIVAL: nothing in Phase 2 wires the closure process into a user
-- turn, so every row will read NULL until the clinical half ships.

ALTER TABLE "RecodeProgress"
  ADD COLUMN IF NOT EXISTS "closureInitialScore"   integer,
  ADD COLUMN IF NOT EXISTS "closureInitialScoreAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "closurePostScore"      integer,
  ADD COLUMN IF NOT EXISTS "closurePostScoreAt"    timestamp(3);

-- Verification — every row should be NULL / NULL.
--   SELECT count(*) FILTER (WHERE "closureInitialScore" IS NOT NULL) AS initial_set,
--          count(*) FILTER (WHERE "closurePostScore"    IS NOT NULL) AS post_set,
--          count(*) AS total
--     FROM "RecodeProgress";

-- No index: read only via the existing unique-indexed findUnique on "userId".
-- RLS unchanged — adding columns does not alter the table's posture.

-- ---------------------------------------------------------------------------
-- ROLLBACK  (revert the application code FIRST, then run)
-- ---------------------------------------------------------------------------
--   ALTER TABLE "RecodeProgress"
--     DROP COLUMN IF EXISTS "closureInitialScore",
--     DROP COLUMN IF EXISTS "closureInitialScoreAt",
--     DROP COLUMN IF EXISTS "closurePostScore",
--     DROP COLUMN IF EXISTS "closurePostScoreAt";
