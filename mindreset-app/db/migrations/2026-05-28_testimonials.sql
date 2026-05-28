-- Testimonials (PR #TBD)
-- Run in Supabase SQL editor BEFORE deploying.
-- The Testimonial table holds user-submitted stories for Landing + Pricing
-- social-proof blocks. Soft-launch moderation is manual (Julia toggles
-- status = 'approved' directly via the SQL editor or Supabase table viewer).

CREATE TABLE IF NOT EXISTS "Testimonial" (
  "id"              text          PRIMARY KEY,
  "userId"          text          REFERENCES "User"("id") ON DELETE SET NULL,
  "publicName"      text          NOT NULL,
  "ageRange"        text,
  "story"           text          NOT NULL,
  "locale"          text          NOT NULL,
  "consent"         boolean       NOT NULL,
  "status"          text          NOT NULL DEFAULT 'pending',
  "moderationNotes" text,
  "createdAt"       timestamp(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt"      timestamp(3),
  "rejectedAt"      timestamp(3)
);

CREATE INDEX IF NOT EXISTS "Testimonial_status_locale_approvedAt_idx"
  ON "Testimonial" ("status", "locale", "approvedAt");

CREATE INDEX IF NOT EXISTS "Testimonial_userId_idx"
  ON "Testimonial" ("userId");

-- RLS — same defence-in-depth as every other table (denies anon /
-- authenticated access; Prisma bypasses).
ALTER TABLE "Testimonial" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Testimonial" FROM anon, authenticated;
