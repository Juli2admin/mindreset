-- PR ω3a (2026-07-14) — In-app pilot questionnaires.
--
-- Julia: run in Supabase SQL editor. Idempotent.
-- Adds:
--   - PilotInvitation trigger + fill timestamps (kept nullable for
--     backfill: existing rows stay untouched).
--   - TesterResponse table with typed Likert scales + JSON blob.

-- 1. Extend PilotInvitation with lifecycle timestamps for the two forms.
ALTER TABLE "PilotInvitation"
  ADD COLUMN IF NOT EXISTS "beforeFormFilledAt"    TIMESTAMP(3);
ALTER TABLE "PilotInvitation"
  ADD COLUMN IF NOT EXISTS "beforeFormEmailSentAt" TIMESTAMP(3);
ALTER TABLE "PilotInvitation"
  ADD COLUMN IF NOT EXISTS "afterFormFilledAt"     TIMESTAMP(3);
ALTER TABLE "PilotInvitation"
  ADD COLUMN IF NOT EXISTS "afterFormEmailSentAt"  TIMESTAMP(3);

-- 2. TesterResponse — one row per (invitation, formType).
CREATE TABLE IF NOT EXISTS "TesterResponse" (
  "id"                TEXT PRIMARY KEY,
  "invitationId"      TEXT NOT NULL,
  "formType"          TEXT NOT NULL,
  "submittedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "scaleUnderstand"   INTEGER,
  "scaleNotice"       INTEGER,
  "scaleChoose"       INTEGER,
  "scaleHardOnSelf"   INTEGER,
  "scaleAffectsLife"  INTEGER,
  "scaleStuck"        INTEGER,
  "answers"           JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "TesterResponse_invitation_formType_unique"
  ON "TesterResponse"("invitationId", "formType");

CREATE INDEX IF NOT EXISTS "TesterResponse_invitation_idx"
  ON "TesterResponse"("invitationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TesterResponse_invitationId_fkey'
  ) THEN
    ALTER TABLE "TesterResponse"
      ADD CONSTRAINT "TesterResponse_invitationId_fkey"
      FOREIGN KEY ("invitationId") REFERENCES "PilotInvitation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Sanity checks — should return 0 rows on a fresh install.
-- SELECT * FROM "TesterResponse" LIMIT 1;
-- SELECT "beforeFormFilled", "beforeFormFilledAt", "beforeFormEmailSentAt"
--   FROM "PilotInvitation" LIMIT 5;
