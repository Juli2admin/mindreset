# The Journey — Safety Runbook

> What to do when a Journey user's session is flagged for review, or when
> someone reports being stuck in a held state and asks for help.

## How a freeze happens

Three independent paths can freeze a user's Journey:

1. **Synchronous keyword scan** — runs on every user message before the LLM
   is ever called. If a hard-trip pattern hits
   (`lib/journey/safety/keywords.ts`), the LLM is skipped entirely, the
   verbatim crisis response goes out (Shared Core §7), and
   `RecodeProgress.frozenForReview` is set to `true`.
2. **Async LLM verifier** — runs in the background after every AI reply
   (`lib/journey/safety/verifier.ts`, Haiku-classifier). If it returns
   `clear_crisis`, the journey is frozen. The reply the user just received
   has already gone out; the **next** user message will receive the canned
   holding response.
3. **AI's own state report** — if the AI's hidden state report sets
   `safetyFlag: "red_flag"` even when the keyword scan and verifier
   disagreed, the freeze fires.

In all three cases:
- `RecodeProgress.frozenForReview = true`
- `RecodeProgress.frozenAt` is set
- `RecodeProgress.frozenReason` records source + redFlagType + brief reasoning
- A `JourneyTurn` audit row is written with `safetyFlag = 'red_flag'`
- A console warning is logged (Sentry surfaces it on the operations dashboard)

## What the user sees

A user whose journey is frozen receives the **verbatim crisis response from
Shared Core §7** on every subsequent message, until the freeze is cleared:

> *"I hear how serious this is. What you're carrying right now is more than
> this conversation is built for, and I want you safe. Please reach out to a
> person who can be with you in this: Samaritans — 116 123 (free, 24/7);
> NHS 111, option 2 — for mental health crisis; your GP if you have one. If
> you're in immediate physical danger, call 999 or go to A&E. I'll be here
> when you're ready to come back."*

The user's persistent landscape (anchor, parts, foreign files, signature
images, declarations) is preserved. A cleared freeze drops them back into
the stage they were in, with everything intact.

## How to find frozen users

In Supabase SQL Editor:

```sql
SELECT
  rp."userId",
  u."email",
  rp."frozenAt",
  rp."frozenReason",
  rp."currentStage",
  rp."currentDepth"
FROM "RecodeProgress" rp
JOIN "User" u ON u."id" = rp."userId"
WHERE rp."frozenForReview" = TRUE
ORDER BY rp."frozenAt" DESC;
```

For a deeper look at a specific user's recent turns:

```sql
SELECT
  "createdAt",
  "stageAtTurn",
  "depthAtTurn",
  "intensityReported",
  "safetyFlag",
  "redFlagType",
  "recommendedAction"
FROM "JourneyTurn"
WHERE "userId" = '<user_id>'
ORDER BY "createdAt" DESC
LIMIT 20;
```

The `stateReportEncrypted` column on each turn holds the full clinical
read; decrypting it requires the `MESSAGE_ENCRYPTION_KEY` and is normally
done from a server context, not by hand.

## How to clear a freeze (manual, phase 1)

This is a deliberate clinical decision. Only clear a freeze when:

- The user has been spoken to (or has reached out and reported they are
  safe and ready to continue), AND
- A clinician has reviewed the recent `JourneyTurn` rows for the user and
  is satisfied they can re-enter the method.

To clear, run in Supabase SQL Editor:

```sql
UPDATE "RecodeProgress"
SET
  "frozenForReview" = FALSE,
  "frozenAt" = NULL,
  "frozenReason" = NULL
WHERE "userId" = '<user_id>'
  AND "frozenForReview" = TRUE;
```

The user's next message will then receive normal method work, picking up
in their current stage with the full landscape intact.

## When to consider returning the user to an earlier stage

If the review suggests the user destabilised because they were doing depth
work beyond their current readiness (e.g. Deep Layer parts contact in Stage
4 without sufficient Adult Self stability), it may be appropriate to roll
their stage back alongside clearing the freeze. The accumulated landscape
is preserved either way.

```sql
UPDATE "RecodeProgress"
SET
  "frozenForReview" = FALSE,
  "frozenAt" = NULL,
  "frozenReason" = NULL,
  "currentStage" = <previous_stage>,
  "currentDepth" = 'surface'
WHERE "userId" = '<user_id>';
```

## Phase 2 (out of scope for current build)

- Reviewer UI (admin route, paginated frozen users, view recent decrypted
  turns, single-click clear or rollback).
- Email alert to clinical lead when a freeze fires.
- Hourly Red Flag rate alert (if > 3 freezes/hour across all users).
- Follow-up cadence after a freeze clears (e.g. lighter session at next
  re-entry, then settle into normal flow).

Until phase 2 ships, the operational path is the SQL above, and the alert
path is Sentry's existing console error capture.
