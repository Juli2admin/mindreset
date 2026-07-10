-- PR δ (2026-07-10) — AiUsage table for per-Anthropic-call cost telemetry.
--
-- Every call site (Journey turn, MiniMind chat, both safety verifiers,
-- MiniMind memory updater, support-ticket categoriser) writes one row here
-- after Anthropic responds. Fields mirror what the SDK returns in the
-- Message.usage payload, plus a $ cost derived at write time from
-- lib/ai-usage/cost.ts.
--
-- userId is nullable because support-categorise has no user context.
-- FK is ON DELETE SET NULL so a deleted user's historical spend rows
-- survive for aggregate accounting.

CREATE TABLE "AiUsage" (
    "id"                    TEXT              NOT NULL,
    "createdAt"             TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"                TEXT,
    "callSite"              TEXT              NOT NULL,
    "model"                 TEXT              NOT NULL,
    "inputTokens"           INTEGER           NOT NULL,
    "outputTokens"          INTEGER           NOT NULL,
    "cacheReadTokens"       INTEGER           NOT NULL DEFAULT 0,
    "cacheCreationTokens"   INTEGER           NOT NULL DEFAULT 0,
    "costUsd"               DOUBLE PRECISION  NOT NULL,
    "journeyTurnId"         TEXT,
    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsage_userId_createdAt_idx"    ON "AiUsage"("userId", "createdAt");
CREATE INDEX "AiUsage_createdAt_idx"           ON "AiUsage"("createdAt");
CREATE INDEX "AiUsage_callSite_createdAt_idx"  ON "AiUsage"("callSite", "createdAt");

ALTER TABLE "AiUsage"
    ADD CONSTRAINT "AiUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
