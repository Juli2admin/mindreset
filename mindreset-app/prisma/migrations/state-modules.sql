-- PR ψ1 (2026-07-14) — States & Themes: state module foundation.
--
-- Julia: run this in Supabase SQL editor. All statements are idempotent
-- (IF NOT EXISTS / add column IF NOT EXISTS), safe to run twice.

-- ============================================================
-- 1. Purchase.accessExpiresAt — for time-bounded access windows
--    (state modules today; other 30-day products in the future).
-- ============================================================
ALTER TABLE "Purchase"
  ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP(3);

-- ============================================================
-- 2. StateSession — one row per (user, moduleId, start_of_conversation).
--    Each visit that starts a fresh conversation creates a new row.
--    Completes on stabilisation or red-flag.
-- ============================================================
CREATE TABLE IF NOT EXISTS "StateSession" (
  "id"                TEXT PRIMARY KEY,
  "userId"            TEXT NOT NULL,
  "moduleId"          TEXT NOT NULL,
  "startedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "completedAt"       TIMESTAMP(3),
  "completionReason"  TEXT,
  "turnCount"         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "StateSession_user_module_started_idx"
  ON "StateSession"("userId", "moduleId", "startedAt");
CREATE INDEX IF NOT EXISTS "StateSession_user_module_completed_idx"
  ON "StateSession"("userId", "moduleId", "completedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StateSession_userId_fkey'
  ) THEN
    ALTER TABLE "StateSession"
      ADD CONSTRAINT "StateSession_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3. StateMessage — one row per turn (user or assistant).
--    Content encrypted at rest via lib/encrypt.ts (same pattern
--    as JourneyMessage).
-- ============================================================
CREATE TABLE IF NOT EXISTS "StateMessage" (
  "id"                TEXT PRIMARY KEY,
  "sessionId"         TEXT NOT NULL,
  "role"              TEXT NOT NULL,
  "contentEncrypted"  TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "StateMessage_session_created_idx"
  ON "StateMessage"("sessionId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StateMessage_sessionId_fkey'
  ) THEN
    ALTER TABLE "StateMessage"
      ADD CONSTRAINT "StateMessage_sessionId_fkey"
      FOREIGN KEY ("sessionId")
      REFERENCES "StateSession"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- Sanity checks — should return 0 rows
-- ============================================================
-- SELECT * FROM "StateSession" LIMIT 1;
-- SELECT * FROM "StateMessage" LIMIT 1;
-- SELECT "id", "productType", "accessExpiresAt" FROM "Purchase"
--   WHERE "productType" = 'state_module' LIMIT 1;
