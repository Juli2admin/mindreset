-- =============================================================================
-- MindReset — Row Level Security codification
-- =============================================================================
--
-- WHAT THIS IS
-- ------------
-- The canonical, idempotent SQL that locks down every table in the public
-- schema against the Supabase PostgREST anon/authenticated roles.
--
-- This file is NOT a Prisma migration. Prisma cannot manage RLS — `prisma
-- migrate` does not emit ENABLE ROW LEVEL SECURITY, and Supabase grants
-- anon + authenticated full CRUD on every table by default. The result of
-- that combination is that any Prisma-created table is wide open to PostgREST
-- callers until a manual SQL step like this one runs.
--
-- WHEN TO RUN IT
-- --------------
-- Run this in the Supabase SQL editor (or psql against the production DB) in
-- two situations:
--
--   1. Disaster recovery — if the database is restored from a Prisma
--      migration set and the RLS state is lost. Paste the entire file into
--      one transaction and commit.
--   2. After any `prisma migrate` that adds a new table to the public schema.
--      Add the new table to BOTH blocks below, run the new statements only,
--      and commit the file change in the same PR that adds the Prisma model.
--
-- DO NOT RUN VIA `prisma db execute` OR ANY CI AUTOMATION.
-- This file is run by a human against the Supabase dashboard, with eyes on
-- the result. The carry-forward entry "Security — RLS enabled on all tables
-- (20 May 2026)" has the rationale.
--
-- WHY IT IS SAFE FOR PRISMA
-- -------------------------
-- The app's DATABASE_URL connects as the `postgres.<project-ref>` Supabase
-- role, which carries the BYPASSRLS attribute. Enabling RLS does not affect
-- Prisma traffic at all. RLS only fires on connections that come in as
-- `anon` or `authenticated` (i.e. PostgREST callers) — and the app has no
-- PostgREST callers, since `@supabase/supabase-js` is not installed.
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Block 1: Enable Row Level Security on every public-schema table.
--
-- With no policies attached, the default behaviour for anon and authenticated
-- roles is "deny all" — which is exactly what we want, since neither role is
-- used by the application.
-- -----------------------------------------------------------------------------

ALTER TABLE public."User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ScreeningResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DiagnosticProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Conversation"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Message"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SafetyEvent"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Purchase"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModuleProgress"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecodeProgress"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Practice"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AccountDeletionToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Testimonial"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StripeEvent"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportEmail"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportEmailReply"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarketingSend"        ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Block 2: Strip the table-level grants from anon and authenticated.
--
-- Defence-in-depth: even if Supabase ever changes its RLS default semantics
-- or accidentally re-enables a permissive policy, the underlying GRANTs are
-- gone. The app does not need these grants — it talks to Postgres directly
-- via Prisma as the project-owner role.
-- -----------------------------------------------------------------------------

REVOKE ALL ON public."User"              FROM anon, authenticated;
REVOKE ALL ON public."ScreeningResponse" FROM anon, authenticated;
REVOKE ALL ON public."DiagnosticProfile" FROM anon, authenticated;
REVOKE ALL ON public."Conversation"      FROM anon, authenticated;
REVOKE ALL ON public."Message"           FROM anon, authenticated;
REVOKE ALL ON public."SafetyEvent"       FROM anon, authenticated;
REVOKE ALL ON public."Purchase"          FROM anon, authenticated;
REVOKE ALL ON public."ModuleProgress"    FROM anon, authenticated;
REVOKE ALL ON public."RecodeProgress"    FROM anon, authenticated;
REVOKE ALL ON public."Practice"          FROM anon, authenticated;
REVOKE ALL ON public."AccountDeletionToken" FROM anon, authenticated;
REVOKE ALL ON public."Testimonial"          FROM anon, authenticated;
REVOKE ALL ON public."StripeEvent"          FROM anon, authenticated;
REVOKE ALL ON public."SupportEmail"         FROM anon, authenticated;
REVOKE ALL ON public."SupportEmailReply"    FROM anon, authenticated;
REVOKE ALL ON public."MarketingSend"        FROM anon, authenticated;

COMMIT;
