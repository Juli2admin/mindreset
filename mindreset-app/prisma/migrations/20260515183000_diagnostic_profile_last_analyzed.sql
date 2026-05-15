-- Phase 3d schema migration — DiagnosticProfile.lastAnalyzedAt
--
-- Used by the profile updater (lib/minimind/memory/updater.ts) to know which
-- messages have already been analyzed and avoid re-processing the same
-- window. Nullable + no default so existing rows (if any) read as "never
-- analyzed" and the updater will treat them as fresh on first encounter.

ALTER TABLE "DiagnosticProfile" ADD COLUMN "lastAnalyzedAt" TIMESTAMP(3);
