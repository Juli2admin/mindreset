# Phase 1 — Extended-Thinking Experiment Design (isolated, feature-flagged, NO production merge)

Status: DESIGN ONLY. The experiment branch will be created only after the harness
baseline exists. No merge to main without golden-harness evidence AND owner approval.

## 1. Verified API facts the design rests on (checked against current Anthropic docs, 2026-07-21)

- On `claude-sonnet-4-6` (the Journey's model), **two thinking controls exist**:
  1. `thinking: {type: "enabled", budget_tokens: N}` — a HARD token ceiling.
     **Deprecated on Sonnet 4.6** (kept as a "transitional escape hatch"; removed
     entirely on newer models). Minimum N = **1024** — no smaller budget is possible.
     N must be strictly < `max_tokens`.
  2. `thinking: {type: "adaptive"}` (+ `output_config: {effort: "low"|"medium"|"high"|"max"}`)
     — the recommended, forward-compatible mode; the model decides when and how much to
     think, bounded by effort.
- **`max_tokens` interaction:** with budget N, only `max_tokens − N` remains for
  reply + state report. Production `MAX_TOKENS=2500` with N=1024 would leave ~1,476 —
  too tight (healthy report turns alone run 444–789 tokens). Thinking variants MUST
  raise `max_tokens` to `2500 + N` (budget mode) or 4096 (adaptive-low).
- **Temperature:** allowed on Sonnet 4.6; production sets none (API default). No change.
- **Streaming:** thinking arrives as separate content blocks — `content_block_start`
  (type `thinking`) then `content_block_delta` with `thinking_delta`. It is NOT inline
  text: it cannot collide with `<state-report>`/`<assessment>` handling, and the
  reply-processor never sees it IF the SSE loop forwards only `text_delta` events.
  (Verification item V1 below: the current `route.ts` event loop's delta handling.)
- **Prompt caching:** toggling thinking invalidates only the messages-tier cache, NOT
  the tools/system tier — the cached canon (block 1) and master (block 2) survive.
  Verified empirically in the run via `usage.cache_read_input_tokens` (V4).
- **Hidden-ness:** thinking content is never part of the text channel; on Sonnet 4.6 the
  API returns summarized thinking text in the thinking block — the experiment asserts
  none of it reaches the visible stream or the persisted reply (V2).

## 2. Branch and feature flag

- Branch: `claude/journey-exp-thinking` (experiment-only; never merged without approval;
  clearly named so it cannot be mistaken for remediation).
- Flag: env var `JOURNEY_THINKING` — absent/empty = **exact current behaviour, byte-for-
  byte identical request** (the off-path adds no field to the API call). Values:
  - `budget:1024` → `thinking:{type:"enabled",budget_tokens:1024}`, `max_tokens:3524`
  - `budget:2048` → `thinking:{type:"enabled",budget_tokens:2048}`, `max_tokens:4548`
  - `adaptive:low` → `thinking:{type:"adaptive"}`, `output_config:{effort:"low"}`, `max_tokens:4096`
- Code touchpoints on the branch (small, isolated): `route.ts` stream-call construction
  (~15 lines, flag-gated); SSE event loop guard to skip `thinking_delta` (V1); one
  flag-gated instruction block appended to block 4 (dynamic, uncached) carrying the
  owner's five plan questions. Harness `variant.ts` sets the same config directly
  (no env needed for harness runs).

## 3. The compact pre-reply plan (thinking instruction — owner's wording, verbatim)

Injected ONLY when the flag is on, as the thinking-scope instruction:

> In your thinking, before writing the reply, answer compactly:
> 1. What is the user asking for?
> 2. What has already been asked or established?
> 3. What is the current working hypothesis, held tentatively?
> 4. What single move best serves now?
> 5. What must not be repeated, imposed or prematurely concluded?
> Keep it short. Then write the reply from that plan.

No other prompt content changes in this experiment — one variable at a time.

## 4. Comparison plan (run entirely through the golden harness)

| Arm | Config | Note |
|---|---|---|
| A | current runtime, no thinking | = frozen baseline |
| B1 | budget 1024 (API minimum — the smallest compact budget that exists) | deprecated-mode ceiling test |
| B2 | budget 2048 | second compact budget |
| C | adaptive + effort low | the forward-compatible candidate; budgets B1/B2 are deprecated on this model — if B and C perform similarly, C is the only merge candidate |

Identical fixtures (all 7), identical scripted state, n=3 reps. Minimum-effective-budget
justification comes from B1 vs B2 vs C on the quality metrics at equal latency class:
choose the cheapest arm whose quality delta vs the best arm is within run-to-run variance.

## 5. Report contents (per arm, from harness telemetry)

1. First-token latency — split: time-to-first-thinking-delta AND time-to-first-VISIBLE
   text byte (the user-perceived number).
2. Total turn latency.
3. Thinking-token use per turn (from `usage`; billed as output tokens).
4. Cost per turn delta vs baseline (input/cached/output split).
5. Visible-reply improvement — all 14 harness metrics, especially echo score,
   stock-phrase count, repeated questions, anchor-formula invocations, who-leads,
   reply quality.
6. Whether the state report also changes (completeness, clinicalRead quality, field
   coverage — judged + mechanical).
7. Hidden-ness verification (V2): assert zero thinking content in the visible stream
   and in the persisted-reply equivalent, across every turn of every rep.
8. Incompatibility findings: V1 SSE delta handling; V3 parser unaffected (report still
   parsed from text channel); V4 cache-read tokens unchanged on blocks 1–2 across arms;
   V5 `max_tokens` truncation rate (`stop_reason` per turn — any `max_tokens` stops
   reported per arm).

## 6. Decision gate

Merge consideration ONLY if: (a) visible-reply metrics improve beyond variance on the
Julia fixture AND at least 4 of 6 synthetic fixtures with no metric materially worse;
(b) user-perceived first-byte latency stays under an owner-set ceiling (proposed: 5s
median, 8s p95 — owner to confirm); (c) V1–V5 all clean. Then the evidence report goes
to the owner; merge happens only on her explicit approval, as its own PR containing
nothing but the flag-gated change.

## 7. Boundaries

Production untouched until that approval: the flag is absent in production env, and the
experiment branch is never deployed. The harness exercises the config directly without
any deployment.
