-- GDPR account deletion (PR #TBD)
-- Run in Supabase SQL editor BEFORE deploying.

-- 1. Soft-delete + scheduled-deletion columns on User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "deletedAt"            timestamp(3),
  ADD COLUMN IF NOT EXISTS "deletionScheduledAt"  timestamp(3);

-- 2. Single-use email-confirmation tokens
CREATE TABLE IF NOT EXISTS "AccountDeletionToken" (
  "id"         text          PRIMARY KEY,
  "userId"     text          NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash"  text          NOT NULL UNIQUE,
  "createdAt"  timestamp(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"  timestamp(3)  NOT NULL,
  "consumedAt" timestamp(3)
);

CREATE INDEX IF NOT EXISTS "AccountDeletionToken_userId_idx"
  ON "AccountDeletionToken" ("userId");

CREATE INDEX IF NOT EXISTS "AccountDeletionToken_expiresAt_idx"
  ON "AccountDeletionToken" ("expiresAt");
