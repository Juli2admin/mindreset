# Journey Extended-Thinking Experiment (flag-gated, NOT for merge)

**Status:** isolated experiment on branch `claude/journey-exp-thinking`.
Branched from `main`. **Do not merge to `main`** until the A/B produces
objective evidence that a pre-reply reasoning pass improves the measured
defects (lead-vs-follow, memory friction) without regressing latency or cost.

## What this branch adds

One production surface, one small helper, one guard — nothing else:

- `lib/journey/experiments/thinking-config.ts` — resolves whether a Journey
  turn requests extended thinking, entirely from env vars.
- `lib/journey/experiments/thinking-config.test.ts` — unit tests for the
  resolver, including the "flag off ⇒ production-identical request" guarantee.
- `app/api/journey/turn/route.ts` — two flag-gated changes:
  1. the `messages.stream(...)` request now uses `resolveThinkingConfig(...)`
     for `max_tokens` and (only when the flag is on) `thinking` /
     `output_config`;
  2. an explicit stream guard that skips `thinking_delta` / `signature_delta`
     events so hidden reasoning never reaches the user or the state-report
     parser.

## The safety invariant

The user must never see the model's thinking, and the state-report parser must
never ingest it.

- The visible stream only ever enqueues `text_delta` output (unchanged).
- `processor.fullText` — the string handed to `splitReplyAndReport` — only
  accumulates `text_delta` via `ingestChunk`. Thinking deltas are skipped
  before that branch, so the hidden reasoning cannot contaminate either the
  human reply or the `<state-report>` JSON.
- `recordAiUsage` uses the final message usage, so thinking tokens ARE counted
  for cost telemetry (desirable — the experiment must show its true cost).

## Flag off ⇒ production-identical

With `JOURNEY_THINKING` unset (the default), `resolveThinkingConfig` returns
`mode: 'off'`, no `thinking`, no `output_config`, and `maxTokens === MAX_TOKENS`
(2500). The request built by the route is byte-identical to production. This is
covered by a unit test.

## How to enable (preview / local only — never on the production env)

```bash
# Enabled thinking, explicit budget (>= 1024; API minimum). Budget is added
# ON TOP of the 2500 reply/report ceiling, so visible output never loses room.
JOURNEY_THINKING=enabled
JOURNEY_THINKING_BUDGET=1024        # sweep this — do NOT assume 1500 is right

# or adaptive mode (forward-compatible; model manages its own allocation):
JOURNEY_THINKING=adaptive
JOURNEY_THINKING_EFFORT=low         # low | medium | high
```

| env | effect | max_tokens |
|---|---|---|
| _(unset)_ | production behaviour, no thinking | 2500 |
| `JOURNEY_THINKING=enabled` + `JOURNEY_THINKING_BUDGET=N` | `thinking:{type:'enabled',budget_tokens:max(N,1024)}` | 2500 + budget |
| `JOURNEY_THINKING=adaptive` + `JOURNEY_THINKING_EFFORT=low\|medium\|high` | `thinking:{type:'adaptive'}` + `output_config:{effort}` | 2500 + 2048 |

## SDK note

`@anthropic-ai/sdk@0.30.1` predates the `thinking` / `adaptive` / `output_config`
params, so the route casts them onto the request
(`as unknown as Anthropic.MessageStreamParams`) and the stream guard reads
`delta.type` loosely. If the SDK is upgraded, replace the casts with the typed
params.

## Measuring it

This branch only makes the production toggle exist. The A/B itself runs through
the golden harness on the audit branch
(`mindreset-app/eval/journey/`) — its live runner sets the same thinking params
directly on its own Messages call and records latency / tokens / cost /
hidden-ness / cache behaviour per arm. The harness does **not** depend on this
route flag; the two are independent. See
`docs/journey/remediation-plan-2026-07-21/02-phase1-thinking-experiment-design.md`.
