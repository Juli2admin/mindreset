-- Phase 3b — adds Message.partial column.
-- Generated 2026-05-15 15:38:50. Apply via Supabase SQL editor.
-- Non-blocking on Postgres; existing rows get the default value false.
-- Prisma schema mirror: model Message { ... partial Boolean @default(false) ... }

ALTER TABLE "Message" ADD COLUMN "partial" BOOLEAN NOT NULL DEFAULT false;
