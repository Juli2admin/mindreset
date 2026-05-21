# AI behaviour

This document covers how MiniMind talks, what gates it has, and where
the source-of-truth prompts live.

## MiniMind v2.3 — the core companion

The canonical prompt is in two places (mirror each other in every
commit):

1. **`mindreset-app/lib/minimind/prompt.ts`** — the runtime string
   loaded by `/api/minimind/chat/route.ts`
2. **`mindreset-app/docs/minimind/MiniMind_System_Prompt_v2.3.md`** — the
   reviewable canonical document with full annotations

**Any prompt change MUST touch both files in the same commit.** This is
a hard rule because the markdown is the version Julia reviews; the
TypeScript is the version Anthropic sees. Drift between them is a
correctness bug.

## What MiniMind does

- Daily reflection companion — warm, paced, regulating
- Notices patterns gently and suggests deeper work *when it would help*
  (referring out to States & Themes or The Journey when those exist)
- Practices: short grounding exercises, breath work, parts dialogue
  prompts
- Pre/post check-ins (mood, energy, safety on 0–10 scales)
- Cross-session memory: a short rolling summary persisted at
  conversation boundaries

## What MiniMind does NOT do

- Does not diagnose anything
- Does not say "I think you have X disorder"
- Does not give clinical advice
- Does not engage with active suicidality, self-harm intent, abuse
  disclosure, psychosis, or substance crisis — these route through the
  Phase 3c safety scanner and the conversation enters a cooldown
- Does not work past the user's regulation capacity — depth is gated
- Does not recommend specific therapists, medications, or supplements
- Does not provide answers to "what's wrong with me" — it reflects, it
  doesn't diagnose

The Journey (Block C) is what does the deep parts work, the eight-block
methodology, and the trauma-informed pacing. MiniMind sits at the
surface layer.

## Safety scanner (Phase 3c)

Located in `mindreset-app/lib/minimind/safety/`. Runs on every user
turn before the LLM is called.

**Two-layer detection:**

1. **Keyword layer** — fast EN-only keyword/regex match against the
   user's last message. RU phrases not yet added (known gap; see
   `docs/carry-forward.md`).
2. **LLM verifier** — when a keyword fires, a smaller, fast model
   classifies severity (1–5) and intent. Reduces false-positive rate
   from the keyword layer.

**On Sev 5 trigger:**

- A `SafetyEvent` row is written (immutable)
- The conversation flips `inCrisisCooldown = true`
- Only the cooldown holding message is served (regardless of what the
  user types) until the LLM verifier sees explicit safety confirmation
  in a subsequent user reply
- The cooldown also surfaces UK crisis resources (Samaritans, NHS 111,
  999)

**On Sev 1–4:**

- `SafetyEvent` row is still written
- The conversation continues but MiniMind's response is shaped by the
  safety context (e.g., grounding before exploration)

## Depth gates

The methodology defines four depths:

- **Surface** — MiniMind layer. Daily chat, light reflection, grounding.
- **Middle** — States & Themes modules. Structured but contained.
- **Deep** — Journey blocks. Methodological, paced.
- (the fourth is the integration phase — methodology-internal)

Depth progression is gated by:

- `DiagnosticProfile.regulationCapacity` (0–10) — the user's
  self-soothing ability
- `Conversation.sscPassed` — Stabilisation+Satisfaction Criteria met at
  end of last session
- `DiagnosticProfile.recentStateOccurrences` — the 3-in-7-days rule:
  same state appearing 3 times in 7 days triggers a deeper-module
  recommendation

The user never sees the gates directly. They appear as MiniMind
*suggestions* ("there's a module on X that might help — want to take a
look?") rather than as locks.

## DiagnosticProfile — the sensor

One row per user. Updated asynchronously after every meaningful
conversation by the assessment engine. Holds:

- Attachment style (anxious/avoidant/secure/disorganized, weighted)
- Predominant state (one of the 4 deep States used in Journey, or one
  of the 9 surface states used in MiniMind safety classification —
  these are distinct sets)
- Active themes (the 5 Themes: money, body, parents, shame,
  self-realisation, weighted)
- Channel preference (visual / somatic / emotional / cognitive)
- Regulation capacity (0–10)
- Risk markers (aggregated patterns; distinct from acute SafetyEvent
  log)

The user never sees this directly. It's the engine's working notes.

## State and theme vocabularies (terminology gotcha)

There are **two distinct state vocabularies** in the codebase:

1. **9 surface states** — used by the MiniMind safety verifier
   (`lib/minimind/safety/verifier.ts`). These are the in-the-moment
   classifications the safety scanner uses.
2. **4 deep States** — the methodological States the Journey programme
   addresses. These appear in `DiagnosticProfile.predominantState`.

They share the word "state" but mean different things. Schema comments
note this distinction. Future agents: don't conflate.

Similarly, **5 Themes**: money, body, parents, shame, self-realisation
— these are the methodological Themes for States & Themes modules.

## Cross-session memory

After Phase 3d, MiniMind has a short rolling summary that persists
between conversations. Implementation:

- After each conversation closes (or every N messages), the LLM
  produces a compressed summary
- The summary is stored on the user / latest conversation
- On the next session, the summary is included in the prompt as
  "previous context"
- Full message history is **not** loaded into context — only the
  summary

This keeps token usage bounded while preserving continuity.

## Prompt structure (v2.3)

The full structure is in
`docs/minimind/MiniMind_System_Prompt_v2.3.md`. Key sections:

1. **Identity** — who MiniMind is, what tone to use
2. **Scope** — what MiniMind does and does not do
3. **Methodology grounding** — the 8-block framework
4. **Safety protocol** — what to do on red flags
5. **Pacing** — when to slow down, when to suggest depth
6. **Practices catalog** — types of grounding/regulation exercises
7. **Output format** — short messages, white space, no exclamation
   marks
8. **Type-to-practice mapping** — which surface-state types unlock
   which practice categories (currently broader than the named-practice
   catalog; see `docs/carry-forward.md` "v2.3 Type-to-practice
   categories ahead of the named-practice catalog")

## Anthropic SDK usage

- Model: `claude-opus-4-7` (latest at time of writing)
- Streaming enabled — `/api/minimind/chat` streams to the client; on
  stream failure the saved Message row gets `partial = true`
- Token limits: not currently set — relies on the model's defaults
- Prompt caching: NOT yet configured. The system prompt is ~3K tokens
  and gets re-sent on every turn. Caching is a future optimisation
  worth doing once we have real usage volume.

## Future AI work (out of Block B scope)

- **States & Themes module prompts** — 9 separate prompts, one per
  module. Structured Surface→Middle→Deep content delivery, not open
  chat. Block C work.
- **Journey block prompts** — 8 prompts, one per block. Deeper trauma
  processing, parts work, narrative re-authoring. Distinct from the
  MiniMind register. Block C work.
- **Pre-launch native translation pass** — `translate-missing.mjs`
  invoked manually for each placeholder locale. Owner reviews diff
  before `--write`.
- **Prompt caching** — Anthropic prompt-caching for the system prompt
  to reduce token cost once usage scales.
