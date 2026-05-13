# MindReset.ai — Data Model Overview

A plain-language tour of the database (see `schema.prisma` for the technical version).

## The core insight, encoded

**MiniMind is a sensor, not a product.** Behind the warm chat companion sits a continuous
assessment engine that builds a picture of the user, flags safety risks, and decides what
paid product to offer next. The data model has three layers that mirror this:

1. **What the user sees** — their conversations, their purchases, their progress
2. **What we track for safety** — every red flag, every event, immutably logged for review
3. **What we hold about them** — the diagnostic profile, hidden from view, driving every interaction

## The tables, in order of importance

### `User`
A row per person. Email, locale (en/ru/...), theme preference, consent stamps, and
the screening result (red/yellow/green) attached after Section 0.

### `ScreeningResponse`
The structured answer set from the /screening flow. Stored raw so if classification
rules change later, old responses can be re-evaluated against the new logic.

### `DiagnosticProfile` — **the hidden sensor**
**One row per user. Updated by the AI after every meaningful conversation.**

What it holds:
- **Attachment style** — anxious / avoidant / secure / disorganized, weighted by confidence
- **Predominant state** — the 4 States from the methodology: anxiety, apathy, void, dissolution
- **Active themes** — the 5 Themes: money, body, parents, shame, self-realisation
- **Channel preference** — how the user processes (visual / somatic / emotional / cognitive)
- **Regulation capacity** — self-soothing ability, 0–10 (gates progression to deeper work)
- **Repeat-state counter** — the rule from your docs: 3 occurrences of the same state in 7 days → suggest a deeper module
- **Risk markers** — aggregated patterns of concern (distinct from acute safety events)
- **Engine notes** — free-form observations from the assessment AI

This profile is what powers smart routing. The user never sees it directly (initially).
Later we can decide whether to surface a sanitized "your journey" view to them.

### `Conversation` + `Message`
Every chat session is a `Conversation`, whatever kind (MiniMind chat, module session,
Recode block). Each one tracks:
- **Pre/post check-ins**: mood, energy, safety on 0–10 scales — taken at the start and end
- **Red-flag indicator**: did anything safety-relevant come up in this session?
- **SSC pass**: did the user meet the Stabilisation+Satisfaction Criteria by the end?

Inside, individual `Message` rows hold the turn-by-turn chat. Each message can carry
**detected signals** — what the assessment engine pulled from it (emotions, somatic cues,
red-flag keywords). This is the raw material the diagnostic profile is built from.

### `SafetyEvent` — **immutable**
When the red-flag protocol triggers, a `SafetyEvent` is created. It records:
- **Type**: suicidal ideation, self-harm, abuse disclosure, psychosis signal, substance crisis
- **Severity**: 1–5
- **What the AI did**: the response, which resources were offered
- **Whether a human has reviewed it** + reviewer notes

This is the audit trail. If a clinical supervisor reviews the product later, or if
something goes wrong and needs investigation, this log is the answer. It is separate
from the Conversation log so it cannot be lost or overwritten.

### `Purchase`
Stripe-backed. Three product types: MiniMind subscription, individual module, full Recode.
Statuses: pending / completed / refunded / failed.

### `ModuleProgress`
One row per user per module. Tracks current step, depth (surface / middle / deep),
and whether the SSC has been met (gates progression).

### `RecodeProgress`
One row per user. Tracks current block (1–8), per-block status as JSON, and pause state.
Sequential gating is enforced — no jumping ahead.

### `Practice`
Individual exercises completed within sessions, with optional user ratings. This is how
the assessment engine learns over time what works for whom.

## What's deliberately NOT in this schema yet

- **Notification preferences** — add when we have email/SMS reminders
- **Practitioner directory** — add when we have referral partnerships for yellow/red outcomes
- **Multi-user accounts** — add only if you offer partner/family work
- **Clinical supervisor accounts** — add when you have a clinical reviewer

These are deferred so we don't over-architect early.

## What this enables

With these tables in place, we can:
- Take someone through the screening and store their result (legal gate)
- Run MiniMind chat with proper conversation/message logging
- Have the assessment engine update the diagnostic profile after each session
- Detect and immutably log safety events with full audit trail
- Sell and unlock modules / Recode through Stripe
- Track sequential progress through the 8 Recode blocks with proper gating
- Build the smart routing: "this user has shown apathy 3x this week → suggest the Apathy module"

## What's next

1. **Provision Postgres** — Vercel Postgres or Supabase (recommended for solo dev)
2. **Run migrations** — `prisma migrate dev` generates the tables
3. **Wire `/screening` to write `ScreeningResponse`** — first real data flow
4. **Build the assessment engine** — the LLM-powered piece that reads conversations and writes to `DiagnosticProfile`
5. **MiniMind chat MVP** — streaming Claude API integration with safety scanning
