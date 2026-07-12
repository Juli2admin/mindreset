-- PR ρ1 (2026-07-12) — Pilot invitation system
--
-- Two things:
--   1. New PilotInvitation table (per-code state, tracking flags, revoke)
--   2. Extend User with pilotTrialStartedAt / pilotTrialEndsAt / pilotInvitationId
--
-- Julia: run this in Supabase SQL editor BEFORE merging PR ρ1.
-- Everything below is idempotent (IF NOT EXISTS) so it's safe to run
-- twice.

-- ============================================================
-- 1. PilotInvitation
-- ============================================================
CREATE TABLE IF NOT EXISTS "PilotInvitation" (
  "id"               TEXT PRIMARY KEY,
  "code"             TEXT NOT NULL UNIQUE,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "createdByEmail"   TEXT,
  "notes"            TEXT,
  "trialDays"        INTEGER NOT NULL DEFAULT 30,
  "expiresAt"        TIMESTAMP(3),
  "redeemedAt"       TIMESTAMP(3),
  "redeemedByUserId" TEXT UNIQUE,
  "beforeFormFilled" BOOLEAN NOT NULL DEFAULT FALSE,
  "afterFormFilled"  BOOLEAN NOT NULL DEFAULT FALSE,
  "followUp3mSent"   BOOLEAN NOT NULL DEFAULT FALSE,
  "quoteApproved"    BOOLEAN NOT NULL DEFAULT FALSE,
  "revokedAt"        TIMESTAMP(3),
  "revokedReason"    TEXT
);

CREATE INDEX IF NOT EXISTS "PilotInvitation_redeemedByUserId_idx"
  ON "PilotInvitation"("redeemedByUserId");

-- ============================================================
-- 2. User — pilot columns
-- ============================================================
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "pilotTrialStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pilotTrialEndsAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pilotInvitationId"   TEXT UNIQUE;

-- FK to PilotInvitation, SetNull on delete so removing an invitation
-- doesn't cascade-delete a real user.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'User_pilotInvitationId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_pilotInvitationId_fkey"
      FOREIGN KEY ("pilotInvitationId")
      REFERENCES "PilotInvitation"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- Sanity check — should return 0 rows
-- ============================================================
-- SELECT * FROM "PilotInvitation" LIMIT 1;
-- SELECT "id", "email", "pilotTrialStartedAt", "pilotTrialEndsAt", "pilotInvitationId"
--   FROM "User" LIMIT 1;
