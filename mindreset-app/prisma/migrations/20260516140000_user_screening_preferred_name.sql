-- Carry-forward fix — preferredName captured at screening, propagated to
-- User via Clerk webhook backfill (Path B1: unsafeMetadata.screeningId).
-- Both columns are nullable + no default → backward-compatible on existing
-- rows. The webhook reads ScreeningResponse.preferredName + result +
-- createdAt and writes them into User.preferredName + screeningResult +
-- screeningResultAt on user.created (never on user.updated, which would
-- conflict with future account-settings-page edits).

ALTER TABLE "User" ADD COLUMN "preferredName" TEXT;
ALTER TABLE "ScreeningResponse" ADD COLUMN "preferredName" TEXT;
