-- PR ψ5 (2026-07-14) — Cross-session memory for state modules.
--
-- Julia: run in Supabase SQL editor. Idempotent.
-- Adds a single new table so that within the 30-day access window a
-- reader's session #3 on Anxiety knows what worked in sessions #1 + #2.

CREATE TABLE IF NOT EXISTS "StateModuleMemory" (
  "id"                       TEXT PRIMARY KEY,
  "userId"                   TEXT NOT NULL,
  "moduleId"                 TEXT NOT NULL,
  "memorySummaryEncrypted"   TEXT NOT NULL,
  "memorySummaryUpdatedAt"   TIMESTAMP(3) NOT NULL,
  "memorySummaryTurnCount"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "StateModuleMemory_user_module_unique"
  ON "StateModuleMemory"("userId", "moduleId");

CREATE INDEX IF NOT EXISTS "StateModuleMemory_user_idx"
  ON "StateModuleMemory"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StateModuleMemory_userId_fkey'
  ) THEN
    ALTER TABLE "StateModuleMemory"
      ADD CONSTRAINT "StateModuleMemory_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Sanity check
-- SELECT * FROM "StateModuleMemory" LIMIT 1;
