-- PR χ1 (2026-07-13) — Themes: deep thematic modules.
--
-- Julia: run this in Supabase SQL editor after Purchase.accessExpiresAt
-- already exists (added in the earlier state-modules.sql migration).
--
-- Themes are multi-session: one ThemeSession per (userId, moduleId),
-- the reader continues where they left off across visits. The three-level
-- structure (surface / middle / deep-refer) is prompt-driven, not encoded
-- in the schema.
--
-- All statements are idempotent (IF NOT EXISTS), safe to run twice.

-- ============================================================
-- 1. ThemeSession — one row per (user, moduleId). Multi-session.
-- ============================================================
CREATE TABLE IF NOT EXISTS "ThemeSession" (
  "id"                TEXT PRIMARY KEY,
  "userId"            TEXT NOT NULL,
  "moduleId"          TEXT NOT NULL,
  "startedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "lastActiveAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "completedAt"       TIMESTAMP(3),
  "completionReason"  TEXT,
  "turnCount"         INTEGER NOT NULL DEFAULT 0
);

-- One active row per user+theme (multi-session continuity).
CREATE UNIQUE INDEX IF NOT EXISTS "ThemeSession_user_module_unique"
  ON "ThemeSession"("userId", "moduleId");

CREATE INDEX IF NOT EXISTS "ThemeSession_user_lastActive_idx"
  ON "ThemeSession"("userId", "lastActiveAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ThemeSession_userId_fkey'
  ) THEN
    ALTER TABLE "ThemeSession"
      ADD CONSTRAINT "ThemeSession_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 2. ThemeMessage — one row per turn, encrypted at rest.
-- ============================================================
CREATE TABLE IF NOT EXISTS "ThemeMessage" (
  "id"                TEXT PRIMARY KEY,
  "sessionId"         TEXT NOT NULL,
  "role"              TEXT NOT NULL,
  "contentEncrypted"  TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ThemeMessage_session_created_idx"
  ON "ThemeMessage"("sessionId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ThemeMessage_sessionId_fkey'
  ) THEN
    ALTER TABLE "ThemeMessage"
      ADD CONSTRAINT "ThemeMessage_sessionId_fkey"
      FOREIGN KEY ("sessionId")
      REFERENCES "ThemeSession"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- Sanity check — should return 0 rows on fresh install.
-- ============================================================
-- SELECT * FROM "ThemeSession" LIMIT 1;
-- SELECT * FROM "ThemeMessage" LIMIT 1;
-- SELECT "id", "productType", "accessExpiresAt" FROM "Purchase"
--   WHERE "productType" = 'theme_module' LIMIT 1;
