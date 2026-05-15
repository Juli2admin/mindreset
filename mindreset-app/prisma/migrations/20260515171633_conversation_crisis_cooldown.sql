-- Phase 3c — adds Conversation.inCrisisCooldown column.
-- Generated 2026-05-15 17:16:33. Apply via Supabase SQL editor.
-- Non-blocking on Postgres; existing rows get the default value false.
-- Prisma schema mirror: model Conversation { ... inCrisisCooldown Boolean @default(false) ... }

ALTER TABLE "Conversation" ADD COLUMN "inCrisisCooldown" BOOLEAN NOT NULL DEFAULT false;
