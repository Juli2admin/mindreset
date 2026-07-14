-- PR ω2 (2026-07-14) — Pilot welcome email idempotency column.
--
-- Julia: run in Supabase SQL editor. Adds one nullable column to
-- PilotInvitation so sendPilotWelcomeEmail() can atomically claim
-- the send slot via updateMany({ welcomeEmailSentAt: null }).
-- Idempotent — safe to run twice.

ALTER TABLE "PilotInvitation"
  ADD COLUMN IF NOT EXISTS "welcomeEmailSentAt" TIMESTAMP(3);
